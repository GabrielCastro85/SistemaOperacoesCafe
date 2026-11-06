import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import type pg from "pg";
import { z } from "zod";
import {
  mapBusinessPartner, mapBusinessPartnerLegalEntity, mapClientCharge, mapClientChargeAdjustment, mapClientChargeOperation,
  mapClientCreditAllocation, mapClientPayment, mapClientPaymentAllocation, mapLegalEntity, mapOrganization
} from "../../electron/main/database/mappers.js";
import { buildChargePdf, buildChargeSummarySvg, buildChargeWorkbook, type ChargeDocumentsInput } from "../../electron/main/services/chargeDocuments.js";
import { buildChargeControlPrintHtml, buildChargeControlWorkbook, type ChargeControlRow } from "../../electron/main/services/chargeControlWorkbook.js";
import type { ClientChargeDetail } from "../../src/shared/types/domain.js";
import { calculateChargeCte, readChargeCte } from "../../src/shared/utils/chargeCte.js";
import { chargePeriodLabel } from "../../src/shared/utils/chargeLabel.js";
import { centralRecord, centralRecords, commitDomainChanges, requirePermission, requireWebSession, type DomainChange, type WebSession } from "./domainMutations.js";
import { rowsWhere } from "./fiscalEvents.js";
import { refreshedOperationSnapshots } from "./viewer.js";

// Cobrancas e conta-corrente pelo site. Cada acao carrega a cobranca com as
// linhas ligadas a ela, aplica em memoria a mesma regra de AppRepository
// (createClientChargeDraft, reserveOperationsForCharge, releaseOperations,
// addChargeAdjustment, applyCredit, submitClientChargeForReview,
// issueClientCharge, cancelClientCharge, deleteClientCharge,
// recalculateClientCharge, allocatePayment...) e grava so o que mudou numa
// revisao central auditada.
//
// Diferencas deliberadas: as versoes de documento (charge_document_versions)
// sao arquivos locais de cada computador e nao sincronizam; o site gera PDF,
// Excel e imagem na hora. Remover um ajuste que veio de um credito da
// conta-corrente devolve o saldo ao lancamento (o app hoje so apaga o ajuste).

type Row = Record<string, unknown>;
const text = (value: unknown): string => String(value ?? "");
const blank = (value: unknown): string | null => text(value).trim() || null;
const cents = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};
const today = (): string => new Date().toISOString().slice(0, 10);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida.");
const EDITABLE = ["DRAFT", "PENDING_REVIEW"];
const ADJUSTABLE = ["DRAFT", "PENDING_REVIEW", "ISSUED", "OVERDUE"];
const PAYABLE = ["ISSUED", "PARTIALLY_PAID", "OVERDUE"];

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

// Linhas de varias tabelas com o estado original, para gravar so a diferenca.
class RowSet {
  private readonly rows = new Map<string, Map<string, Row>>();
  private readonly original = new Map<string, string>();
  private readonly removed: Array<{ table: string; id: string }> = [];
  private readonly order: string[] = [];

  track(table: string, row: Row): Row {
    const key = `${table}\u0000${text(row.id)}`;
    const current = this.rows.get(table)?.get(text(row.id));
    if (current) return current;
    if (!this.original.has(key)) this.original.set(key, JSON.stringify(row));
    return this.put(table, { ...row });
  }
  get(table: string, id: string): Row | undefined { return this.rows.get(table)?.get(id); }
  all(table: string): Row[] { return [...(this.rows.get(table)?.values() ?? [])]; }
  put(table: string, row: Row): Row {
    if (!this.rows.has(table)) { this.rows.set(table, new Map()); this.order.push(table); }
    this.rows.get(table)!.set(text(row.id), row);
    return row;
  }
  remove(table: string, id: string): void {
    if (!this.rows.get(table)?.delete(id)) return;
    if (this.original.has(`${table}\u0000${id}`)) this.removed.push({ table, id });
  }
  changes(first: string[]): DomainChange[] {
    const tables = [...first.filter((table) => this.rows.has(table)), ...this.order.filter((table) => !first.includes(table))];
    const upserts: DomainChange[] = [];
    for (const table of tables) {
      for (const row of this.rows.get(table)!.values()) {
        if (this.original.get(`${table}\u0000${text(row.id)}`) !== JSON.stringify(row)) upserts.push({ table, key: text(row.id), operation: "UPSERT", data: row });
      }
    }
    // Na ordem em que foram removidas: quem remove apaga os filhos antes do pai.
    const deletes = this.removed.map(({ table, id }): DomainChange => ({ table, key: id, operation: "DELETE" }));
    return [...upserts, ...deletes];
  }
}

const CHARGE_CHILDREN = [
  "client_charge_operations", "client_charge_adjustments", "client_credit_allocations",
  "client_payment_allocations", "charge_status_history", "client_ledger_entries"
] as const;
const WRITE_ORDER = [
  "client_payments", "client_charges", "client_charge_operations", "operations", "client_ledger_entries",
  "client_charge_adjustments", "client_credit_allocations", "client_payment_allocations", "charge_status_history"
];

class ChargeWork {
  constructor(readonly set: RowSet, readonly id: string) {}

  static async load(pool: pg.Pool, id: string, set = new RowSet()): Promise<ChargeWork> {
    const charge = await centralRecord(pool, "client_charges", id);
    if (!charge) throw new HttpError(404, "NOT_FOUND", "Cobranca nao encontrada.");
    set.track("client_charges", charge);
    await Promise.all(CHARGE_CHILDREN.map(async (table) => {
      (await rowsWhere(pool, table, "client_charge_id", [id])).forEach((row) => set.track(table, row));
    }));
    return new ChargeWork(set, id);
  }

  get charge(): Row { return this.set.get("client_charges", this.id)!; }
  get status(): string { return text(this.charge.status); }
  of(table: typeof CHARGE_CHILDREN[number]): Row[] {
    return this.set.all(table).filter((row) => text(row.client_charge_id) === this.id);
  }
  activeLinks(): Row[] { return this.of("client_charge_operations").filter((row) => !row.released_at); }
  activeCredits(): Row[] { return this.of("client_credit_allocations").filter((row) => !row.cancelled_at); }
  activePayments(): Row[] { return this.of("client_payment_allocations").filter((row) => !row.cancelled_at); }
  touch(now = new Date().toISOString()): void { this.charge.updated_at = now; }

  assertEditable(): void { if (!EDITABLE.includes(this.status)) fail("Somente rascunhos ou cobrancas em conferencia permitem esta alteracao."); }
  assertAdjustable(): void { if (!ADJUSTABLE.includes(this.status)) fail("Ajustes bloqueados para cobranca paga, parcial, cancelada ou substituida."); }

  recordStatus(previous: string | null, next: string, reason: string): void {
    const id = randomUUID();
    this.set.put("charge_status_history", { id, client_charge_id: this.id, previous_status: previous, next_status: next, reason, created_at: new Date().toISOString() });
  }

  setStatus(next: string, reason: string): void {
    const previous = this.status;
    this.charge.status = next;
    this.touch();
    this.recordStatus(previous, next, reason);
  }

