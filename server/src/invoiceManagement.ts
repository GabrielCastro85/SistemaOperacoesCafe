import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import type pg from "pg";
import { z } from "zod";
import { multiplyDecimalByCents, normalizeDecimalText } from "../../src/shared/utils/decimal.js";
import { isPackagingDocument, PACKAGING_OVERRIDE_PREFIX } from "../../src/shared/utils/packagingBilling.js";
import {
  centralRecord,
  centralRecords,
  commitDomainChanges,
  requirePermission,
  requireWebSession,
  type DomainChange,
  type WebSession
} from "./domainMutations.js";
import { resolveRate } from "./operationalManagement.js";

// Lancamento, edicao, confirmacao, cancelamento e exclusao de notas pelo site.
// As regras espelham AppRepository (createFiscalDocument, updateFiscalDocument,
// confirmFiscalDocument, cancelFiscalDocument, deleteFiscalDocument e
// updateOperationManualRate) para que site e aplicativo produzam as mesmas
// linhas na revisao central.

type Row = Record<string, unknown>;

const decimalText = z.union([z.string(), z.number()]).transform((value, context) => {
  try {
    return normalizeDecimalText(String(value));
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Quantidade invalida." });
    return z.NEVER;
  }
});

const itemSchema = z.object({
  productId: z.string().min(1),
  description: z.string().trim().max(240).optional().default(""),
  quantity: decimalText,
  unit: z.enum(["SACK", "KG", "TON", "UNIT"]),
  totalAmountCents: z.number().int().min(0).default(0),
  sacks: decimalText.nullable().optional()
});

const createSchema = z.object({
  organizationId: z.string().min(1),
  ownLegalEntityId: z.string().min(1),
  operationType: z.enum(["SALE", "PURCHASE"]),
  operationScope: z.enum(["INTERNAL", "EXTERNAL"]),
  responsiblePartnerId: z.string().min(1),
  partnerLegalEntityId: z.string().min(1).nullable().optional(),
  documentNumber: z.string().trim().min(1).max(60),
  series: z.string().trim().max(20).nullable().optional(),
  issueDate: z.string().date(),
  accessKey: z.string().trim().regex(/^\d{44}$/).nullable().optional(),
  totalAmountCents: z.number().int().min(0),
  hasFinancialService: z.boolean().default(false),
  contractNumber: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  items: z.array(itemSchema).min(1).max(50),
  confirm: z.boolean().default(false)
});

const updateSchema = z.object({
  responsiblePartnerId: z.string().min(1),
  partnerLegalEntityId: z.string().min(1).nullable().optional(),
  documentNumber: z.string().trim().min(1).max(60),
  series: z.string().trim().max(20).nullable().optional(),
  issueDate: z.string().date(),
  accessKey: z.string().trim().regex(/^\d{44}$/).nullable().optional(),
  totalAmountCents: z.number().int().min(0),
  hasFinancialService: z.boolean(),
  contractNumber: z.string().trim().max(200).nullable().optional(),
  billingObservations: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  resolvePendingIssues: z.boolean().default(false)
});

const reasonSchema = z.object({ reason: z.string().trim().min(3).max(2000) });
const manualRateSchema = z.object({
  manualRateValueCents: z.number().int().min(0).max(100_000_000),
  reason: z.string().trim().min(3).max(2000)
});

const active = (row: Row | null | undefined): boolean => Boolean(row) && row!.is_active !== 0 && row!.is_active !== false;
const text = (value: unknown): string => String(value ?? "");
const blank = (value: string | null | undefined): string | null => value?.trim() || null;
const numberValue = (value: unknown): number => {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};
const decimalOf = (value: number): string => normalizeDecimalText(Number(value.toFixed(6)).toString());

class HttpError extends Error {
  constructor(readonly statusCode: number, readonly code: string, message: string) { super(message); }
}

async function recordsWhere(pool: pg.Pool, table: string, field: string, values: string[]): Promise<Row[]> {
  if (values.length === 0) return [];
  const result = await pool.query<{ row_data: Row }>(
    "SELECT row_data FROM central_records WHERE table_name = $1 AND deleted = false AND row_data->>$2 = ANY($3::text[])",
    [table, field, values]
  );
  return result.rows.map((row) => row.row_data);
}

async function partnerRoles(pool: pg.Pool, partnerId: string): Promise<string[]> {
  return (await recordsWhere(pool, "business_partner_roles", "business_partner_id", [partnerId])).map((row) => text(row.role));
}

