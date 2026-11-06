import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import type pg from "pg";
import { z } from "zod";
import { centralRecord, centralRecords, commitDomainChanges, requirePermission, requireWebSession, type DomainChange, type WebSession } from "./domainMutations.js";
import { rowsWhere } from "./fiscalEvents.js";

// Conferencia de repasses e acertos de entrada pelo site. Repete as regras de
// AppRepository: listTransferReconciliationInvoices, saveTransferReconciliation,
// cancel/deleteTransferReconciliation, listTransferReconciliationClientBalances,
// findEligiblePurchaseOperations, getSupplierPurchaseSummary,
// generatePurchaseSettlement e cancelAccountPayable (origem IMPORT).
//
// Diferenca deliberada: o site nao roda completeKnownSupplierTriangulations
// (o app completa triangulacoes de fornecedor antes de listar as compras).

type Row = Record<string, unknown>;
const text = (value: unknown): string => String(value ?? "");
const blank = (value: unknown): string | null => text(value).trim() || null;
const cents = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};
const active = (row: Row | undefined): boolean => Boolean(row) && row!.is_active !== 0 && row!.is_active !== false;
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida.");

class HttpError extends Error {
  constructor(readonly statusCode: number, readonly code: string, message: string) { super(message); }
}
const fail = (message: string, code = "INVALID_STATE", status = 409): never => { throw new HttpError(status, code, message); };

async function send(reply: FastifyReply, action: () => Promise<unknown>): Promise<unknown> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof HttpError) return reply.code(error.statusCode).send({ error: error.code, message: error.message });
    if (error instanceof z.ZodError) return reply.code(400).send({ error: "INVALID_REQUEST", message: error.issues.map((issue) => issue.message).join("; ") });
    throw error;
  }
}

// Mesmo normalizeName do app (compara razoes sociais sem acento, pontuacao e LTDA/ME/EPP/SA).
export function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^\p{Letter}\p{Number} ]/gu, " ")
    .replace(/\b(LTDA|ME|EPP|SA|S A)\b/gi, "").replace(/\s+/g, " ").trim().toUpperCase();
}

function snapshotParty(document: Row, key: "issuer" | "recipient"): Row | null {
  try {
    const parsed = JSON.parse(text(document.fiscal_snapshot_json) || "null") as Row | null;
    const party = parsed?.[key];
    return party && typeof party === "object" && !Array.isArray(party) ? party as Row : null;
  } catch { return null; }
}

type Role = "CLIENT" | "SUPPLIER";

async function partnersWithRole(pool: pg.Pool, role: Role): Promise<Row[]> {
  const [partners, roles] = await Promise.all([centralRecords(pool, "business_partners"), rowsWhere(pool, "business_partner_roles", "role", [role])]);
  const ids = new Set(roles.map((row) => text(row.business_partner_id)));
  return partners.filter((row) => ids.has(text(row.id)));
}