  // Mesma conta de recalculateClientCharge.
  recalculate(): void {
    const now = new Date().toISOString();
    const subtotal = this.activeLinks().reduce((sum, row) => sum + cents(row.service_amount_cents_snapshot), 0);
    const adjustments = this.of("client_charge_adjustments");
    const additions = adjustments.filter((row) => row.effect === "INCREASE_RECEIVABLE").reduce((sum, row) => sum + cents(row.amount_cents), 0);
    const deductions = adjustments.filter((row) => row.effect === "REDUCE_RECEIVABLE").reduce((sum, row) => sum + cents(row.amount_cents), 0);
    const finalAmount = Math.max(0, subtotal + additions - deductions);
    const paid = this.activePayments().reduce((sum, row) => sum + cents(row.amount_cents), 0);
    const open = Math.max(0, finalAmount - paid);
    let status = this.status;
    if (!["DRAFT", "PENDING_REVIEW", "CANCELLED", "REPLACED"].includes(status)) {
      status = open === 0 ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : "ISSUED";
      if (status === "ISSUED" && this.charge.due_date && text(this.charge.due_date) < today()) status = "OVERDUE";
    }
    Object.assign(this.charge, {
      subtotal_services_cents: subtotal, additions_cents: additions, deductions_cents: deductions,
      final_amount_cents: finalAmount, paid_amount_cents: paid, open_amount_cents: open, status, updated_at: now
    });
    for (const entry of this.of("client_ledger_entries").filter((row) => row.entry_type === "SERVICE_CHARGE")) {
      if (cents(entry.amount_cents) !== finalAmount) Object.assign(entry, { amount_cents: finalAmount, updated_at: now });
    }
  }

  async commit(pool: pg.Pool, session: WebSession, action: string, metadata: Record<string, unknown> = {}): Promise<number | null> {
    const changes = this.set.changes(WRITE_ORDER);
    if (!changes.length) return null;
    return commitDomainChanges(pool, session, action, "client_charge", this.id, changes, {
      organizationId: this.charge.organization_id, legalEntityId: this.charge.own_legal_entity_id, status: this.status, ...metadata
    });
  }
}

function sameScope(charge: Row, other: Row): boolean {
  return text(charge.organization_id) === text(other.organization_id)
    && text(charge.own_legal_entity_id) === text(other.own_legal_entity_id)
    && text(charge.client_partner_id) === text(other.client_partner_id);
}

// Reserva as operacoes na cobranca: mesmas barreiras de reserveOperationsForCharge.
async function reserveOperations(pool: pg.Pool, work: ChargeWork, operationIds: string[]): Promise<number> {
  const charge = work.charge;
  const unique = [...new Set(operationIds)];
  const [operations, links] = await Promise.all([
    rowsWhere(pool, "operations", "id", unique),
    rowsWhere(pool, "client_charge_operations", "operation_id", unique)
  ]);
  const operationMap = new Map(operations.map((row) => [text(row.id), row]));
  const documentIds = [...new Set(operations.map((row) => text(row.fiscal_document_id)))];
  const [documents, entities, products, partners, partnerEntities] = await Promise.all([
    rowsWhere(pool, "fiscal_documents", "id", documentIds),
    centralRecords(pool, "legal_entities"),
    rowsWhere(pool, "products", "id", [...new Set(operations.map((row) => text(row.product_id)).filter(Boolean))]),
    centralRecords(pool, "business_partners"),
    centralRecords(pool, "partner_legal_entities")
  ]);
  const documentMap = new Map(documents.map((row) => [text(row.id), row]));
  const entityMap = new Map(entities.map((row) => [text(row.id), row]));
  const productMap = new Map(products.map((row) => [text(row.id), row]));
  const partnerMap = new Map(partners.map((row) => [text(row.id), row]));
  const partnerEntityMap = new Map(partnerEntities.map((row) => [text(row.id), row]));
  const otherCharges = await rowsWhere(pool, "client_charges", "id", [...new Set(links.filter((row) => !row.released_at && text(row.client_charge_id) !== work.id).map((row) => text(row.client_charge_id)))]);
  const closedCharges = new Set(otherCharges.filter((row) => ["CANCELLED", "REPLACED"].includes(text(row.status))).map((row) => text(row.id)));
  const alreadyHere = new Set(work.activeLinks().map((row) => text(row.operation_id)));
  const daeDocuments = new Set(work.of("client_charge_adjustments").map((row) => text(row.source_fiscal_document_id)).filter(Boolean));
  const requiresContract = (document: Row): boolean => [document.responsible_partner_id, document.secondary_responsible_partner_id]
    .some((id) => id && Boolean(Number(partnerMap.get(text(id))?.requires_contract ?? 0)));
  const now = new Date().toISOString();
  let added = 0;
  for (const operationId of unique) {
    if (alreadyHere.has(operationId)) continue;
    const operation = operationMap.get(operationId);
    if (!operation) fail("Uma das operacoes selecionadas nao foi encontrada.", "NOT_FOUND", 404);
    const op = operation!;
    if (text(op.organization_id) !== text(charge.organization_id) || text(op.responsible_partner_id) !== text(charge.client_partner_id)) fail("Operacao fora do escopo da cobranca.");
    if (!["DRAFT", "CONFIRMED"].includes(text(op.status))) fail("Operacao com pendencias ou cancelada.");
    const busy = links.some((row) => text(row.operation_id) === operationId && !row.released_at && text(row.client_charge_id) !== work.id && !closedCharges.has(text(row.client_charge_id)));
    if (busy || (text(op.billing_status) !== "UNBILLED" && text(op.client_charge_id) !== work.id)) fail("Operacao ja reservada ou cobrada.");
    const document = documentMap.get(text(op.fiscal_document_id));
    if (!document || !["DRAFT", "CONFIRMED"].includes(text(document.status)) || Boolean(Number(document.has_pending_issues ?? 0))) fail("Nota com pendencias ou cancelada nao pode ser cobrada.");
    const doc = document!;
    if (requiresContract(doc) && !blank(doc.contract_number)) fail("Contrato obrigatorio ausente.");
    if (text(op.operation_type) !== "SALE" || cents(op.applied_rate_value_cents) <= 0) fail("Operacao sem tarifa de venda valida.");
    const own = entityMap.get(text(op.own_legal_entity_id));
    const ownName = text(own?.legal_name) || text(own?.trade_name);
    const linkId = randomUUID();
    const draftLink: Row = {
      id: linkId, client_charge_id: work.id, operation_id: operationId, third_party_operation_id: null,
      own_legal_entity_id_snapshot: op.own_legal_entity_id, own_legal_entity_name_snapshot: ownName || null,
      operation_date_snapshot: doc.issue_date ?? op.operation_date, fiscal_document_number_snapshot: doc.document_number ?? null,
      fiscal_document_series_snapshot: doc.series ?? null, issuer_name_snapshot: null, destination_name_snapshot: null,
      product_name_snapshot: productMap.get(text(op.product_id))?.name ?? null, operation_scope_snapshot: op.operation_scope,
      quantity_sacks_decimal_snapshot: op.quantity_sacks_decimal, service_rate_cents_snapshot: cents(op.applied_rate_value_cents),
      service_amount_cents_snapshot: cents(op.service_amount_cents), released_at: null, created_at: now,
      contract_number_snapshot: doc.contract_number ?? null, billing_observations_snapshot: doc.billing_observations ?? null
    };
    const names = refreshedOperationSnapshots(draftLink, operationMap, documentMap, entityMap, partnerMap, partnerEntityMap);
    draftLink.issuer_name_snapshot = names.issuer ?? (ownName || null);
    draftLink.destination_name_snapshot = names.destination ?? draftLink.issuer_name_snapshot;
    work.set.put("client_charge_operations", draftLink);
    work.set.track("operations", op);
    Object.assign(work.set.get("operations", operationId)!, { billing_status: EDITABLE.includes(work.status) ? "RESERVED" : "BILLED", client_charge_id: work.id, updated_at: now });
    const dae = cents(doc.freight_dae_amount_cents);
    if (dae > 0 && !daeDocuments.has(text(doc.id))) {
      daeDocuments.add(text(doc.id));
      const reference = blank(doc.freight_dae_reference) ? ` - DAE ${text(doc.freight_dae_reference)}` : "";
      const adjustmentId = randomUUID();
      work.set.put("client_charge_adjustments", {
        id: adjustmentId, client_charge_id: work.id, ledger_entry_id: null, source_fiscal_document_id: doc.id,
        adjustment_type: "SURCHARGE", effect: "INCREASE_RECEIVABLE", description: `DAE de frete referente a NF ${text(doc.document_number)}${reference}`,
        reason: `Valor de DAE de frete registrado na nota fiscal ${text(doc.document_number)}.`, amount_cents: dae, sort_order: 40, created_at: now, updated_at: now
      });
    }
    added += 1;
  }
  return added;
}