async function assertResponsible(pool: pg.Pool, partnerId: string, operationType: "SALE" | "PURCHASE"): Promise<Row> {
  const partner = await centralRecord(pool, "business_partners", partnerId);
  if (!partner || !active(partner)) throw new HttpError(404, "PARTNER_NOT_FOUND", "Cliente ou fornecedor responsavel nao encontrado.");
  const roles = await partnerRoles(pool, partnerId);
  const role = operationType === "PURCHASE" ? "SUPPLIER" : "CLIENT";
  if (!roles.includes(role)) {
    throw new HttpError(409, "PARTNER_ROLE", operationType === "PURCHASE"
      ? "Somente cadastros com papel Fornecedor podem ser responsaveis por uma compra."
      : "Somente cadastros com papel Cliente/corretor podem ser responsaveis por uma venda.");
  }
  return partner;
}

function itemSacks(item: z.infer<typeof itemSchema>, product: Row): string | null {
  if (item.sacks) return item.sacks;
  const quantity = numberValue(item.quantity);
  const weight = numberValue(product.default_sack_weight_kg) || 60;
  if (item.unit === "SACK") return item.quantity;
  if (item.unit === "KG") return decimalOf(quantity / weight);
  if (item.unit === "TON") return decimalOf(quantity * 1000 / weight);
  return null;
}

type DocumentBundle = { document: Row; items: Row[]; operations: Row[] };

async function loadDocument(pool: pg.Pool, id: string): Promise<DocumentBundle> {
  const document = await centralRecord(pool, "fiscal_documents", id);
  if (!document) throw new HttpError(404, "NOT_FOUND", "Nota fiscal nao encontrada.");
  const [items, operations] = await Promise.all([
    recordsWhere(pool, "fiscal_document_items", "fiscal_document_id", [id]),
    recordsWhere(pool, "operations", "fiscal_document_id", [id])
  ]);
  return { document, items, operations };
}

async function hasActiveDeal(pool: pg.Pool, documentId: string, operationIds: string[]): Promise<boolean> {
  const links = [
    ...await recordsWhere(pool, "deal_confirmation_fiscal_documents", "fiscal_document_id", [documentId]),
    ...await recordsWhere(pool, "deal_confirmation_operations", "operation_id", operationIds)
  ];
  for (const link of links) {
    const deal = await centralRecord(pool, "deal_confirmations", text(link.deal_confirmation_id));
    if (deal && text(deal.status) !== "CANCELLED") return true;
  }
  return false;
}

function requiresContract(...partners: Array<Row | null>): boolean {
  return partners.some((partner) => Boolean(partner) && (partner!.requires_contract === 1 || partner!.requires_contract === true));
}

async function authorize(pool: pg.Pool, session: WebSession, reply: FastifyReply, document: Row): Promise<boolean> {
  return requirePermission(pool, session, reply, "operations.manage", text(document.organization_id), text(document.own_legal_entity_id));
}

async function send(reply: FastifyReply, action: () => Promise<unknown>): Promise<unknown> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof HttpError) return reply.code(error.statusCode).send({ error: error.code, message: error.message });
    throw error;
  }
}

function rateHistory(operation: Row, newRuleId: unknown, newRate: number, newAmount: number, reason: string, now: string): DomainChange {
  const id = randomUUID();
  return {
    table: "operation_rate_history", key: id, operation: "UPSERT", data: {
      id, operation_id: operation.id,
      previous_service_rate_rule_id: operation.service_rate_rule_id ?? null,
      previous_rate_value_cents: operation.applied_rate_value_cents ?? null,
      previous_service_amount_cents: operation.service_amount_cents ?? null,
      new_service_rate_rule_id: newRuleId ?? null, new_rate_value_cents: newRate, new_service_amount_cents: newAmount,
      reason, changed_at: now
    }
  };
}