// listTransferReconciliationInvoices: notas do parceiro (e de cadastros com o mesmo
// CNPJ/nome) com o quanto cada uma ja foi usada em outras conferencias.
async function availableInvoices(pool: pg.Pool, partnerId: string, role: Role, reconciliationId?: string) {
  const selected = await centralRecord(pool, "business_partners", partnerId);
  if (!selected) fail("Parceiro nao encontrado.", "NOT_FOUND", 404);
  const selectedDocument = text(selected!.document_number).replace(/\D/g, "");
  const selectedName = normalizeName(text(selected!.display_name));
  const matching = (await partnersWithRole(pool, role)).filter((partner) => {
    const document = text(partner.document_number).replace(/\D/g, "");
    const sameName = normalizeName(text(partner.display_name)) === selectedName;
    return selectedDocument ? document === selectedDocument || (!document && sameName) : sameName;
  }).map((partner) => text(partner.id));
  if (!matching.includes(partnerId)) matching.push(partnerId);

  const [reconciliations, usages, operations] = await Promise.all([
    centralRecords(pool, "transfer_reconciliations"), centralRecords(pool, "transfer_reconciliation_invoices"),
    rowsWhere(pool, "operations", "responsible_partner_id", matching)
  ]);
  const reconciliationMap = new Map(reconciliations.map((row) => [text(row.id), row]));
  const groups = new Map<string, Row[]>();
  for (const usage of usages.sort((left, right) => text(left.created_at).localeCompare(text(right.created_at)) || text(left.id).localeCompare(text(right.id)))) {
    const owner = reconciliationMap.get(text(usage.reconciliation_id));
    if (!owner || owner.status === "CANCELLED" || text(owner.id) === reconciliationId) continue;
    groups.set(text(owner.id), [...(groups.get(text(owner.id)) ?? []), usage]);
  }
  const usedByDocument = new Map<string, number>();
  for (const [ownerId, group] of groups) {
    const owner = reconciliationMap.get(ownerId)!;
    const totalSource = Math.max(0, cents(owner.total_source_cents));
    const totalPayments = Math.max(0, cents(owner.total_payments_cents));
    const target = owner.status === "DRAFT" ? totalSource : Math.min(totalSource, totalPayments);
    let assigned = 0;
    group.forEach((row, index) => {
      const amount = Math.max(0, cents(row.source_amount_cents));
      const used = index === group.length - 1 ? Math.min(amount, target - assigned)
        : totalSource > 0 ? Number((BigInt(amount) * BigInt(target)) / BigInt(totalSource)) : 0;
      assigned += used;
      usedByDocument.set(text(row.fiscal_document_id), (usedByDocument.get(text(row.fiscal_document_id)) ?? 0) + used);
    });
  }
  const operationType = role === "SUPPLIER" ? "PURCHASE" : "SALE";
  const documentIds = [...new Set(operations.filter((row) => row.operation_type === operationType && row.status !== "CANCELED").map((row) => text(row.fiscal_document_id)))];
  const [documents, organizations, entities, partnerEntities] = await Promise.all([
    rowsWhere(pool, "fiscal_documents", "id", documentIds), centralRecords(pool, "organizations"),
    centralRecords(pool, "legal_entities"), centralRecords(pool, "partner_legal_entities")
  ]);
  const index = (rows: Row[]) => new Map(rows.map((row) => [text(row.id), row]));
  const organizationMap = index(organizations); const entityMap = index(entities); const partnerEntityMap = index(partnerEntities);
  return documents.filter((row) => row.status !== "CANCELED").map((document) => {
    const own = entityMap.get(text(document.own_legal_entity_id));
    const linked = partnerEntityMap.get(text(document.partner_legal_entity_id));
    const ownName = text(own?.legal_name) || text(own?.trade_name);
    const partnerName = blank(linked?.legal_name) ?? blank(linked?.trade_name);
    const total = cents(document.total_amount_cents);
    const used = usedByDocument.get(text(document.id)) ?? 0;
    return {
      fiscalDocumentId: text(document.id), organizationId: text(document.organization_id),
      organizationName: text(organizationMap.get(text(document.organization_id))?.display_name), documentNumber: text(document.document_number),
      issueDate: text(document.issue_date),
      issuerName: blank(snapshotParty(document, "issuer")?.legalName) ?? (role === "SUPPLIER" ? partnerName : ownName || null),
      recipientName: blank(snapshotParty(document, "recipient")?.legalName) ?? (role === "SUPPLIER" ? ownName || null : partnerName),
      invoiceTotalCents: total, previouslyUsedCents: used, availableCents: total - used
    };
  }).sort((left, right) => right.issueDate.localeCompare(left.issueDate) || right.documentNumber.localeCompare(left.documentNumber, "pt-BR", { numeric: true }));
}

const reconciliationSchema = z.object({
  id: z.string().min(1).optional(), organizationId: z.string().min(1), clientPartnerId: z.string().min(1), referenceDate: dateSchema,
  title: z.string().trim().max(240).nullable().optional(), notes: z.string().trim().max(4000).nullable().optional(),
  counterpartyRole: z.enum(["CLIENT", "SUPPLIER"]).optional(), sourceMode: z.enum(["INVOICES", "MANUAL"]).optional(),
  manualSourceCents: z.number().int().nullable().optional(), status: z.enum(["DRAFT", "COMPLETED"]).default("DRAFT"),
  invoices: z.array(z.object({ fiscalDocumentId: z.string().min(1), sourceAmountCents: z.number().int() })).max(2000).default([]),
  payments: z.array(z.object({
    id: z.string().min(1).optional(), beneficiaryName: z.string().trim().min(1, "Informe o favorecido de cada pagamento.").max(240),
    beneficiaryDocument: z.string().trim().max(40).nullable().optional(), description: z.string().trim().max(500).nullable().optional(),
    paymentDate: dateSchema.nullable().optional(), amountCents: z.number().int(), notes: z.string().trim().max(2000).nullable().optional()
  })).max(2000).default([])
});