async function releaseOperations(pool: pg.Pool, work: ChargeWork, operationIds?: string[]): Promise<number> {
  const now = new Date().toISOString();
  const targets = work.activeLinks().filter((row) => !operationIds?.length || operationIds.includes(text(row.operation_id)));
  const operations = await rowsWhere(pool, "operations", "id", targets.map((row) => text(row.operation_id)));
  for (const link of targets) {
    link.released_at = now;
    const operation = operations.find((row) => text(row.id) === text(link.operation_id));
    if (operation && text(operation.client_charge_id) === work.id) {
      Object.assign(work.set.track("operations", operation), { billing_status: "UNBILLED", client_charge_id: null, updated_at: now });
    }
  }
  // DAE vem da nota: sai junto quando a nota deixa a cobranca.
  const remainingOperationIds = work.activeLinks().map((row) => text(row.operation_id));
  const remaining = await rowsWhere(pool, "operations", "id", remainingOperationIds);
  const remainingDocuments = new Set(remaining.map((row) => text(row.fiscal_document_id)));
  for (const adjustment of work.of("client_charge_adjustments")) {
    if (adjustment.source_fiscal_document_id && !remainingDocuments.has(text(adjustment.source_fiscal_document_id))) work.set.remove("client_charge_adjustments", text(adjustment.id));
  }
  return targets.length;
}

async function trackLedgerEntry(pool: pg.Pool, work: ChargeWork, id: string): Promise<Row> {
  const tracked = work.set.get("client_ledger_entries", id);
  if (tracked) return tracked;
  const entry = await centralRecord(pool, "client_ledger_entries", id);
  if (!entry) fail("Lancamento nao encontrado.", "NOT_FOUND", 404);
  return work.set.track("client_ledger_entries", entry!);
}

// applyCredit: consome o saldo disponivel de um lancamento da conta-corrente.
async function applyCredit(pool: pg.Pool, work: ChargeWork, ledgerEntryId: string, amountCents: number): Promise<void> {
  work.assertAdjustable();
  const entry = await trackLedgerEntry(pool, work, ledgerEntryId);
  if (!sameScope(work.charge, entry)) fail("Lancamento fora do escopo da cobranca.");
  if (entry.status !== "CONFIRMED") fail("Somente lancamentos confirmados podem ser usados na cobranca.");
  if (cents(entry.available_amount_cents) < amountCents) fail("Saldo insuficiente no lancamento da conta-corrente.");
  const now = new Date().toISOString();
  const isCredit = entry.effect === "REDUCE_RECEIVABLE";
  work.set.put("client_credit_allocations", { id: randomUUID(), ledger_entry_id: ledgerEntryId, client_charge_id: work.id, amount_cents: amountCents, allocated_at: now, cancelled_at: null, cancellation_reason: null });
  Object.assign(entry, { available_amount_cents: cents(entry.available_amount_cents) - amountCents, updated_at: now });
  work.set.put("client_charge_adjustments", {
    id: randomUUID(), client_charge_id: work.id, ledger_entry_id: ledgerEntryId, source_fiscal_document_id: null,
    adjustment_type: isCredit ? "CREDIT" : "SURCHARGE", effect: entry.effect,
    description: `${isCredit ? "Credito utilizado" : "Lancamento aplicado"}: ${text(entry.description)}`,
    reason: null, amount_cents: amountCents, sort_order: 100, created_at: now, updated_at: now
  });
}

// Devolve aos lancamentos de origem o saldo usado nesta cobranca.
async function restoreCredits(pool: pg.Pool, work: ChargeWork, reason: string | null, remove: boolean): Promise<void> {
  const now = new Date().toISOString();
  for (const allocation of work.activeCredits()) {
    const entry = await trackLedgerEntry(pool, work, text(allocation.ledger_entry_id));
    Object.assign(entry, { available_amount_cents: cents(entry.available_amount_cents) + cents(allocation.amount_cents), updated_at: now });
    if (remove) work.set.remove("client_credit_allocations", text(allocation.id));
    else Object.assign(allocation, { cancelled_at: now, cancellation_reason: reason });
  }
}

async function issueCharge(pool: pg.Pool, work: ChargeWork): Promise<void> {
  if (!EDITABLE.includes(work.status)) fail("Cobranca ja emitida ou cancelada.");
  const links = work.activeLinks();
  if (!links.length) fail("Cobranca sem operacoes.");
  const operations = await rowsWhere(pool, "operations", "id", links.map((row) => text(row.operation_id)));
  const documents = await rowsWhere(pool, "fiscal_documents", "id", [...new Set(operations.map((row) => text(row.fiscal_document_id)))]);
  const partners = await rowsWhere(pool, "business_partners", "id", [...new Set(documents.flatMap((row) => [text(row.responsible_partner_id), text(row.secondary_responsible_partner_id)]).filter(Boolean))]);
  for (const link of links) {
    const operation = operations.find((row) => text(row.id) === text(link.operation_id));
    const document = documents.find((row) => text(row.id) === text(operation?.fiscal_document_id));
    if (!operation || !document || !["DRAFT", "CONFIRMED"].includes(text(operation.status)) || !["DRAFT", "CONFIRMED"].includes(text(document.status)) || Boolean(Number(document.has_pending_issues ?? 0))) {
      fail("Revise as notas pendentes/canceladas antes de emitir a cobranca.");
    }
    const requires = partners.some((partner) => [document!.responsible_partner_id, document!.secondary_responsible_partner_id].includes(partner.id) && Boolean(Number(partner.requires_contract ?? 0)));
    if (requires && !blank(link.contract_number_snapshot)) fail("Contrato obrigatorio ausente. Recrie o rascunho apos informar o contrato.");
  }
  const now = new Date().toISOString();
  work.recalculate();
  const previous = work.status;
  const detail = await chargeDetail(pool, work.charge, work);
  Object.assign(work.charge, {
    issue_date: now.slice(0, 10), status: "ISSUED", issued_at: now, updated_at: now,
    snapshot_json: JSON.stringify({ charge: detail.detail.charge, operations: detail.detail.operations, adjustments: detail.detail.adjustments, organization: detail.organization, ownLegalEntity: detail.ownLegalEntity, client: detail.client })
  });
  for (const operation of operations) {
    if (text(operation.client_charge_id) !== work.id) continue;
    Object.assign(work.set.track("operations", operation), { billing_status: "BILLED", updated_at: now });
  }
  const ledgerId = randomUUID();
  work.set.put("client_ledger_entries", {
    id: ledgerId, organization_id: work.charge.organization_id, own_legal_entity_id: work.charge.own_legal_entity_id,
    client_partner_id: work.charge.client_partner_id, client_charge_id: work.id, entry_type: "SERVICE_CHARGE",
    effect: "INCREASE_RECEIVABLE", amount_cents: cents(work.charge.final_amount_cents), entry_date: now.slice(0, 10),
    description: `Cobranca ${chargePeriodLabel({ periodStart: text(work.charge.period_start), periodEnd: text(work.charge.period_end) })}`,
    reference_number: null, notes: null, attachment_path: null, status: "CONFIRMED", available_amount_cents: null,
    collection_due_date: null, collected_at: null, created_at: now, updated_at: now, cancelled_at: null, cancellation_reason: null
  });
  work.recordStatus(previous, "ISSUED", "Cobranca emitida pelo site");
  work.recalculate();
}