export function registerInvoiceManagementRoutes(app: FastifyInstance, pool: pg.Pool): void {
  app.get("/v1/manage/invoices/:id", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    return send(reply, async () => {
      const { document, items, operations } = await loadDocument(pool, id);
      if (!(await authorize(pool, session, reply, document))) return;
      const productIds = [...new Set([...items, ...operations].map((row) => text(row.product_id)).filter(Boolean))];
      const partnerIds = [...new Set([document.responsible_partner_id, document.secondary_responsible_partner_id, ...operations.map((row) => row.responsible_partner_id)].map(text).filter(Boolean))];
      const [products, partners, ownEntity, partnerEntity] = await Promise.all([
        recordsWhere(pool, "products", "id", productIds), recordsWhere(pool, "business_partners", "id", partnerIds),
        centralRecord(pool, "legal_entities", text(document.own_legal_entity_id)),
        document.partner_legal_entity_id ? centralRecord(pool, "partner_legal_entities", text(document.partner_legal_entity_id)) : Promise.resolve(null)
      ]);
      const productName = new Map(products.map((row) => [text(row.id), text(row.name)]));
      const partnerName = new Map(partners.map((row) => [text(row.id), text(row.display_name)]));
      const linked = operations.some((row) => text(row.billing_status) !== "UNBILLED" || text(row.purchase_settlement_status || "UNSETTLED") !== "UNSETTLED");
      const deal = await hasActiveDeal(pool, id, operations.map((row) => text(row.id)));
      const status = text(document.status);
      return {
        document: {
          id, organizationId: text(document.organization_id), ownLegalEntityId: text(document.own_legal_entity_id),
          ownLegalEntityName: text(ownEntity?.trade_name ?? ownEntity?.legal_name), direction: text(document.direction),
          responsiblePartnerId: text(document.responsible_partner_id), responsiblePartnerName: partnerName.get(text(document.responsible_partner_id)) ?? null,
          partnerLegalEntityId: document.partner_legal_entity_id ?? null, partnerLegalEntityName: partnerEntity ? text(partnerEntity.legal_name) : null,
          documentNumber: text(document.document_number), series: document.series ?? null, issueDate: text(document.issue_date),
          accessKey: document.access_key ?? null, totalAmountCents: numberValue(document.total_amount_cents), status,
          source: text(document.source), hasPendingIssues: Boolean(document.has_pending_issues), pendingNotes: document.pending_notes ?? null,
          duplicateWarning: document.duplicate_warning ?? null, notes: document.notes ?? null, contractNumber: document.contract_number ?? null,
          billingObservations: document.billing_observations ?? null, hasFinancialService: Boolean(document.has_financial_service),
          cancelReason: document.cancel_reason ?? null, confirmedAt: document.confirmed_at ?? null, canceledAt: document.canceled_at ?? null
        },
        items: items.map((row) => ({
          id: text(row.id), productId: row.product_id ?? null, productName: productName.get(text(row.product_id)) ?? null,
          description: text(row.description), quantity: text(row.quantity_decimal), unit: text(row.unit),
          totalAmountCents: numberValue(row.total_amount_cents), sacks: row.sacks_quantity_decimal ?? null
        })),
        operations: operations.map((row) => ({
          id: text(row.id), operationType: text(row.operation_type), operationScope: text(row.operation_scope), status: text(row.status),
          productName: productName.get(text(row.product_id)) ?? null, responsiblePartnerName: partnerName.get(text(row.responsible_partner_id)) ?? null,
          quantitySacks: text(row.quantity_sacks_decimal), rateCents: numberValue(row.applied_rate_value_cents),
          amountCents: numberValue(row.service_amount_cents), manualRate: Boolean(row.rate_was_manually_overridden),
          manualReason: row.manual_override_reason ?? null, billingStatus: text(row.billing_status),
          settlementStatus: text(row.purchase_settlement_status || "UNSETTLED")
        })),
        permissions: {
          canEdit: status !== "CANCELED" && !linked,
          canConfirm: status !== "CANCELED" && status !== "CONFIRMED",
          canCancel: status !== "CANCELED" && !linked,
          canDelete: !linked && !deal,
          lockedReason: linked ? "Nota vinculada a cobranca ou acerto de entrada." : deal ? "Nota vinculada a confirmacao de negocio ativa." : null
        }
      };
    });
  });

  app.post("/v1/manage/invoices", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const input = createSchema.parse(request.body);
    return send(reply, async () => {
      if (!(await requirePermission(pool, session, reply, "operations.manage", input.organizationId, input.ownLegalEntityId))) return;
      const ownEntity = await centralRecord(pool, "legal_entities", input.ownLegalEntityId);
      if (!ownEntity || !active(ownEntity) || text(ownEntity.organization_id) !== input.organizationId) {
        throw new HttpError(404, "OWN_ENTITY_NOT_FOUND", "Empresa propria nao encontrada nesta organizacao.");
      }
      const partner = await assertResponsible(pool, input.responsiblePartnerId, input.operationType);
      if (input.partnerLegalEntityId && !(await centralRecord(pool, "partner_legal_entities", input.partnerLegalEntityId))) {
        throw new HttpError(404, "COUNTERPARTY_NOT_FOUND", "Empresa da contraparte nao encontrada.");
      }
      if (input.accessKey && (await recordsWhere(pool, "fiscal_documents", "access_key", [input.accessKey])).length) {
        throw new HttpError(409, "DUPLICATE_ACCESS_KEY", "Chave de acesso ja cadastrada.");
      }
      if (input.confirm && requiresContract(partner) && !blank(input.contractNumber)) {
        throw new HttpError(409, "CONTRACT_REQUIRED", "Informe o contrato exigido pelo cliente antes de confirmar.");
      }
      const products = await recordsWhere(pool, "products", "id", [...new Set(input.items.map((item) => item.productId))]);
      const productMap = new Map(products.filter(active).map((row) => [text(row.id), row]));
      if (input.items.some((item) => !productMap.has(item.productId))) throw new HttpError(404, "PRODUCT_NOT_FOUND", "Um dos produtos selecionados nao foi encontrado.");
      const sameNumber = (await recordsWhere(pool, "fiscal_documents", "document_number", [input.documentNumber]))
        .find((row) => text(row.organization_id) === input.organizationId && text(row.responsible_partner_id) === input.responsiblePartnerId
          && text(row.series ?? "") === text(blank(input.series) ?? "") && text(row.issue_date) === input.issueDate
          && numberValue(row.total_amount_cents) === input.totalAmountCents);
      const duplicateWarning = !input.accessKey && sameNumber ? `Possivel duplicidade com a nota ${text(sameNumber.id)}.` : null;

      const rules = await centralRecords(pool, input.operationType === "SALE" ? "service_rate_rules" : "purchase_rate_rules");
      const documentId = randomUUID();
      const now = new Date().toISOString();
      const changes: DomainChange[] = [];
      const pendingReasons: string[] = [];
      const operationRows: Row[] = [];
      for (const [index, item] of input.items.entries()) {
        const product = productMap.get(item.productId)!;
        const itemId = randomUUID();
        const operationId = randomUUID();
        const sacks = itemSacks(item, product);
        if (!sacks || numberValue(sacks) <= 0) pendingReasons.push(`Informe as sacas do item ${index + 1}`);
        const resolved = resolveRate(rules, input.operationType, input.organizationId, input.responsiblePartnerId, input.ownLegalEntityId,
          input.partnerLegalEntityId ?? null, item.productId, input.operationScope, input.issueDate, input.operationType === "SALE" && input.hasFinancialService);
        if (resolved.status === "conflict") throw new HttpError(409, "RATE_CONFLICT", input.operationType === "SALE" ? "Conflito ao resolver regra por saca." : "Conflito ao resolver preco de compra por saca.");
        if (resolved.status === "missing") pendingReasons.push(`Sem tarifa para o item ${index + 1}`);
        const quantitySacks = sacks ?? "0";
        changes.push({
          table: "fiscal_document_items", key: itemId, operation: "UPSERT", data: {
            id: itemId, fiscal_document_id: documentId, product_id: item.productId, description: item.description || text(product.name) || "Produto",
            quantity_decimal: item.quantity, unit: item.unit, unit_price_decimal: decimalOf(numberValue(item.quantity) > 0 ? item.totalAmountCents / 100 / numberValue(item.quantity) : 0),
            total_amount_cents: item.totalAmountCents, sacks_quantity_decimal: sacks, created_at: now, updated_at: now
          }
        });
        const operationRow: Row = {
          id: operationId, fiscal_document_id: documentId, fiscal_document_item_id: itemId, organization_id: input.organizationId,
          own_legal_entity_id: input.ownLegalEntityId, responsible_partner_id: input.responsiblePartnerId, product_id: item.productId,
          operation_type: input.operationType, operation_scope: input.operationScope, operation_date: input.issueDate,
          quantity_sacks_decimal: quantitySacks, gross_quantity_sacks_decimal: quantitySacks,
          service_rate_rule_id: input.operationType === "SALE" ? resolved.rule?.id ?? null : null,
          purchase_rate_rule_id: input.operationType === "PURCHASE" ? resolved.rule?.id ?? null : null,
          applied_rate_value_cents: resolved.rateCents, service_amount_cents: multiplyDecimalByCents(quantitySacks, resolved.rateCents),
          rate_was_manually_overridden: 0, manual_rate_value_cents: null, manual_override_reason: null, notes: null,
          status: resolved.status === "missing" ? "PENDING" : "DRAFT", source: "MANUAL", import_job_id: null, import_row_id: null,
          xml_import_job_id: null, classification_rule_id: null, billing_status: "UNBILLED", client_charge_id: null,
          purchase_settlement_status: "UNSETTLED", account_payable_id: null, created_at: now, updated_at: now
        };
        operationRows.push(operationRow);
        changes.push({ table: "operations", key: operationId, operation: "UPSERT", data: operationRow });
      }
      const pending = pendingReasons.length > 0;
      if (input.confirm && pending) throw new HttpError(409, "PENDING_ISSUES", `Resolva antes de confirmar: ${pendingReasons.join("; ")}.`);
      const status = input.confirm ? "CONFIRMED" : pending ? "PENDING" : "DRAFT";
      if (input.confirm) for (const row of operationRows) row.status = "CONFIRMED";
      changes.unshift({
        table: "fiscal_documents", key: documentId, operation: "UPSERT", data: {
          id: documentId, organization_id: input.organizationId, own_legal_entity_id: input.ownLegalEntityId,
          responsible_partner_id: input.responsiblePartnerId, partner_legal_entity_id: input.partnerLegalEntityId ?? null,
          secondary_responsible_partner_id: null, secondary_operation_type: null, document_type: "MANUAL_INVOICE",
          access_key: input.accessKey ?? null, document_number: input.documentNumber, series: blank(input.series),
          issue_date: input.issueDate, total_amount_cents: input.totalAmountCents, status, has_pending_issues: pending ? 1 : 0,
          pending_notes: pending ? pendingReasons.join("; ") : null, duplicate_warning: duplicateWarning, notes: blank(input.notes),
          confirmed_at: input.confirm ? now : null, canceled_at: null, cancel_reason: null, source: "MANUAL",
          import_job_id: null, import_row_id: null, xml_file_path: null, xml_file_hash: null, protocol_number: null, protocol_date: null,
          authorization_status_code: null, authorization_status_message: null, xml_import_job_id: null, merged_from_source: null, merged_at: null,
          direction: input.operationType === "PURCHASE" ? "INBOUND" : "OUTBOUND", fiscal_snapshot_json: null,
          contract_number: blank(input.contractNumber), billing_observations: null, freight_dae_reference: null, freight_dae_amount_cents: 0,
          has_financial_service: input.operationType === "SALE" && input.hasFinancialService ? 1 : 0, created_at: now, updated_at: now
        }
      });
      const revision = await commitDomainChanges(pool, session, "WEB_INVOICE_CREATED", "fiscal_document", documentId, changes, {
        organizationId: input.organizationId, legalEntityId: input.ownLegalEntityId, itemCount: input.items.length, status
      });
      return reply.code(201).send({ id: documentId, revision, status, pendingNotes: pending ? pendingReasons.join("; ") : null, duplicateWarning });
    });
  });

  app.put("/v1/manage/invoices/:id", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = updateSchema.parse(request.body);
    return send(reply, async () => {
      const { document, operations } = await loadDocument(pool, id);
      if (!(await authorize(pool, session, reply, document))) return;
      if (text(document.status) === "CANCELED") throw new HttpError(409, "DOCUMENT_CANCELED", "Nota cancelada nao pode ser editada.");
      if (operations.some((row) => text(row.billing_status) !== "UNBILLED" || text(row.purchase_settlement_status || "UNSETTLED") !== "UNSETTLED")) {
        throw new HttpError(409, "DOCUMENT_LINKED", "Nota vinculada a cobranca/acerto. Libere o vinculo antes de editar.");
      }
      const operationType = text(document.direction) === "INBOUND" ? "PURCHASE" as const : "SALE" as const;
      const previousPartnerId = text(document.responsible_partner_id);
      const reassigning = input.responsiblePartnerId !== previousPartnerId;
      const partnerLegalEntityId = input.partnerLegalEntityId === undefined ? (document.partner_legal_entity_id ?? null) : input.partnerLegalEntityId;
      if (reassigning && (input.issueDate !== text(document.issue_date) || partnerLegalEntityId !== (document.partner_legal_entity_id ?? null))) {
        throw new HttpError(409, "REASSIGN_SEPARATELY", "Corrija o responsavel separadamente dos demais dados comerciais.");
      }
      if (reassigning) await assertResponsible(pool, input.responsiblePartnerId, operationType);
      if (input.accessKey && input.accessKey !== document.access_key
        && (await recordsWhere(pool, "fiscal_documents", "access_key", [input.accessKey])).some((row) => row.id !== id)) {
        throw new HttpError(409, "DUPLICATE_ACCESS_KEY", "Chave de acesso ja cadastrada.");
      }
      const hasFinancialService = operationType === "SALE" && input.hasFinancialService;
      const financialServiceChanged = hasFinancialService !== Boolean(document.has_financial_service);
      const now = new Date().toISOString();
      const changes: DomainChange[] = [];
      const updatedOperations = new Map<string, Row>();
      if (reassigning || financialServiceChanged) {
        const rules = await centralRecords(pool, operationType === "SALE" ? "service_rate_rules" : "purchase_rate_rules");
        for (const operation of operations.filter((row) => text(row.responsible_partner_id) === previousPartnerId)) {
          if (text(operation.manual_override_reason).startsWith(PACKAGING_OVERRIDE_PREFIX)) {
            updatedOperations.set(text(operation.id), { ...operation, responsible_partner_id: input.responsiblePartnerId, updated_at: now });
            continue;
          }
          const kind = text(operation.operation_type) === "PURCHASE" ? "PURCHASE" as const : "SALE" as const;
          const resolved = resolveRate(rules, kind, text(document.organization_id), input.responsiblePartnerId, text(operation.own_legal_entity_id),
            partnerLegalEntityId ? text(partnerLegalEntityId) : null, text(operation.product_id), text(operation.operation_scope) as "INTERNAL" | "EXTERNAL",
            text(operation.operation_date), hasFinancialService);
          if (resolved.status === "conflict") throw new HttpError(409, "RATE_CONFLICT", "O novo responsavel possui tarifas conflitantes. Ajuste as regras antes de trocar.");
          const amount = multiplyDecimalByCents(text(operation.quantity_sacks_decimal) || "0", resolved.rateCents);
          const reason = reassigning
            ? `Responsavel alterado: ${previousPartnerId} -> ${input.responsiblePartnerId}. Tarifa recalculada para o novo responsavel.`
            : `Condicao de financeiro alterada para ${hasFinancialService ? "com financeiro" : "sem financeiro"}.`;
          changes.push(rateHistory(operation, resolved.rule?.id, resolved.rateCents, amount, reason, now));
          updatedOperations.set(text(operation.id), {
            ...operation, responsible_partner_id: input.responsiblePartnerId,
            service_rate_rule_id: kind === "SALE" ? resolved.rule?.id ?? null : null,
            purchase_rate_rule_id: kind === "PURCHASE" ? resolved.rule?.id ?? null : null,
            applied_rate_value_cents: resolved.rateCents, service_amount_cents: amount,
            rate_was_manually_overridden: 0, manual_rate_value_cents: null, manual_override_reason: null, updated_at: now
          });
        }
      }
      // Como no aplicativo: trocar o responsavel nao reabre a nota, mas mudar a
      // condicao de financeiro exige nova confirmacao comercial.
      const reopen = financialServiceChanged && text(document.status) === "CONFIRMED";
      if (reopen) {
        for (const operation of operations) {
          const current = updatedOperations.get(text(operation.id)) ?? operation;
          updatedOperations.set(text(operation.id), { ...current, status: "DRAFT", updated_at: now });
        }
      }
      for (const [key, data] of updatedOperations) changes.push({ table: "operations", key, operation: "UPSERT", data });
      const resolvePending = input.resolvePendingIssues;
      changes.unshift({
        table: "fiscal_documents", key: id, operation: "UPSERT", data: {
          ...document, responsible_partner_id: input.responsiblePartnerId, partner_legal_entity_id: partnerLegalEntityId,
          document_number: input.documentNumber, series: blank(input.series), issue_date: input.issueDate,
          access_key: input.accessKey === undefined ? document.access_key ?? null : input.accessKey,
          total_amount_cents: input.totalAmountCents, contract_number: input.contractNumber === undefined ? document.contract_number ?? null : blank(input.contractNumber),
          billing_observations: input.billingObservations === undefined ? document.billing_observations ?? null : blank(input.billingObservations),
          notes: input.notes === undefined ? document.notes ?? null : blank(input.notes), has_financial_service: hasFinancialService ? 1 : 0,
          has_pending_issues: resolvePending ? 0 : document.has_pending_issues ?? 0, pending_notes: resolvePending ? null : document.pending_notes ?? null,
          status: reopen ? "DRAFT" : resolvePending && text(document.status) === "PENDING" ? "DRAFT" : document.status,
          confirmed_at: reopen ? null : document.confirmed_at ?? null, updated_at: now
        }
      });
      const revision = await commitDomainChanges(pool, session, "WEB_INVOICE_UPDATED", "fiscal_document", id, changes, {
        organizationId: text(document.organization_id), legalEntityId: text(document.own_legal_entity_id), reassigning, financialServiceChanged, resolvePending
      });
      return { id, revision, reopened: reopen };
    });
  });

  app.post("/v1/manage/invoices/:id/confirm", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    return send(reply, async () => {
      const { document, items, operations } = await loadDocument(pool, id);
      if (!(await authorize(pool, session, reply, document))) return;
      if (text(document.status) === "CANCELED") throw new HttpError(409, "DOCUMENT_CANCELED", "Nota cancelada nao pode ser confirmada.");
      const [responsible, secondary] = await Promise.all([
        centralRecord(pool, "business_partners", text(document.responsible_partner_id)),
        document.secondary_responsible_partner_id ? centralRecord(pool, "business_partners", text(document.secondary_responsible_partner_id)) : Promise.resolve(null)
      ]);
      if (requiresContract(responsible, secondary) && !blank(text(document.contract_number))) {
        throw new HttpError(409, "CONTRACT_REQUIRED", "Informe o contrato exigido pelo cliente antes de confirmar.");
      }
      if (document.has_pending_issues) throw new HttpError(409, "PENDING_ISSUES", "Resolva as pendencias antes de confirmar.");
      if (items.length === 0 || operations.length === 0) throw new HttpError(409, "EMPTY_DOCUMENT", "Nota precisa ter itens e operacoes.");
      const now = new Date().toISOString();
      const changes: DomainChange[] = [
        { table: "fiscal_documents", key: id, operation: "UPSERT", data: { ...document, status: "CONFIRMED", confirmed_at: now, updated_at: now } },
        ...operations.map((row) => ({ table: "operations", key: text(row.id), operation: "UPSERT" as const, data: { ...row, status: "CONFIRMED", updated_at: now } }))
      ];
      const revision = await commitDomainChanges(pool, session, "WEB_INVOICE_CONFIRMED", "fiscal_document", id, changes, {
        organizationId: text(document.organization_id), legalEntityId: text(document.own_legal_entity_id)
      });
      return { id, revision, status: "CONFIRMED" };
    });
  });

  app.post("/v1/manage/invoices/:id/cancel", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = reasonSchema.parse(request.body);
    return send(reply, async () => {
      const { document, operations } = await loadDocument(pool, id);
      if (!(await authorize(pool, session, reply, document))) return;
      if (text(document.status) === "CANCELED") throw new HttpError(409, "DOCUMENT_CANCELED", "A nota ja esta cancelada.");
      // O aplicativo aceita cancelar nota ja cobrada porque o cancelamento pode
      // vir da SEFAZ. Pelo site, exige liberar a cobranca/acerto antes, para
      // nao deixar cobranca emitida com nota cancelada.
      if (operations.some((row) => text(row.billing_status) !== "UNBILLED" || text(row.purchase_settlement_status || "UNSETTLED") !== "UNSETTLED")) {
        throw new HttpError(409, "DOCUMENT_LINKED", "Nota vinculada a cobranca/acerto. Cancele ou libere a cobranca antes de cancelar a nota.");
      }
      const now = new Date().toISOString();
      const changes: DomainChange[] = [
        { table: "fiscal_documents", key: id, operation: "UPSERT", data: { ...document, status: "CANCELED", canceled_at: now, cancel_reason: input.reason, updated_at: now } },
        ...operations.map((row) => ({ table: "operations", key: text(row.id), operation: "UPSERT" as const, data: { ...row, status: "CANCELED", updated_at: now } }))
      ];
      const revision = await commitDomainChanges(pool, session, "WEB_INVOICE_CANCELED", "fiscal_document", id, changes, {
        organizationId: text(document.organization_id), legalEntityId: text(document.own_legal_entity_id), reason: input.reason
      });
      return { id, revision, status: "CANCELED" };
    });
  });

  app.delete("/v1/manage/invoices/:id", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    return send(reply, async () => {
      const { document, items, operations } = await loadDocument(pool, id);
      if (!(await authorize(pool, session, reply, document))) return;
      const operationIds = operations.map((row) => text(row.id));
      if (operations.some((row) => row.client_charge_id || text(row.billing_status) !== "UNBILLED")) {
        throw new HttpError(409, "DOCUMENT_LINKED", "Nota ja vinculada a cobranca. Cancele/libere a cobranca antes de excluir.");
      }
      if (await hasActiveDeal(pool, id, operationIds)) {
        throw new HttpError(409, "ACTIVE_DEAL", "Nota ja vinculada a confirmacao de negocio ativa. Cancele a confirmacao ou remova o vinculo antes de excluir.");
      }
      // Linhas que apontam para a nota e nao podem sumir junto: excluir
      // deixaria a sincronizacao dos computadores com referencia quebrada.
      const [chargeLinks, payableLinks, adjustments, reconciliations] = await Promise.all([
        recordsWhere(pool, "client_charge_operations", "operation_id", operationIds),
        recordsWhere(pool, "account_payable_operations", "operation_id", operationIds),
        recordsWhere(pool, "client_charge_adjustments", "source_fiscal_document_id", [id]),
        recordsWhere(pool, "transfer_reconciliation_invoices", "fiscal_document_id", [id])
      ]);
      if (chargeLinks.length || payableLinks.length || adjustments.length || reconciliations.length) {
        throw new HttpError(409, "DOCUMENT_REFERENCED", "A nota aparece no historico de cobrancas, acertos ou conferencias de repasse. Cancele a nota em vez de excluir.");
      }
      const [history, alertIgnores, returns, events, merges, dealDocuments, dealOperations] = await Promise.all([
        recordsWhere(pool, "operation_rate_history", "operation_id", operationIds),
        recordsWhere(pool, "billing_alert_ignores", "operation_id", operationIds),
        recordsWhere(pool, "fiscal_document_returns", "fiscal_document_id", [id]),
        recordsWhere(pool, "fiscal_document_events", "fiscal_document_id", [id]),
        recordsWhere(pool, "fiscal_document_merge_history", "fiscal_document_id", [id]),
        recordsWhere(pool, "deal_confirmation_fiscal_documents", "fiscal_document_id", [id]),
        recordsWhere(pool, "deal_confirmation_operations", "operation_id", operationIds)
      ]);
      const removal = (table: string, rows: Row[]): DomainChange[] => rows.map((row) => ({ table, key: text(row.id), operation: "DELETE" as const }));
      const changes: DomainChange[] = [
        ...removal("operation_rate_history", history), ...removal("billing_alert_ignores", alertIgnores),
        ...removal("deal_confirmation_operations", dealOperations), ...removal("deal_confirmation_fiscal_documents", dealDocuments),
        ...removal("fiscal_document_returns", returns), ...removal("fiscal_document_events", events),
        ...removal("fiscal_document_merge_history", merges), ...removal("operations", operations),
        ...removal("fiscal_document_items", items), { table: "fiscal_documents", key: id, operation: "DELETE" }
      ];
      const revision = await commitDomainChanges(pool, session, "WEB_INVOICE_DELETED", "fiscal_document", id, changes, {
        organizationId: text(document.organization_id), legalEntityId: text(document.own_legal_entity_id),
        documentNumber: text(document.document_number), accessKey: document.access_key ?? null
      });
      return { id, revision, deleted: true };
    });
  });

  app.put("/v1/manage/operations/:id/rate", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = manualRateSchema.parse(request.body);
    return send(reply, async () => {
      const operation = await centralRecord(pool, "operations", id);
      if (!operation) throw new HttpError(404, "NOT_FOUND", "Operacao nao encontrada.");
      const { document, operations } = await loadDocument(pool, text(operation.fiscal_document_id));
      if (!(await authorize(pool, session, reply, document))) return;
      if (text(operation.status) === "CANCELED" || text(operation.billing_status) !== "UNBILLED" || text(operation.purchase_settlement_status || "UNSETTLED") !== "UNSETTLED") {
        throw new HttpError(409, "OPERATION_LOCKED", "Operacao cancelada ou vinculada a cobranca/acerto nao pode ter a tarifa alterada.");
      }
      if (isPackagingDocument({ documentNotes: text(document.notes) || null, overrideReasons: operations.map((row) => text(row.manual_override_reason) || null) })) {
        throw new HttpError(409, "PACKAGING_DOCUMENT", "Remessa de sacaria: informe o valor por unidade pelo aplicativo por enquanto.");
      }
      const now = new Date().toISOString();
      const amount = multiplyDecimalByCents(text(operation.quantity_sacks_decimal) || "0", input.manualRateValueCents);
      const changes: DomainChange[] = [
        {
          table: "operations", key: id, operation: "UPSERT", data: {
            ...operation, applied_rate_value_cents: input.manualRateValueCents, service_amount_cents: amount,
            rate_was_manually_overridden: 1, manual_rate_value_cents: input.manualRateValueCents, manual_override_reason: input.reason, updated_at: now
          }
        },
        rateHistory(operation, null, input.manualRateValueCents, amount, input.reason, now)
      ];
      const revision = await commitDomainChanges(pool, session, "WEB_OPERATION_RATE_CHANGED", "operation", id, changes, {
        organizationId: text(document.organization_id), legalEntityId: text(document.own_legal_entity_id),
        previousRateCents: numberValue(operation.applied_rate_value_cents), newRateCents: input.manualRateValueCents
      });
      return { id, revision, rateCents: input.manualRateValueCents, amountCents: amount };
    });
  });
}