async function reconciliationDetail(pool: pg.Pool, id: string) {
  const row = await centralRecord(pool, "transfer_reconciliations", id);
  if (!row) fail("Conferencia de repasse nao encontrada.", "NOT_FOUND", 404);
  const [partner, invoices, payments] = await Promise.all([
    centralRecord(pool, "business_partners", text(row!.client_partner_id)),
    rowsWhere(pool, "transfer_reconciliation_invoices", "reconciliation_id", [id]),
    rowsWhere(pool, "transfer_reconciliation_payments", "reconciliation_id", [id])
  ]);
  return {
    reconciliation: {
      id, organizationId: text(row!.organization_id), clientPartnerId: text(row!.client_partner_id), clientName: text(partner?.display_name),
      counterpartyRole: text(row!.counterparty_role) || "CLIENT", sourceMode: text(row!.source_mode) || "INVOICES",
      manualSourceCents: row!.manual_source_cents == null ? null : cents(row!.manual_source_cents), referenceDate: text(row!.reference_date),
      title: blank(row!.title), notes: blank(row!.notes), status: text(row!.status), totalSourceCents: cents(row!.total_source_cents),
      totalPaymentsCents: cents(row!.total_payments_cents), balanceCents: cents(row!.balance_cents), completedAt: blank(row!.completed_at),
      cancelledAt: blank(row!.cancelled_at), createdAt: text(row!.created_at), updatedAt: text(row!.updated_at)
    },
    invoices: invoices.sort((left, right) => text(left.issue_date_snapshot).localeCompare(text(right.issue_date_snapshot))
      || text(left.document_number_snapshot).localeCompare(text(right.document_number_snapshot), "pt-BR", { numeric: true }))
      .map((item) => ({
        id: text(item.id), fiscalDocumentId: text(item.fiscal_document_id), documentNumber: text(item.document_number_snapshot),
        issueDate: text(item.issue_date_snapshot), issuerName: blank(item.issuer_name_snapshot), recipientName: blank(item.recipient_name_snapshot),
        invoiceTotalCents: cents(item.invoice_total_cents_snapshot), sourceAmountCents: cents(item.source_amount_cents)
      })),
    payments: payments.sort((left, right) => cents(left.sort_order) - cents(right.sort_order) || text(left.created_at).localeCompare(text(right.created_at)))
      .map((item) => ({
        id: text(item.id), beneficiaryName: text(item.beneficiary_name), beneficiaryDocument: blank(item.beneficiary_document),
        description: blank(item.description), paymentDate: blank(item.payment_date), amountCents: cents(item.amount_cents),
        notes: blank(item.notes), sortOrder: cents(item.sort_order)
      }))
  };
}

const settlementSchema = z.object({
  organizationId: z.string().min(1), ownLegalEntityId: z.string().min(1), supplierPartnerId: z.string().min(1),
  operationIds: z.array(z.string().min(1)).min(1).max(2000), categoryId: z.string().min(1), dueDate: dateSchema,
  notes: z.string().trim().max(2000).nullable().optional()
});
const purchaseQuerySchema = z.object({
  organizationId: z.string().min(1), legalEntityId: z.string().optional(), supplierPartnerId: z.string().optional(),
  periodStart: dateSchema, periodEnd: dateSchema, includeAllCompanies: z.enum(["true", "false"]).optional()
});

// findEligiblePurchaseOperations: compras confirmadas, com regra de entrada e ainda nao acertadas.
async function eligiblePurchases(pool: pg.Pool, input: z.infer<typeof purchaseQuerySchema>) {
  const all = input.includeAllCompanies === "true";
  const operations = (await rowsWhere(pool, "operations", "operation_type", ["PURCHASE"]))
    .filter((row) => all || (text(row.organization_id) === input.organizationId && (!input.legalEntityId || text(row.own_legal_entity_id) === input.legalEntityId)))
    .filter((row) => !input.supplierPartnerId || text(row.responsible_partner_id) === input.supplierPartnerId)
    .filter((row) => text(row.operation_date) >= input.periodStart && text(row.operation_date) <= input.periodEnd)
    .filter((row) => ["DRAFT", "CONFIRMED"].includes(text(row.status)) && cents(row.applied_rate_value_cents) > 0)
    .filter((row) => (text(row.purchase_settlement_status) || "UNSETTLED") === "UNSETTLED");
  const documents = await rowsWhere(pool, "fiscal_documents", "id", [...new Set(operations.map((row) => text(row.fiscal_document_id)))]);
  const documentMap = new Map(documents.map((row) => [text(row.id), row]));
  return operations.flatMap((operation) => {
    const document = documentMap.get(text(operation.fiscal_document_id));
    if (!document || !["DRAFT", "CONFIRMED"].includes(text(document.status)) || Boolean(Number(document.has_pending_issues ?? 0))) return [];
    return [{ operation, document }];
  }).sort((left, right) => text(left.operation.operation_date).localeCompare(text(right.operation.operation_date)) || text(left.operation.created_at).localeCompare(text(right.operation.created_at)));
}