async function cancelCharge(pool: pg.Pool, work: ChargeWork, reason: string): Promise<void> {
  if (work.status === "CANCELLED") fail("Essa cobranca ja foi cancelada.");
  if (work.status === "PAID" || cents(work.charge.paid_amount_cents) > 0) fail("Cobranca com pagamento nao pode ser cancelada diretamente.");
  const now = new Date().toISOString();
  const previous = work.status;
  Object.assign(work.charge, { status: "CANCELLED", cancelled_at: now, cancellation_reason: reason, updated_at: now });
  for (const operation of await rowsWhere(pool, "operations", "client_charge_id", [work.id])) {
    Object.assign(work.set.track("operations", operation), { billing_status: "UNBILLED", client_charge_id: null, updated_at: now });
  }
  work.activeLinks().forEach((link) => { link.released_at = now; });
  await restoreCredits(pool, work, reason, false);
  work.recordStatus(previous, "CANCELLED", reason);
}

async function deleteCharge(pool: pg.Pool, work: ChargeWork): Promise<void> {
  if (work.status === "PAID" || cents(work.charge.paid_amount_cents) > 0) fail("Cobranca com pagamento registrado nao pode ser excluida.");
  const now = new Date().toISOString();
  for (const operation of await rowsWhere(pool, "operations", "client_charge_id", [work.id])) {
    Object.assign(work.set.track("operations", operation), { billing_status: "UNBILLED", client_charge_id: null, updated_at: now });
  }
  await restoreCredits(pool, work, null, true);
  for (const replaced of await rowsWhere(pool, "client_charges", "replaced_by_charge_id", [work.id])) {
    Object.assign(work.set.track("client_charges", replaced), { replaced_by_charge_id: null, updated_at: now });
  }
  // Mesma lista de deleteClientCharge (os lancamentos SERVICE_CHARGE saem junto).
  for (const table of ["charge_status_history", "client_payment_allocations", "client_charge_adjustments", "client_credit_allocations", "client_charge_operations", "client_ledger_entries"] as const) {
    work.of(table).forEach((row) => work.set.remove(table, text(row.id)));
  }
  work.set.remove("client_charges", work.id);
}

// Monta o mesmo ClientChargeDetail do app a partir do registro central.
interface ChargeContext {
  operations: Map<string, Row>; documents: Map<string, Row>; entities: Map<string, Row>; partners: Map<string, Row>;
  partnerEntities: Map<string, Row>; ledger: Map<string, Row>; payments: Map<string, Row>;
}

async function chargeContext(pool: pg.Pool): Promise<ChargeContext> {
  const [operations, documents, entities, partners, partnerEntities, ledger, payments] = await Promise.all([
    centralRecords(pool, "operations"), centralRecords(pool, "fiscal_documents"), centralRecords(pool, "legal_entities"),
    centralRecords(pool, "business_partners"), centralRecords(pool, "partner_legal_entities"),
    centralRecords(pool, "client_ledger_entries"), centralRecords(pool, "client_payments")
  ]);
  const index = (rows: Row[]) => new Map(rows.map((row) => [text(row.id), row]));
  return { operations: index(operations), documents: index(documents), entities: index(entities), partners: index(partners), partnerEntities: index(partnerEntities), ledger: index(ledger), payments: index(payments) };
}

function detailFromRows(charge: Row, rows: { links: Row[]; adjustments: Row[]; credits: Row[]; payments: Row[] }, context: ChargeContext): ClientChargeDetail {
  const operations = rows.links.filter((row) => !row.released_at).map((row) => {
    const mapped = mapClientChargeOperation(row);
    const source = context.operations.get(text(row.operation_id));
    const document = source ? context.documents.get(text(source.fiscal_document_id)) : undefined;
    if (document?.issue_date) mapped.operationDateSnapshot = text(document.issue_date);
    const names = refreshedOperationSnapshots(row, context.operations, context.documents, context.entities, context.partners, context.partnerEntities);
    mapped.issuerNameSnapshot = names.issuer;
    mapped.destinationNameSnapshot = names.destination;
    return mapped;
  }).sort((left, right) => left.operationDateSnapshot.localeCompare(right.operationDateSnapshot)
    || text(left.fiscalDocumentNumberSnapshot).localeCompare(text(right.fiscalDocumentNumberSnapshot), "pt-BR", { numeric: true })
    || left.createdAt.localeCompare(right.createdAt));
  const adjustments = rows.adjustments
    .map((row) => mapClientChargeAdjustment({ ...row, ledger_entry_date: context.ledger.get(text(row.ledger_entry_id))?.entry_date ?? null }))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt));
  return {
    charge: mapClientCharge(charge), operations,
    canceledInvoices: [],
    adjustments,
    creditAllocations: rows.credits.filter((row) => !row.cancelled_at).map(mapClientCreditAllocation),
    payments: rows.payments.filter((row) => !row.cancelled_at).map(mapClientPaymentAllocation),
    documents: []
  } as ClientChargeDetail;
}

async function relatedDetails(pool: pg.Pool, charge: Row, context: ChargeContext): Promise<{ open: ClientChargeDetail[]; paid: ClientChargeDetail[] }> {
  const candidates = (await rowsWhere(pool, "client_charges", "client_partner_id", [text(charge.client_partner_id)]))
    .filter((row) => text(row.id) !== text(charge.id) && text(row.period_start) <= text(charge.period_end) && text(row.period_end) >= text(charge.period_start))
    .sort((left, right) => text(left.period_start).localeCompare(text(right.period_start)) || text(left.charge_number).localeCompare(text(right.charge_number)) || text(left.created_at).localeCompare(text(right.created_at)));
  const open = candidates.filter((row) => !["PAID", "CANCELLED", "REPLACED"].includes(text(row.status)) && cents(row.open_amount_cents) > 0);
  const paid = candidates.filter((row) => text(row.status) === "PAID" && cents(row.paid_amount_cents) >= cents(row.final_amount_cents));
  const ids = [...open, ...paid].map((row) => text(row.id));
  const [links, adjustments, credits, payments] = await Promise.all([
    rowsWhere(pool, "client_charge_operations", "client_charge_id", ids), rowsWhere(pool, "client_charge_adjustments", "client_charge_id", ids),
    rowsWhere(pool, "client_credit_allocations", "client_charge_id", ids), rowsWhere(pool, "client_payment_allocations", "client_charge_id", ids)
  ]);
  const build = (row: Row) => {
    const owned = (list: Row[]) => list.filter((item) => text(item.client_charge_id) === text(row.id));
    return detailFromRows(row, { links: owned(links), adjustments: owned(adjustments), credits: owned(credits), payments: owned(payments) }, context);
  };
  return { open: open.map(build), paid: paid.map(build) };
}

async function chargeDetail(pool: pg.Pool, charge: Row, work?: ChargeWork, withRelated = false): Promise<ChargeDocumentsInput & { context: ChargeContext }> {
  const context = await chargeContext(pool);
  const id = text(charge.id);
  const owned = async (table: typeof CHARGE_CHILDREN[number]) => work ? work.of(table) : rowsWhere(pool, table, "client_charge_id", [id]);
  const [links, adjustments, credits, payments, organization, own, client] = await Promise.all([
    owned("client_charge_operations"), owned("client_charge_adjustments"), owned("client_credit_allocations"), owned("client_payment_allocations"),
    centralRecord(pool, "organizations", text(charge.organization_id)), centralRecord(pool, "legal_entities", text(charge.own_legal_entity_id)),
    centralRecord(pool, "business_partners", text(charge.client_partner_id))
  ]);
  if (!organization || !own || !client) fail("Dados da cobranca incompletos no servidor.", "INCOMPLETE_DATA");
  const clientEntities = [...context.partnerEntities.values()].filter((row) => text(row.business_partner_id) === text(charge.client_partner_id) && row.is_active !== 0 && row.is_active !== false);
  const clientEntity = clientEntities.find((row) => Boolean(Number(row.is_primary ?? 0))) ?? clientEntities[0] ?? null;
  const related = withRelated ? await relatedDetails(pool, charge, context) : { open: [], paid: [] };
  return {
    directories: {} as ChargeDocumentsInput["directories"],
    organization: mapOrganization(organization!), ownLegalEntity: mapLegalEntity(own!), client: mapBusinessPartner(client!),
    clientLegalEntity: clientEntity ? mapBusinessPartnerLegalEntity(clientEntity) : null,
    detail: detailFromRows(charge, { links, adjustments, credits, payments }, context),
    relatedOpenChargeDetails: related.open, relatedPaidChargeDetails: related.paid, context
  };
}

const fileName = (value: string): string => value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "cobranca";

const draftSchema = z.object({
  organizationId: z.string().min(1), legalEntityId: z.string().min(1), clientPartnerId: z.string().min(1),
  operationIds: z.array(z.string().min(1)).min(1).max(500), periodStart: dateSchema, periodEnd: dateSchema,
  periodicity: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "CUSTOM"]).optional().default("CUSTOM"),
  dueDate: dateSchema.nullable().optional(), notes: z.string().trim().max(2000).optional().default(""),
  internalNotes: z.string().trim().max(2000).optional().default("")
});
const updateSchema = z.object({
  periodStart: dateSchema.optional(), periodEnd: dateSchema.optional(), dueDate: dateSchema.nullable().optional(),
  notes: z.string().trim().max(2000).optional(), internalNotes: z.string().trim().max(2000).optional()
});
const adjustmentSchema = z.object({
  adjustmentType: z.enum(["ADVANCE", "CREDIT", "DISCOUNT", "SURCHARGE", "REIMBURSEMENT", "PREVIOUS_BALANCE", "MANUAL_ADJUSTMENT", "OTHER"]),
  effect: z.enum(["INCREASE_RECEIVABLE", "REDUCE_RECEIVABLE"]), description: z.string().trim().min(1).max(300),
  amountCents: z.number().int().positive(), sortOrder: z.number().int().min(0).optional(), reason: z.string().trim().max(2000).optional().default("")
});
const cteSchema = z.object({ linkIds: z.array(z.string().min(1)).min(1), unitValueCents: z.number().int().positive() });
const creditSchema = z.object({ ledgerEntryId: z.string().min(1), amountCents: z.number().int().positive() });
const reasonSchema = z.object({ reason: z.string().trim().min(3).max(2000) });
const operationsSchema = z.object({ operationIds: z.array(z.string().min(1)).min(1).max(500) });
const releaseSchema = z.object({ operationIds: z.array(z.string().min(1)).max(500).optional() });
const controlSchema = z.object({ chargeIds: z.array(z.string().min(1)).min(1).max(10_000), filterDescription: z.string().trim().max(500).optional(), format: z.enum(["xlsx", "html"]).default("xlsx") });
const paymentMethodSchema = z.enum(["PIX", "BANK_TRANSFER", "CASH", "CHECK", "OFFSET", "OTHER"]);
const batchPaymentSchema = z.object({
  organizationId: z.string().min(1), legalEntityId: z.string().min(1), clientPartnerId: z.string().min(1),
  paymentDate: dateSchema, amountCents: z.number().int().positive(), paymentMethod: paymentMethodSchema,
  bankAccountDescription: z.string().trim().max(240).optional().default(""), transactionReference: z.string().trim().max(120).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
  allocations: z.array(z.object({ chargeId: z.string().min(1), amountCents: z.number().int().positive() })).max(200).default([])
});
const allocateSchema = z.object({ chargeId: z.string().min(1), amountCents: z.number().int().positive() });
const paymentListSchema = z.object({ organizationId: z.string().min(1), legalEntityId: z.string().min(1), clientPartnerId: z.string().min(1) });

// Baixa de um pagamento numa cobranca (allocatePayment).
async function allocatePayment(pool: pg.Pool, set: RowSet, payment: Row, chargeId: string, amountCents: number, allocatedSoFar: number): Promise<ChargeWork> {
  const work = await ChargeWork.load(pool, chargeId, set);
  if (!sameScope(work.charge, payment)) fail("Pagamento fora do escopo da cobranca.");
  if (!PAYABLE.includes(work.status)) fail("Somente cobrancas emitidas e em aberto aceitam pagamento.");
  if (cents(payment.amount_cents) - allocatedSoFar < amountCents) fail("Pagamento sem saldo disponivel.");
  if (cents(work.charge.open_amount_cents) < amountCents) fail("Valor maior que saldo aberto.");
  const now = new Date().toISOString();
  set.put("client_payment_allocations", { id: randomUUID(), client_payment_id: payment.id, client_charge_id: work.id, amount_cents: amountCents, allocated_at: now, cancelled_at: null, cancellation_reason: null });
  set.put("client_ledger_entries", {
    id: randomUUID(), organization_id: payment.organization_id, own_legal_entity_id: payment.own_legal_entity_id,
    client_partner_id: payment.client_partner_id, client_charge_id: work.id, entry_type: "PAYMENT_RECEIVED", effect: "REDUCE_RECEIVABLE",
    amount_cents: amountCents, entry_date: payment.payment_date, description: "Pagamento recebido", reference_number: payment.transaction_reference ?? null,
    notes: null, attachment_path: null, status: "CONFIRMED", available_amount_cents: null, collection_due_date: null, collected_at: null,
    created_at: now, updated_at: now, cancelled_at: null, cancellation_reason: null
  });
  work.recalculate();
  return work;
}