export function registerSettlementManagementRoutes(app: FastifyInstance, pool: pg.Pool): void {
  const authorize = (session: WebSession, reply: FastifyReply, permission: string, organizationId: string, legalEntityId: string | null = null) =>
    requirePermission(pool, session, reply, permission, organizationId, legalEntityId);

  // ---------- Conferencia de repasses ----------
  app.get("/v1/manage/transfer-reconciliations/partners", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    return send(reply, async () => {
      const input = z.object({ organizationId: z.string().min(1), role: z.enum(["CLIENT", "SUPPLIER"]).default("CLIENT") }).parse(request.query);
      if (!(await authorize(session, reply, "billing.manage", input.organizationId))) return;
      return (await partnersWithRole(pool, input.role)).filter(active)
        .map((row) => ({ id: text(row.id), displayName: text(row.display_name), organizationId: text(row.organization_id) }))
        .sort((left, right) => left.displayName.localeCompare(right.displayName, "pt-BR"));
    });
  });

  app.get("/v1/manage/transfer-reconciliations/invoices", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    return send(reply, async () => {
      const input = z.object({ organizationId: z.string().min(1), partnerId: z.string().min(1), role: z.enum(["CLIENT", "SUPPLIER"]).default("CLIENT"), reconciliationId: z.string().optional() }).parse(request.query);
      if (!(await authorize(session, reply, "billing.manage", input.organizationId))) return;
      return availableInvoices(pool, input.partnerId, input.role, input.reconciliationId);
    });
  });

  app.get("/v1/manage/transfer-reconciliations/balances", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    return send(reply, async () => {
      const { organizationId } = z.object({ organizationId: z.string().min(1) }).parse(request.query);
      if (!(await authorize(session, reply, "billing.manage", organizationId))) return;
      const [rows, clients] = await Promise.all([rowsWhere(pool, "transfer_reconciliations", "organization_id", [organizationId]), partnersWithRole(pool, "CLIENT")]);
      return clients.filter((client) => text(client.organization_id) === organizationId && active(client)).flatMap((client) => {
        const own = rows.filter((row) => text(row.client_partner_id) === text(client.id) && (text(row.counterparty_role) || "CLIENT") === "CLIENT");
        if (!own.length) return [];
        const completed = own.filter((row) => row.status === "COMPLETED").map((row) => cents(row.balance_cents));
        return [{
          clientPartnerId: text(client.id), clientName: text(client.display_name),
          creditCents: completed.filter((value) => value > 0).reduce((sum, value) => sum + value, 0),
          debitCents: completed.filter((value) => value < 0).reduce((sum, value) => sum - value, 0),
          netBalanceCents: completed.reduce((sum, value) => sum + value, 0), openReconciliations: own.filter((row) => row.status === "DRAFT").length
        }];
      }).sort((left, right) => Math.abs(right.netBalanceCents) - Math.abs(left.netBalanceCents) || left.clientName.localeCompare(right.clientName, "pt-BR"));
    });
  });

  app.get("/v1/manage/transfer-reconciliations/:id", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    return send(reply, async () => {
      const detail = await reconciliationDetail(pool, (request.params as { id: string }).id);
      if (!(await authorize(session, reply, "billing.manage", detail.reconciliation.organizationId))) return;
      return detail;
    });
  });

  app.post("/v1/manage/transfer-reconciliations", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    return send(reply, async () => {
      const input = reconciliationSchema.parse(request.body);
      if (!(await authorize(session, reply, "billing.manage", input.organizationId))) return;
      const existing = input.id ? await centralRecord(pool, "transfer_reconciliations", input.id) : null;
      if (input.id && !existing) fail("Conferencia de repasse nao encontrada.", "NOT_FOUND", 404);
      if (existing && text(existing.organization_id) !== input.organizationId) fail("A conferencia pertence a outro grupo.");
      const sourceMode = input.sourceMode ?? (text(existing?.source_mode) || "INVOICES") as "INVOICES" | "MANUAL";
      const manualSourceCents = sourceMode === "MANUAL" ? input.manualSourceCents ?? (existing?.manual_source_cents == null ? null : cents(existing.manual_source_cents)) : null;
      if (sourceMode === "INVOICES" && !input.invoices.length) fail("Selecione pelo menos uma nota fiscal.", "INVALID_REQUEST", 400);
      if (sourceMode === "MANUAL" && (!Number.isInteger(manualSourceCents) || Number(manualSourceCents) <= 0)) fail("Informe um valor inicial valido para a conferencia.", "INVALID_REQUEST", 400);
      if (sourceMode === "MANUAL" && input.invoices.length) fail("Uma conferencia com valor manual nao pode ter notas vinculadas.", "INVALID_REQUEST", 400);
      if (input.invoices.some((item) => item.sourceAmountCents <= 0)) fail("Informe um valor valido para cada nota.", "INVALID_REQUEST", 400);
      if (input.payments.some((item) => item.amountCents <= 0)) fail("Informe um valor valido para cada pagamento.", "INVALID_REQUEST", 400);
      if (new Set(input.invoices.map((item) => item.fiscalDocumentId)).size !== input.invoices.length) fail("A mesma nota aparece duas vezes.", "INVALID_REQUEST", 400);
      const counterpartyRole = input.counterpartyRole ?? (text(existing?.counterparty_role) || "CLIENT") as Role;
      const roles = await rowsWhere(pool, "business_partner_roles", "business_partner_id", [input.clientPartnerId]);
      if (!roles.some((row) => row.role === counterpartyRole)) fail(counterpartyRole === "SUPPLIER" ? "O parceiro selecionado nao e fornecedor." : "O parceiro selecionado nao e cliente.");

      const id = input.id ?? randomUUID();
      const now = new Date().toISOString();
      const totalSource = sourceMode === "MANUAL" ? Number(manualSourceCents) : input.invoices.reduce((sum, item) => sum + item.sourceAmountCents, 0);
      const totalPayments = input.payments.reduce((sum, item) => sum + item.amountCents, 0);
      const changes: DomainChange[] = [{ table: "transfer_reconciliations", key: id, operation: "UPSERT", data: {
        ...(existing ?? {}), id, organization_id: input.organizationId, client_partner_id: input.clientPartnerId, counterparty_role: counterpartyRole,
        source_mode: sourceMode, manual_source_cents: manualSourceCents, reference_date: input.referenceDate, title: blank(input.title),
        notes: blank(input.notes), status: input.status, total_source_cents: totalSource, total_payments_cents: totalPayments,
        balance_cents: totalSource - totalPayments, completed_at: input.status === "COMPLETED" ? now : null, cancelled_at: null,
        created_at: existing?.created_at ?? now, updated_at: now
      } }];
      const [oldInvoices, oldPayments] = existing ? await Promise.all([
        rowsWhere(pool, "transfer_reconciliation_invoices", "reconciliation_id", [id]), rowsWhere(pool, "transfer_reconciliation_payments", "reconciliation_id", [id])
      ]) : [[], []];
      if (input.invoices.length) {
        const available = new Map((await availableInvoices(pool, input.clientPartnerId, counterpartyRole, id)).map((item) => [item.fiscalDocumentId, item]));
        const documents = new Map((await rowsWhere(pool, "fiscal_documents", "id", input.invoices.map((item) => item.fiscalDocumentId))).map((row) => [text(row.id), row]));
        for (const selection of input.invoices) {
          const item = available.get(selection.fiscalDocumentId);
          const document = documents.get(selection.fiscalDocumentId);
          if (!item || !document) fail("Nota indisponivel para conferencia.");
          if (selection.sourceAmountCents > item!.availableCents) fail(`O valor informado supera o saldo disponivel da nota ${item!.documentNumber}.`);
          // Reaproveita a linha da mesma nota (UNIQUE reconciliation_id + fiscal_document_id no app).
          const previousInvoice = oldInvoices.find((row) => text(row.fiscal_document_id) === selection.fiscalDocumentId);
          const invoiceId = previousInvoice ? text(previousInvoice.id) : randomUUID();
          changes.push({ table: "transfer_reconciliation_invoices", key: invoiceId, operation: "UPSERT", data: {
            id: invoiceId, reconciliation_id: id, fiscal_document_id: selection.fiscalDocumentId, document_number_snapshot: text(document!.document_number),
            issue_date_snapshot: text(document!.issue_date), issuer_name_snapshot: item!.issuerName, recipient_name_snapshot: item!.recipientName,
            invoice_total_cents_snapshot: cents(document!.total_amount_cents), source_amount_cents: selection.sourceAmountCents, created_at: previousInvoice?.created_at ?? now, updated_at: now
          } });
        }
      }
      const keptPayments = new Set(input.payments.map((item) => item.id).filter((value): value is string => Boolean(value) && oldPayments.some((row) => text(row.id) === value)));
      input.payments.forEach((payment, index) => {
        const paymentId = payment.id && keptPayments.has(payment.id) ? payment.id : randomUUID();
        const previous = oldPayments.find((row) => text(row.id) === paymentId);
        changes.push({ table: "transfer_reconciliation_payments", key: paymentId, operation: "UPSERT", data: {
          id: paymentId, reconciliation_id: id, beneficiary_name: payment.beneficiaryName.trim(), beneficiary_document: blank(payment.beneficiaryDocument),
          description: blank(payment.description), payment_date: payment.paymentDate || null, amount_cents: payment.amountCents, notes: blank(payment.notes),
          sort_order: index, created_at: previous?.created_at ?? now, updated_at: now
        } });
      });
      oldInvoices.filter((row) => !input.invoices.some((item) => item.fiscalDocumentId === text(row.fiscal_document_id))).forEach((row) => changes.push({ table: "transfer_reconciliation_invoices", key: text(row.id), operation: "DELETE" }));
      oldPayments.filter((row) => !keptPayments.has(text(row.id))).forEach((row) => changes.push({ table: "transfer_reconciliation_payments", key: text(row.id), operation: "DELETE" }));
      const revision = await commitDomainChanges(pool, session, existing ? "WEB_TRANSFER_RECONCILIATION_UPDATED" : "WEB_TRANSFER_RECONCILIATION_CREATED", "transfer_reconciliation", id, changes,
        { organizationId: input.organizationId, clientPartnerId: input.clientPartnerId, status: input.status, totalSourceCents: totalSource, totalPaymentsCents: totalPayments });
      return reply.code(existing ? 200 : 201).send({ id, revision, status: input.status, balanceCents: totalSource - totalPayments });
    });
  });

  app.post("/v1/manage/transfer-reconciliations/:id/cancel", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    return send(reply, async () => {
      const { id } = request.params as { id: string };
      const row = await centralRecord(pool, "transfer_reconciliations", id);
      if (!row) fail("Conferencia de repasse nao encontrada.", "NOT_FOUND", 404);
      if (!(await authorize(session, reply, "billing.manage", text(row!.organization_id)))) return;
      const now = new Date().toISOString();
      const revision = await commitDomainChanges(pool, session, "WEB_TRANSFER_RECONCILIATION_CANCELLED", "transfer_reconciliation", id,
        [{ table: "transfer_reconciliations", key: id, operation: "UPSERT", data: { ...row, status: "CANCELLED", cancelled_at: now, updated_at: now } }],
        { organizationId: row!.organization_id });
      return { id, revision, status: "CANCELLED" };
    });
  });

  app.delete("/v1/manage/transfer-reconciliations/:id", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    return send(reply, async () => {
      const { id } = request.params as { id: string };
      const row = await centralRecord(pool, "transfer_reconciliations", id);
      if (!row) fail("Conferencia de repasse nao encontrada.", "NOT_FOUND", 404);
      if (!(await authorize(session, reply, "billing.manage", text(row!.organization_id)))) return;
      const [invoices, payments] = await Promise.all([
        rowsWhere(pool, "transfer_reconciliation_invoices", "reconciliation_id", [id]), rowsWhere(pool, "transfer_reconciliation_payments", "reconciliation_id", [id])
      ]);
      const changes: DomainChange[] = [
        ...payments.map((item): DomainChange => ({ table: "transfer_reconciliation_payments", key: text(item.id), operation: "DELETE" })),
        ...invoices.map((item): DomainChange => ({ table: "transfer_reconciliation_invoices", key: text(item.id), operation: "DELETE" })),
        { table: "transfer_reconciliations", key: id, operation: "DELETE" }
      ];
      const revision = await commitDomainChanges(pool, session, "WEB_TRANSFER_RECONCILIATION_DELETED", "transfer_reconciliation", id, changes, { organizationId: row!.organization_id });
      return { id, revision, deleted: true };
    });
  });

  // ---------- Acertos de entrada (compras por saca) ----------
  app.get("/v1/manage/purchase-settlements/options", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    return send(reply, async () => {
      const { organizationId } = z.object({ organizationId: z.string().min(1) }).parse(request.query);
      if (!(await authorize(session, reply, "finance.manage", organizationId))) return;
      const [suppliers, categories] = await Promise.all([partnersWithRole(pool, "SUPPLIER"), rowsWhere(pool, "expense_categories", "organization_id", [organizationId])]);
      return {
        suppliers: suppliers.filter(active).map((row) => ({ id: text(row.id), displayName: text(row.display_name) })).sort((left, right) => left.displayName.localeCompare(right.displayName, "pt-BR")),
        categories: categories.filter(active).map((row) => ({ id: text(row.id), name: text(row.name), code: blank(row.code) })).sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
      };
    });
  });

  app.get("/v1/manage/purchase-settlements/eligible", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    return send(reply, async () => {
      const input = purchaseQuerySchema.parse(request.query);
      if (!(await authorize(session, reply, "finance.manage", input.organizationId, input.includeAllCompanies === "true" ? null : input.legalEntityId ?? null))) return;
      const rows = await eligiblePurchases(pool, input);
      const [partners, entities, products] = await Promise.all([centralRecords(pool, "business_partners"), centralRecords(pool, "legal_entities"), centralRecords(pool, "products")]);
      const name = (list: Row[], id: unknown, field: string) => text(list.find((row) => row.id === id)?.[field]);
      return rows.map(({ operation, document }) => ({
        id: text(operation.id), supplierPartnerId: text(operation.responsible_partner_id), supplierName: name(partners, operation.responsible_partner_id, "display_name"),
        ownLegalEntityId: text(operation.own_legal_entity_id), ownLegalEntityName: name(entities, operation.own_legal_entity_id, "trade_name"),
        operationDate: text(operation.operation_date), documentNumber: text(document.document_number), fiscalDocumentId: text(document.id),
        issuerName: blank(snapshotParty(document, "issuer")?.legalName), recipientName: blank(snapshotParty(document, "recipient")?.legalName),
        productName: blank(name(products, operation.product_id, "name")), operationScope: text(operation.operation_scope),
        quantitySacks: text(operation.quantity_sacks_decimal), rateCents: cents(operation.applied_rate_value_cents), amountCents: cents(operation.service_amount_cents)
      }));
    });
  });

  app.post("/v1/manage/purchase-settlements", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    return send(reply, async () => {
      const input = settlementSchema.parse(request.body);
      if (!(await authorize(session, reply, "finance.manage", input.organizationId, input.ownLegalEntityId))) return;
      const [supplier, roles, own, category] = await Promise.all([
        centralRecord(pool, "business_partners", input.supplierPartnerId), rowsWhere(pool, "business_partner_roles", "business_partner_id", [input.supplierPartnerId]),
        centralRecord(pool, "legal_entities", input.ownLegalEntityId), centralRecord(pool, "expense_categories", input.categoryId)
      ]);
      if (!supplier) fail("Fornecedor nao encontrado.", "NOT_FOUND", 404);
      if (!roles.some((row) => row.role === "SUPPLIER")) fail("Somente cadastros com papel Fornecedor podem usar esta configuracao.");
      if (!own || text(own.organization_id) !== input.organizationId) fail("Empresa propria nao encontrada.", "NOT_FOUND", 404);
      if (!category || text(category.organization_id) !== input.organizationId) fail("Categoria financeira nao encontrada.", "NOT_FOUND", 404);
      const unique = [...new Set(input.operationIds)];
      const operations = await rowsWhere(pool, "operations", "id", unique);
      if (operations.length !== unique.length) fail("Uma das operacoes selecionadas nao foi encontrada.", "NOT_FOUND", 404);
      const documents = new Map((await rowsWhere(pool, "fiscal_documents", "id", [...new Set(operations.map((row) => text(row.fiscal_document_id)))])).map((row) => [text(row.id), row]));
      const products = new Map((await rowsWhere(pool, "products", "id", [...new Set(operations.map((row) => text(row.product_id)).filter(Boolean))])).map((row) => [text(row.id), row]));
      for (const operation of operations) {
        if (text(operation.responsible_partner_id) !== input.supplierPartnerId) fail("Operacao fora do escopo do acerto.");
        if (operation.operation_type !== "PURCHASE") fail("Somente operacoes de compra entram num acerto de fornecedor.");
        const document = documents.get(text(operation.fiscal_document_id));
        if (!["DRAFT", "CONFIRMED"].includes(text(operation.status)) || !document || !["DRAFT", "CONFIRMED"].includes(text(document.status)) || Boolean(Number(document.has_pending_issues ?? 0)) || cents(operation.applied_rate_value_cents) <= 0) {
          fail("Nota com pendencias ou sem regra de entrada nao pode entrar no acerto.");
        }
        if ((text(operation.purchase_settlement_status) || "UNSETTLED") !== "UNSETTLED") fail("Operacao ja reservada ou acertada.");
      }
      const supplierEntities = (await rowsWhere(pool, "partner_legal_entities", "business_partner_id", [input.supplierPartnerId])).filter(active);
      const primary = supplierEntities.find((row) => Boolean(Number(row.is_primary ?? 0))) ?? supplierEntities[0] ?? null;
      const amount = operations.reduce((sum, row) => sum + cents(row.service_amount_cents), 0);
      const now = new Date().toISOString();
      const today = now.slice(0, 10);
      const payableId = randomUUID();
      const status = amount === 0 ? "PAID" : "OPEN";
      const changes: DomainChange[] = [{ table: "accounts_payable", key: payableId, operation: "UPSERT", data: {
        id: payableId, organization_id: input.organizationId, own_legal_entity_id: input.ownLegalEntityId, supplier_partner_id: input.supplierPartnerId,
        supplier_legal_entity_id: primary ? text(primary.id) : null, payee_name_snapshot: text(supplier!.display_name),
        payee_tax_id_snapshot: primary?.cnpj ? text(primary.cnpj).replace(/\D/g, "") : null, category_id: input.categoryId,
        default_cost_center_id: null, default_location_id: null, recurring_template_id: null, installment_group_id: null,
        installment_number: null, installment_count: null, source: "IMPORT", description: `Acerto de compras - ${text(supplier!.display_name)}`,
        document_type: null, document_number: null, competence_date: today, issue_date: today, due_date: input.dueDate,
        original_amount_cents: amount, discount_cents: 0, interest_cents: 0, penalty_cents: 0, other_additions_cents: 0,
        final_amount_cents: amount, paid_amount_cents: 0, open_amount_cents: amount, amount_status: "CONFIRMED", status,
        notes: blank(input.notes), internal_notes: null, created_at: now, updated_at: now, confirmed_at: now, cancelled_at: null,
        cancellation_reason: null, contested_at: null, contest_reason: null, planned_payment_method: null, pix_key: null
      } }];
      const history = (previous: string | null, next: string, reason: string): DomainChange => {
        const id = randomUUID();
        return { table: "payable_status_history", key: id, operation: "UPSERT", data: { id, account_payable_id: payableId, previous_status: previous, new_status: next, reason, changed_by_user_id: null, changed_at: now } };
      };
      changes.push(history(null, "DRAFT", "Rascunho criado a partir de acerto de compras pelo site"));
      for (const operation of operations) {
        const document = documents.get(text(operation.fiscal_document_id))!;
        const linkId = randomUUID();
        changes.push({ table: "account_payable_operations", key: linkId, operation: "UPSERT", data: {
          id: linkId, account_payable_id: payableId, operation_id: operation.id, own_legal_entity_id_snapshot: operation.own_legal_entity_id,
          own_legal_entity_name_snapshot: text(own!.trade_name), supplier_partner_id_snapshot: input.supplierPartnerId,
          operation_date_snapshot: operation.operation_date, fiscal_document_number_snapshot: document.document_number ?? null,
          fiscal_document_series_snapshot: document.series ?? null, product_name_snapshot: products.get(text(operation.product_id))?.name ?? null,
          operation_scope_snapshot: operation.operation_scope, quantity_sacks_decimal_snapshot: operation.quantity_sacks_decimal,
          purchase_rate_cents_snapshot: cents(operation.applied_rate_value_cents), purchase_amount_cents_snapshot: cents(operation.service_amount_cents),
          released_at: null, created_at: now
        } });
        changes.push({ table: "operations", key: text(operation.id), operation: "UPSERT", data: { ...operation, purchase_settlement_status: "SETTLED", account_payable_id: payableId, updated_at: now } });
      }
      changes.push(history("DRAFT", status, "Acerto de compras confirmado"));
      const revision = await commitDomainChanges(pool, session, "WEB_PURCHASE_SETTLEMENT_CREATED", "account_payable", payableId, changes,
        { organizationId: input.organizationId, legalEntityId: input.ownLegalEntityId, supplierPartnerId: input.supplierPartnerId, operationCount: operations.length, amountCents: amount });
      return reply.code(201).send({ id: payableId, revision, status, amountCents: amount });
    });
  });

  app.get("/v1/manage/purchase-settlements/:id/operations", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    return send(reply, async () => {
      const { id } = request.params as { id: string };
      const payable = await centralRecord(pool, "accounts_payable", id);
      if (!payable) fail("Conta a pagar nao encontrada.", "NOT_FOUND", 404);
      if (!(await authorize(session, reply, "finance.manage", text(payable!.organization_id), text(payable!.own_legal_entity_id)))) return;
      return (await rowsWhere(pool, "account_payable_operations", "account_payable_id", [id]))
        .sort((left, right) => text(left.operation_date_snapshot).localeCompare(text(right.operation_date_snapshot)) || text(left.created_at).localeCompare(text(right.created_at)))
        .map((row) => ({
          id: text(row.id), operationDate: text(row.operation_date_snapshot), documentNumber: blank(row.fiscal_document_number_snapshot),
          productName: blank(row.product_name_snapshot), operationScope: text(row.operation_scope_snapshot), quantitySacks: text(row.quantity_sacks_decimal_snapshot),
          rateCents: cents(row.purchase_rate_cents_snapshot), amountCents: cents(row.purchase_amount_cents_snapshot), released: Boolean(row.released_at)
        }));
    });
  });

  // cancelAccountPayable para acertos: sem pagamento, cancela e devolve as compras para "nao acertadas".
  app.post("/v1/manage/purchase-settlements/:id/cancel", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    return send(reply, async () => {
      const { id } = request.params as { id: string };
      const { reason } = z.object({ reason: z.string().trim().min(3).max(2000) }).parse(request.body);
      const payable = await centralRecord(pool, "accounts_payable", id);
      if (!payable) fail("Conta a pagar nao encontrada.", "NOT_FOUND", 404);
      if (!(await authorize(session, reply, "finance.manage", text(payable!.organization_id), text(payable!.own_legal_entity_id)))) return;
      if (payable!.status === "CANCELLED") return { id, alreadyCancelled: true };
      if (cents(payable!.paid_amount_cents) > 0) fail("Cancele ou estorne pagamentos antes de cancelar esta conta.");
      const now = new Date().toISOString();
      const historyId = randomUUID();
      const changes: DomainChange[] = [
        { table: "accounts_payable", key: id, operation: "UPSERT", data: { ...payable, status: "CANCELLED", cancelled_at: now, cancellation_reason: reason, updated_at: now } },
        { table: "payable_status_history", key: historyId, operation: "UPSERT", data: { id: historyId, account_payable_id: id, previous_status: payable!.status, new_status: "CANCELLED", reason, changed_by_user_id: null, changed_at: now } }
      ];
      if (payable!.source === "IMPORT") {
        for (const link of (await rowsWhere(pool, "account_payable_operations", "account_payable_id", [id])).filter((row) => !row.released_at)) {
          changes.push({ table: "account_payable_operations", key: text(link.id), operation: "UPSERT", data: { ...link, released_at: now } });
        }
        for (const operation of await rowsWhere(pool, "operations", "account_payable_id", [id])) {
          changes.push({ table: "operations", key: text(operation.id), operation: "UPSERT", data: { ...operation, purchase_settlement_status: "UNSETTLED", account_payable_id: null, updated_at: now } });
        }
      }
      const revision = await commitDomainChanges(pool, session, "WEB_PURCHASE_SETTLEMENT_CANCELLED", "account_payable", id, changes,
        { organizationId: payable!.organization_id, legalEntityId: payable!.own_legal_entity_id, reason });
      return { id, revision, status: "CANCELLED" };
    });
  });
}