export function registerChargeManagementRoutes(app: FastifyInstance, pool: pg.Pool): void {
  const authorize = (session: WebSession, reply: FastifyReply, organizationId: string, legalEntityId: string | null, permission = "billing.manage") =>
    requirePermission(pool, session, reply, permission, organizationId, legalEntityId);

  // Abre a cobranca, confere permissao, executa e grava a diferenca.
  const mutate = (path: string, action: string, handler: (work: ChargeWork, body: unknown, params: Record<string, string>) => Promise<unknown>, method: "POST" | "PUT" | "DELETE" = "POST") => {
    app.route({
      method, url: `/v1/manage/client-charges/:id${path}`, handler: async (request, reply) => {
        const session = await requireWebSession(pool, request, reply); if (!session) return;
        const params = request.params as Record<string, string>;
        return send(reply, async () => {
          const work = await ChargeWork.load(pool, params.id);
          const scope = { organizationId: text(work.charge.organization_id), legalEntityId: text(work.charge.own_legal_entity_id) };
          if (!(await authorize(session, reply, scope.organizationId, scope.legalEntityId))) return;
          const result = (await handler(work, request.body ?? {}, params)) as Record<string, unknown> | undefined;
          const deleted = !work.set.get("client_charges", work.id);
          const revision = deleted
            ? await commitDomainChanges(pool, session, action, "client_charge", work.id, work.set.changes(WRITE_ORDER), scope)
            : await work.commit(pool, session, action);
          return deleted ? { id: work.id, revision, deleted: true, ...result } : {
            id: work.id, revision, status: work.status, finalAmountCents: cents(work.charge.final_amount_cents), openAmountCents: cents(work.charge.open_amount_cents), ...result
          };
        });
      }
    });
  };

  const loadForRead = async (request: { params: unknown }, reply: FastifyReply, session: WebSession): Promise<Row | null> => {
    const { id } = request.params as { id: string };
    const charge = await centralRecord(pool, "client_charges", id);
    if (!charge) fail("Cobranca nao encontrada.", "NOT_FOUND", 404);
    if (!(await authorize(session, reply, text(charge!.organization_id), text(charge!.own_legal_entity_id)))) return null;
    return charge;
  };

  app.get("/v1/manage/client-charges/:id", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    return send(reply, async () => {
      const charge = await loadForRead(request, reply, session); if (!charge) return;
      const input = await chargeDetail(pool, charge);
      const { context } = input;
      const id = text(charge.id);
      const [history, scopeEntries, scopePayments, paymentAllocations] = await Promise.all([
        rowsWhere(pool, "charge_status_history", "client_charge_id", [id]),
        rowsWhere(pool, "client_ledger_entries", "client_partner_id", [text(charge.client_partner_id)]),
        rowsWhere(pool, "client_payments", "client_partner_id", [text(charge.client_partner_id)]),
        rowsWhere(pool, "client_payment_allocations", "client_charge_id", [id])
      ]);
      const allocatedByPayment = new Map<string, number>();
      const allAllocations = await rowsWhere(pool, "client_payment_allocations", "client_payment_id", scopePayments.map((row) => text(row.id)));
      allAllocations.filter((row) => !row.cancelled_at).forEach((row) => allocatedByPayment.set(text(row.client_payment_id), (allocatedByPayment.get(text(row.client_payment_id)) ?? 0) + cents(row.amount_cents)));
      return {
        ...input.detail,
        clientName: input.client.displayName,
        legalEntityName: input.ownLegalEntity.tradeName || input.ownLegalEntity.legalName,
        adjustments: input.detail.adjustments.map((adjustment) => ({ ...adjustment, cte: readChargeCte(adjustment) })),
        payments: paymentAllocations.filter((row) => !row.cancelled_at).map((row) => {
          const payment = context.payments.get(text(row.client_payment_id));
          return { ...mapClientPaymentAllocation(row), payment: payment ? mapClientPayment(payment) : null };
        }),
        history: history.sort((left, right) => text(left.created_at).localeCompare(text(right.created_at)))
          .map((row) => ({ id: text(row.id), previousStatus: blank(row.previous_status), nextStatus: text(row.next_status), reason: blank(row.reason), createdAt: text(row.created_at) })),
        availableEntries: scopeEntries.filter((row) => sameScope(charge, row) && row.status === "CONFIRMED" && cents(row.available_amount_cents) > 0)
          .sort((left, right) => text(left.entry_date).localeCompare(text(right.entry_date)))
          .map((row) => ({ id: text(row.id), entryType: text(row.entry_type), effect: text(row.effect), description: text(row.description), entryDate: text(row.entry_date), availableAmountCents: cents(row.available_amount_cents) })),
        availablePayments: scopePayments.filter((row) => sameScope(charge, row) && row.status === "CONFIRMED")
          .map((row) => ({ id: text(row.id), paymentDate: text(row.payment_date), paymentMethod: text(row.payment_method), transactionReference: blank(row.transaction_reference), availableAmountCents: cents(row.amount_cents) - (allocatedByPayment.get(text(row.id)) ?? 0) }))
          .filter((row) => row.availableAmountCents > 0)
      };
    });
  });

  const documentRoute = (kind: "pdf" | "xlsx" | "svg") => app.get(`/v1/manage/client-charges/:id/${kind === "xlsx" ? "excel" : kind === "svg" ? "image" : "pdf"}`, async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    return send(reply, async () => {
      const charge = await loadForRead(request, reply, session); if (!charge) return;
      const { context: _context, ...input } = await chargeDetail(pool, charge, undefined, true);
      void _context;
      const base = fileName(`${input.client.displayName}-${text(charge.period_start)}-a-${text(charge.period_end)}`);
      if (kind === "pdf") {
        return reply.header("Content-Type", "application/pdf").header("Content-Disposition", `attachment; filename="${base}.pdf"`).send(Buffer.from(await buildChargePdf(input)));
      }
      if (kind === "xlsx") {
        return reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
          .header("Content-Disposition", `attachment; filename="${base}.xlsx"`).send(await buildChargeWorkbook(input));
      }
      const image = buildChargeSummarySvg(input);
      return { fileName: `${base}.png`, ...image };
    });
  });
  documentRoute("pdf"); documentRoute("xlsx"); documentRoute("svg");

  app.post("/v1/manage/client-charges/control", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    return send(reply, async () => {
      const input = controlSchema.parse(request.body);
      const charges = await rowsWhere(pool, "client_charges", "id", [...new Set(input.chargeIds)]);
      for (const scope of new Set(charges.map((row) => `${text(row.organization_id)}\u0000${text(row.own_legal_entity_id)}`))) {
        const [organizationId, legalEntityId] = scope.split("\u0000");
        if (!(await authorize(session, reply, organizationId, legalEntityId))) return;
      }
      const ids = charges.map((row) => text(row.id));
      const [allocations, partners, entities] = await Promise.all([
        rowsWhere(pool, "client_payment_allocations", "client_charge_id", ids), centralRecords(pool, "business_partners"), centralRecords(pool, "legal_entities")
      ]);
      const payments = await rowsWhere(pool, "client_payments", "id", [...new Set(allocations.map((row) => text(row.client_payment_id)))]);
      const rows: ChargeControlRow[] = charges.map((charge) => {
        const totals = new Map<string, number>();
        allocations.filter((row) => text(row.client_charge_id) === text(charge.id) && !row.cancelled_at)
          .forEach((row) => totals.set(text(row.client_payment_id), (totals.get(text(row.client_payment_id)) ?? 0) + cents(row.amount_cents)));
        return {
          charge: mapClientCharge(charge),
          clientName: text(partners.find((row) => row.id === charge.client_partner_id)?.display_name) || "Cliente",
          companyName: text(entities.find((row) => row.id === charge.own_legal_entity_id)?.legal_name),
          payments: [...totals.entries()].flatMap(([paymentId, allocatedAmountCents]) => {
            const payment = payments.find((row) => text(row.id) === paymentId);
            return payment ? [{ payment: mapClientPayment(payment), allocatedAmountCents }] : [];
          })
        };
      }).filter((row) => row.charge.openAmountCents > 0 && !["DRAFT", "CANCELLED", "REPLACED", "PAID"].includes(row.charge.status));
      if (!rows.length) fail("Nenhuma cobranca em aberto entre as selecionadas.", "EMPTY");
      const stamp = today();
      if (input.format === "html") {
        return reply.header("Content-Type", "text/html; charset=utf-8").send(buildChargeControlPrintHtml({ rows, filterDescription: input.filterDescription }));
      }
      return reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("Content-Disposition", `attachment; filename="Controle-interno-cobrancas-${stamp}.xlsx"`)
        .send(await buildChargeControlWorkbook({ rows, filterDescription: input.filterDescription }));
    });
  });

  app.post("/v1/manage/client-charges/drafts", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    return send(reply, async () => {
      const input = draftSchema.parse(request.body);
      if (!(await authorize(session, reply, input.organizationId, input.legalEntityId))) return;
      if (input.periodEnd < input.periodStart) fail("Periodo final deve ser posterior ao inicial.", "INVALID_PERIOD", 400);
      const [own, client] = await Promise.all([centralRecord(pool, "legal_entities", input.legalEntityId), centralRecord(pool, "business_partners", input.clientPartnerId)]);
      if (!own || own.organization_id !== input.organizationId) fail("Empresa propria nao encontrada.", "NOT_FOUND", 404);
      if (!client || client.organization_id !== input.organizationId) fail("Cliente nao encontrado.", "NOT_FOUND", 404);
      const id = randomUUID();
      const now = new Date().toISOString();
      const set = new RowSet();
      set.put("client_charges", {
        id, organization_id: input.organizationId, own_legal_entity_id: input.legalEntityId, client_partner_id: input.clientPartnerId,
        billing_profile_id: null, charge_number: null, reference_code: null, periodicity: input.periodicity, period_start: input.periodStart,
        period_end: input.periodEnd, issue_date: null, due_date: input.dueDate ?? null, status: "DRAFT", subtotal_services_cents: 0,
        additions_cents: 0, deductions_cents: 0, final_amount_cents: 0, paid_amount_cents: 0, open_amount_cents: 0,
        notes: blank(input.notes), internal_notes: blank(input.internalNotes), pdf_file_path: null, pdf_file_hash: null, excel_file_path: null,
        image_file_path: null, snapshot_json: null, created_at: now, updated_at: now, issued_at: null, cancelled_at: null,
        cancellation_reason: null, replaced_by_charge_id: null
      });
      const work = new ChargeWork(set, id);
      await reserveOperations(pool, work, input.operationIds);
      work.recalculate();
      work.recordStatus(null, "DRAFT", "Rascunho criado pelo site");
      const revision = await work.commit(pool, session, "WEB_CLIENT_CHARGE_DRAFT_CREATED", { clientPartnerId: input.clientPartnerId, operationCount: work.activeLinks().length });
      return reply.code(201).send({ id, revision, status: work.status, finalAmountCents: cents(work.charge.final_amount_cents) });
    });
  });

  mutate("", "WEB_CLIENT_CHARGE_UPDATED", async (work, body) => {
    const input = updateSchema.parse(body);
    work.assertEditable();
    const start = input.periodStart ?? text(work.charge.period_start);
    const end = input.periodEnd ?? text(work.charge.period_end);
    if (end < start) fail("Periodo final deve ser posterior ao inicial.", "INVALID_PERIOD", 400);
    Object.assign(work.charge, {
      period_start: start, period_end: end,
      ...(input.dueDate !== undefined ? { due_date: input.dueDate } : {}),
      ...(input.notes !== undefined ? { notes: blank(input.notes) } : {}),
      ...(input.internalNotes !== undefined ? { internal_notes: blank(input.internalNotes) } : {})
    });
    work.touch();
    return {};
  }, "PUT");

  mutate("/operations", "WEB_CLIENT_CHARGE_OPERATIONS_RESERVED", async (work, body) => {
    work.assertEditable();
    const added = await reserveOperations(pool, work, operationsSchema.parse(body).operationIds);
    work.recalculate();
    return { added };
  });

  mutate("/operations/release", "WEB_CLIENT_CHARGE_OPERATIONS_RELEASED", async (work, body) => {
    work.assertEditable();
    const released = await releaseOperations(pool, work, releaseSchema.parse(body).operationIds);
    work.recalculate();
    return { released };
  });

  mutate("/adjustments", "WEB_CLIENT_CHARGE_ADJUSTMENT_ADDED", async (work, body) => {
    const input = adjustmentSchema.parse(body);
    work.assertAdjustable();
    if (input.adjustmentType === "MANUAL_ADJUSTMENT" && !input.reason) fail("Ajuste manual exige justificativa.", "REASON_REQUIRED", 400);
    const now = new Date().toISOString();
    const defaultOrder: Record<string, number> = { ADVANCE: 10, DISCOUNT: 20, SURCHARGE: 30 };
    work.set.put("client_charge_adjustments", {
      id: randomUUID(), client_charge_id: work.id, ledger_entry_id: null, source_fiscal_document_id: null,
      adjustment_type: input.adjustmentType, effect: input.effect, description: input.description, reason: blank(input.reason),
      amount_cents: input.amountCents, sort_order: input.sortOrder ?? defaultOrder[input.adjustmentType] ?? 50, created_at: now, updated_at: now
    });
    work.recalculate();
    return {};
  });

  mutate("/cte", "WEB_CLIENT_CHARGE_CTE_ADDED", async (work, body) => {
    const input = cteSchema.parse(body);
    work.assertAdjustable();
    const links = work.activeLinks().filter((row) => input.linkIds.includes(text(row.id)));
    if (links.length !== new Set(input.linkIds).size) fail("Uma das notas do CT-e nao pertence a esta cobranca.");
    const calculation = calculateChargeCte(links.map((row) => ({
      id: text(row.id), number: text(row.fiscal_document_number_snapshot) || "-",
      company: text(row.destination_name_snapshot) || text(row.issuer_name_snapshot) || text(row.own_legal_entity_name_snapshot) || "-",
      sacks: text(row.quantity_sacks_decimal_snapshot) || "0"
    })), input.unitValueCents);
    if (calculation.amountCents <= 0) fail("O CT-e calculado ficou sem valor.");
    const now = new Date().toISOString();
    work.set.put("client_charge_adjustments", {
      id: randomUUID(), client_charge_id: work.id, ledger_entry_id: null, source_fiscal_document_id: null,
      adjustment_type: "SURCHARGE", effect: "INCREASE_RECEIVABLE", description: calculation.description, reason: calculation.reason,
      amount_cents: calculation.amountCents, sort_order: 40, created_at: now, updated_at: now
    });
    work.recalculate();
    return { cteAmountCents: calculation.amountCents };
  });

  mutate("/adjustments/:adjustmentId", "WEB_CLIENT_CHARGE_ADJUSTMENT_REMOVED", async (work, _body, params) => {
    const adjustment = work.set.get("client_charge_adjustments", params.adjustmentId);
    if (!adjustment || text(adjustment.client_charge_id) !== work.id) fail("Ajuste nao encontrado.", "NOT_FOUND", 404);
    if (adjustment!.source_fiscal_document_id) fail("O DAE de frete vem da nota fiscal. Libere a nota da cobranca e altere o DAE no cadastro da nota.");
    work.assertAdjustable();
    if (adjustment!.ledger_entry_id) {
      const allocation = work.activeCredits().find((row) => text(row.ledger_entry_id) === text(adjustment!.ledger_entry_id) && cents(row.amount_cents) === cents(adjustment!.amount_cents));
      if (allocation) {
        const entry = await trackLedgerEntry(pool, work, text(allocation.ledger_entry_id));
        const now = new Date().toISOString();
        Object.assign(entry, { available_amount_cents: cents(entry.available_amount_cents) + cents(allocation.amount_cents), updated_at: now });
        Object.assign(allocation, { cancelled_at: now, cancellation_reason: "Ajuste removido da cobranca" });
      }
    }
    work.set.remove("client_charge_adjustments", params.adjustmentId);
    work.recalculate();
    return {};
  }, "DELETE");

  mutate("/credits", "WEB_CLIENT_CHARGE_CREDIT_APPLIED", async (work, body) => {
    const input = creditSchema.parse(body);
    await applyCredit(pool, work, input.ledgerEntryId, input.amountCents);
    work.recalculate();
    return {};
  });

  mutate("/submit-review", "WEB_CLIENT_CHARGE_SUBMITTED", async (work) => {
    if (work.status !== "DRAFT") fail("Somente rascunhos podem ir para conferencia.");
    work.setStatus("PENDING_REVIEW", "Enviado para conferencia");
    return {};
  });

  mutate("/issue", "WEB_CLIENT_CHARGE_ISSUED", async (work) => { await issueCharge(pool, work); return {}; });

  mutate("/cancel", "WEB_CLIENT_CHARGE_CANCELLED", async (work, body) => {
    await cancelCharge(pool, work, reasonSchema.parse(body).reason);
    return {};
  });

  mutate("", "WEB_CLIENT_CHARGE_DELETED", async (work) => { await deleteCharge(pool, work); return {}; }, "DELETE");

  app.get("/v1/manage/client-payments", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    return send(reply, async () => {
      const input = paymentListSchema.parse(request.query);
      if (!(await authorize(session, reply, input.organizationId, input.legalEntityId))) return;
      const payments = (await rowsWhere(pool, "client_payments", "client_partner_id", [input.clientPartnerId]))
        .filter((row) => text(row.organization_id) === input.organizationId && text(row.own_legal_entity_id) === input.legalEntityId);
      const allocations = await rowsWhere(pool, "client_payment_allocations", "client_payment_id", payments.map((row) => text(row.id)));
      const charges = await rowsWhere(pool, "client_charges", "id", [...new Set(allocations.map((row) => text(row.client_charge_id)))]);
      return payments.sort((left, right) => text(right.payment_date).localeCompare(text(left.payment_date))).map((payment) => {
        const active = allocations.filter((row) => text(row.client_payment_id) === text(payment.id) && !row.cancelled_at);
        const allocated = active.reduce((sum, row) => sum + cents(row.amount_cents), 0);
        return {
          ...mapClientPayment(payment), allocatedAmountCents: allocated,
          availableAmountCents: payment.status === "CONFIRMED" ? Math.max(0, cents(payment.amount_cents) - allocated) : 0,
          allocations: active.map((row) => {
            const charge = charges.find((item) => text(item.id) === text(row.client_charge_id));
            return { id: text(row.id), chargeId: text(row.client_charge_id), amountCents: cents(row.amount_cents), periodStart: text(charge?.period_start), periodEnd: text(charge?.period_end) };
          })
        };
      });
    });
  });

  // Um pagamento distribuido entre varias cobrancas; o que sobrar fica disponivel para baixar depois.
  app.post("/v1/manage/client-payments/batch", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    return send(reply, async () => {
      const input = batchPaymentSchema.parse(request.body);
      if (!(await authorize(session, reply, input.organizationId, input.legalEntityId))) return;
      const total = input.allocations.reduce((sum, item) => sum + item.amountCents, 0);
      if (total > input.amountCents) fail("A soma das baixas e maior que o valor recebido.", "AMOUNT_EXCEEDS_PAYMENT");
      if (new Set(input.allocations.map((item) => item.chargeId)).size !== input.allocations.length) fail("Cada cobranca deve aparecer uma vez so na distribuicao.", "DUPLICATE_CHARGE", 400);
      const client = await centralRecord(pool, "business_partners", input.clientPartnerId);
      if (!client || client.organization_id !== input.organizationId) fail("Cliente nao encontrado.", "NOT_FOUND", 404);
      const now = new Date().toISOString();
      const paymentId = randomUUID();
      const payment: Row = {
        id: paymentId, organization_id: input.organizationId, own_legal_entity_id: input.legalEntityId, client_partner_id: input.clientPartnerId,
        payment_date: input.paymentDate, amount_cents: input.amountCents, payment_method: input.paymentMethod,
        bank_account_description: blank(input.bankAccountDescription), transaction_reference: blank(input.transactionReference),
        notes: blank(input.notes), attachment_path: null, status: "CONFIRMED", created_at: now, updated_at: now,
        cancelled_at: null, cancellation_reason: null, receipt_pdf_file_path: null, receipt_image_file_path: null
      };
      const set = new RowSet();
      set.put("client_payments", payment);
      let allocated = 0;
      const results: Array<{ chargeId: string; status: string; openAmountCents: number }> = [];
      for (const item of input.allocations) {
        const work = await allocatePayment(pool, set, payment, item.chargeId, item.amountCents, allocated);
        allocated += item.amountCents;
        results.push({ chargeId: work.id, status: work.status, openAmountCents: cents(work.charge.open_amount_cents) });
      }
      const revision = await commitDomainChanges(pool, session, "WEB_CLIENT_PAYMENT_DISTRIBUTED", "client_payment", paymentId, set.changes(WRITE_ORDER),
        { organizationId: input.organizationId, legalEntityId: input.legalEntityId, clientPartnerId: input.clientPartnerId, amountCents: input.amountCents, allocatedCents: allocated });
      return reply.code(201).send({ id: paymentId, revision, allocatedAmountCents: allocated, availableAmountCents: input.amountCents - allocated, charges: results });
    });
  });

  app.post("/v1/manage/client-payments/:id/allocate", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    return send(reply, async () => {
      const { id } = request.params as { id: string };
      const input = allocateSchema.parse(request.body);
      const payment = await centralRecord(pool, "client_payments", id);
      if (!payment) fail("Pagamento nao encontrado.", "NOT_FOUND", 404);
      if (!(await authorize(session, reply, text(payment!.organization_id), text(payment!.own_legal_entity_id)))) return;
      if (payment!.status !== "CONFIRMED") fail("Pagamento estornado nao pode ser baixado.");
      const allocated = (await rowsWhere(pool, "client_payment_allocations", "client_payment_id", [id])).filter((row) => !row.cancelled_at).reduce((sum, row) => sum + cents(row.amount_cents), 0);
      const set = new RowSet();
      set.track("client_payments", payment!);
      const work = await allocatePayment(pool, set, payment!, input.chargeId, input.amountCents, allocated);
      const revision = await commitDomainChanges(pool, session, "WEB_CLIENT_PAYMENT_ALLOCATED", "client_payment", id, set.changes(WRITE_ORDER),
        { organizationId: payment!.organization_id, legalEntityId: payment!.own_legal_entity_id, chargeId: input.chargeId, amountCents: input.amountCents });
      return { id, revision, chargeStatus: work.status, openAmountCents: cents(work.charge.open_amount_cents), availableAmountCents: cents(payment!.amount_cents) - allocated - input.amountCents };
    });
  });

  app.post("/v1/manage/ledger-entries/:id/collected", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    return send(reply, async () => {
      const { id } = request.params as { id: string };
      const entry = await centralRecord(pool, "client_ledger_entries", id);
      if (!entry) fail("Lancamento nao encontrado.", "NOT_FOUND", 404);
      if (!(await authorize(session, reply, text(entry!.organization_id), text(entry!.own_legal_entity_id), "finance.manage"))) return;
      if (entry!.entry_type !== "LOAN") fail("Lancamento nao e um emprestimo.");
      if (entry!.collected_at) return { id, alreadyCollected: true };
      const now = new Date().toISOString();
      const revision = await commitDomainChanges(pool, session, "WEB_LEDGER_LOAN_COLLECTED", "client_ledger_entry", id,
        [{ table: "client_ledger_entries", key: id, operation: "UPSERT", data: { ...entry, collected_at: now, updated_at: now } }],
        { organizationId: entry!.organization_id, legalEntityId: entry!.own_legal_entity_id });
      return { id, revision };
    });
  });

  // Credito da conta-corrente aplicado numa cobranca a partir da tela de conta-corrente.
  app.post("/v1/manage/ledger-entries/:id/apply", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    return send(reply, async () => {
      const { id } = request.params as { id: string };
      const input = allocateSchema.parse(request.body);
      const work = await ChargeWork.load(pool, input.chargeId);
      if (!(await authorize(session, reply, text(work.charge.organization_id), text(work.charge.own_legal_entity_id)))) return;
      await applyCredit(pool, work, id, input.amountCents);
      work.recalculate();
      const revision = await work.commit(pool, session, "WEB_CLIENT_CHARGE_CREDIT_APPLIED", { ledgerEntryId: id, amountCents: input.amountCents });
      return { id, revision, chargeId: work.id, chargeStatus: work.status, openAmountCents: cents(work.charge.open_amount_cents) };
    });
  });
}
