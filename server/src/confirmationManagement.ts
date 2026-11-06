import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import type pg from "pg";
import { z } from "zod";
import {
  mapBusinessPartnerLegalEntity, mapDealConfirmation, mapDealConfirmationClause, mapDealConfirmationItem, mapDealConfirmationParty,
  mapDealConfirmationSigner, mapDealConfirmationStatusHistory, mapDealPaymentTerm, mapFiscalDocument, mapLegalEntity, mapOperation, mapOrganization
} from "../../electron/main/database/mappers.js";
import { buildConfirmationPdf } from "../../electron/main/services/dealConfirmationFiles.js";
import {
  dealConfirmationClauseInputSchema, dealConfirmationItemInputSchema, dealConfirmationPartyInputSchema, dealConfirmationSignerInputSchema,
  dealConfirmationUpdateSchema, dealPaymentTermInputSchema, dealSignatureStatusSchema
} from "../../src/shared/schemas/domainSchemas.js";
import type { DealConfirmationDetail } from "../../src/shared/types/domain.js";
import { decimalTextToScaled, normalizeDecimalText } from "../../src/shared/utils/decimal.js";
import { centralRecord, centralRecords, commitDomainChanges, requirePermission, requireWebSession, type DomainChange, type WebSession } from "./domainMutations.js";
import { rowsWhere } from "./fiscalEvents.js";

// Confirmacoes de negocio pelo site. Cada acao carrega a confirmacao inteira,
// aplica em memoria a mesma regra de AppRepository (createDealConfirmationDraft,
// createDealConfirmationFromFiscalDocuments, addDealItemInternal,
// buildDealPartySnapshot, validateDealForIssue, issueDealConfirmation,
// reserveNextDealConfirmationNumber, cancel/replace/duplicate...) e grava so as
// linhas que mudaram numa revisao central auditada.
//
// Diferencas deliberadas: as versoes de documento (deal_confirmation_document_versions)
// sao arquivos locais de cada computador e nao sincronizam; o site gera o PDF na
// hora a partir dos dados. A previa do rascunho nao reserva numero.

type Row = Record<string, unknown>;
const text = (value: unknown): string => String(value ?? "");
const blank = (value: unknown): string | null => text(value).trim() || null;
const active = (row: Row | null | undefined): boolean => Boolean(row) && row!.is_active !== 0 && row!.is_active !== false;
const SCALE = 1_000_000n;
const scaledText = (value: bigint): string => {
  const whole = value / SCALE;
  const fraction = (value % SCALE).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
};
const multiplyTexts = (left: string, right: string): string => scaledText((decimalTextToScaled(left) * decimalTextToScaled(right) + SCALE / 2n) / SCALE);
const multiplyToCents = (quantity: string, price: string): number => {
  const denominator = SCALE * SCALE;
  return Number((decimalTextToScaled(quantity) * decimalTextToScaled(price) * 100n + denominator / 2n) / denominator);
};
const normalizedDescription = (value: unknown): string => text(value).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const isValueAddition = (value: unknown): boolean => ["ACRESCIMO DE VALOR", "COMPLEMENTO DE VALOR", "DIFERENCA DE VALOR", "AJUSTE DE VALOR"]
  .some((marker) => normalizedDescription(value).includes(marker));

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

const CHILD_TABLES = [
  "deal_confirmation_parties", "deal_confirmation_items", "deal_confirmation_clauses", "deal_payment_terms",
  "deal_confirmation_signers", "deal_confirmation_status_history", "deal_confirmation_operations", "deal_confirmation_fiscal_documents"
] as const;
type ChildTable = typeof CHILD_TABLES[number];

// Conjunto de linhas de uma confirmacao com o estado original, para gravar so a diferenca.
class DealWork {
  readonly removed = new Map<ChildTable, Set<string>>();
  private constructor(
    readonly pool: pg.Pool,
    public deal: Row,
    readonly children: Record<ChildTable, Map<string, Row>>,
    private readonly original: Map<string, string>,
    readonly isNew: boolean
  ) {}

  static async load(pool: pg.Pool, id: string): Promise<DealWork> {
    const deal = await centralRecord(pool, "deal_confirmations", id);
    if (!deal) throw new HttpError(404, "NOT_FOUND", "Confirmacao nao encontrada.");
    const children = {} as Record<ChildTable, Map<string, Row>>;
    const original = new Map<string, string>([[`deal_confirmations\u0000${id}`, JSON.stringify(deal)]]);
    await Promise.all(CHILD_TABLES.map(async (table) => {
      const rows = await rowsWhere(pool, table, "deal_confirmation_id", [id]);
      children[table] = new Map(rows.map((row) => [text(row.id), row]));
      rows.forEach((row) => original.set(`${table}\u0000${text(row.id)}`, JSON.stringify(row)));
    }));
    return new DealWork(pool, { ...deal }, children, original, false);
  }

  static create(pool: pg.Pool, deal: Row): DealWork {
    const children = Object.fromEntries(CHILD_TABLES.map((table) => [table, new Map<string, Row>()])) as Record<ChildTable, Map<string, Row>>;
    return new DealWork(pool, deal, children, new Map(), true);
  }

  get id(): string { return text(this.deal.id); }
  get status(): string { return text(this.deal.status); }
  rows(table: ChildTable): Row[] {
    return [...this.children[table].values()].sort((left, right) => Number(left.sort_order ?? left.signature_order ?? 0) - Number(right.sort_order ?? right.signature_order ?? 0)
      || text(left.created_at ?? left.changed_at).localeCompare(text(right.created_at ?? right.changed_at)));
  }
  put(table: ChildTable, row: Row): Row { this.children[table].set(text(row.id), row); return row; }
  remove(table: ChildTable, id: string): void {
    if (!this.children[table].delete(id)) return;
    if (this.original.has(`${table}\u0000${id}`)) this.removed.set(table, new Set([...(this.removed.get(table) ?? []), id]));
  }
  touch(now = new Date().toISOString()): void { this.deal.updated_at = now; }

  changes(): DomainChange[] {
    const changes: DomainChange[] = [];
    const changed = (table: string, row: Row): boolean => this.original.get(`${table}\u0000${text(row.id)}`) !== JSON.stringify(row);
    if (changed("deal_confirmations", this.deal)) changes.push({ table: "deal_confirmations", key: this.id, operation: "UPSERT", data: this.deal });
    for (const table of CHILD_TABLES) {
      for (const row of this.children[table].values()) if (changed(table, row)) changes.push({ table, key: text(row.id), operation: "UPSERT", data: row });
      for (const id of this.removed.get(table) ?? []) changes.push({ table, key: id, operation: "DELETE" });
    }
    return changes;
  }

  assertEditable(): void {
    if (!["DRAFT", "PENDING_REVIEW"].includes(this.status)) fail("Confirmacao emitida, assinada, cancelada ou substituida nao pode ser editada.");
  }
  assertEditableOrIssued(): void {
    if (["CANCELLED", "REPLACED"].includes(this.status)) fail("Confirmacao encerrada nao pode ser alterada.");
  }

  refreshTotals(now = new Date().toISOString()): void {
    const items = this.rows("deal_confirmation_items");
    this.deal.total_quantity_sacks_decimal = scaledText(items.reduce((sum, item) => sum + decimalTextToScaled(text(item.quantity_sacks_decimal) || "0"), 0n));
    this.deal.total_commercial_amount_cents = items.reduce((sum, item) => sum + Number(item.total_amount_cents ?? 0), 0);
    this.touch(now);
  }

  refreshSignatureStatus(): void {
    const statuses = this.rows("deal_confirmation_signers").map((signer) => text(signer.signature_status));
    this.deal.signature_status = statuses.length === 0 || statuses.every((status) => status === "NOT_REQUIRED") ? "NOT_APPLICABLE"
      : statuses.every((status) => status === "SIGNED_EXTERNALLY" || status === "NOT_REQUIRED") ? "SIGNED"
        : statuses.some((status) => status === "SIGNED_EXTERNALLY") ? "PARTIALLY_SIGNED"
          : statuses.some((status) => status === "REJECTED") ? "REJECTED" : this.deal.signature_status;
  }

  recordStatus(previous: string | null, next: string, reason: string | null, userId: string | null): void {
    const id = randomUUID();
    this.put("deal_confirmation_status_history", { id, deal_confirmation_id: this.id, previous_status: previous, new_status: next, reason, changed_by_user_id: userId, changed_at: new Date().toISOString() });
  }

  validateForIssue(): Array<{ code: string; severity: "critical" | "warning"; message: string }> {
    const issues: Array<{ code: string; severity: "critical" | "warning"; message: string }> = [];
    const parties = this.rows("deal_confirmation_parties");
    const has = (role: string): boolean => parties.some((party) => party.party_role === role);
    if (!has("ISSUER")) issues.push({ code: "ISSUER_MISSING", severity: "critical", message: "Emissora ausente." });
    if (!has("SELLER")) issues.push({ code: "SELLER_MISSING", severity: "critical", message: "Vendedor ausente." });
    if (!has("BUYER")) issues.push({ code: "BUYER_MISSING", severity: "critical", message: "Comprador ausente." });
    const items = this.rows("deal_confirmation_items");
    if (items.length === 0) issues.push({ code: "ITEMS_MISSING", severity: "critical", message: "Nenhum item informado." });
    for (const item of items) {
      const addition = isValueAddition(`${text(item.product_name_snapshot)} ${text(item.product_description_snapshot)}`);
      if (!addition && decimalTextToScaled(text(item.quantity_sacks_decimal) || "0") <= 0n) issues.push({ code: "INVALID_QUANTITY", severity: "critical", message: "Quantidade invalida." });
      if (!addition && decimalTextToScaled(text(item.sack_weight_kg_decimal) || "0") <= 0n) issues.push({ code: "INVALID_SACK_WEIGHT", severity: "critical", message: "Peso da saca invalido." });
      if (Number(item.total_was_manually_overridden) && !item.total_override_reason) issues.push({ code: "TOTAL_OVERRIDE_REASON", severity: "critical", message: "Override de total sem justificativa." });
    }
    if (!this.deal.payment_terms_snapshot && this.rows("deal_payment_terms").length === 0) issues.push({ code: "PAYMENT_MISSING", severity: "warning", message: "Condicao de pagamento ausente." });
    if (!this.deal.delivery_location_snapshot && items.every((item) => !item.delivery_location_snapshot)) issues.push({ code: "DELIVERY_MISSING", severity: "warning", message: "Entrega/descarga ausente." });
    if (this.rows("deal_confirmation_clauses").length === 0) issues.push({ code: "CLAUSES_NOT_REVIEWED", severity: "warning", message: "Clausulas nao revisadas." });
    this.deal.pending_issues_json = JSON.stringify(issues);
    return issues;
  }

  assertPaymentPercentages(): void {
    const withPercent = this.rows("deal_payment_terms").filter((term) => term.percentage_basis_points !== null && term.percentage_basis_points !== undefined);
    if (withPercent.length && withPercent.reduce((sum, term) => sum + Number(term.percentage_basis_points ?? 0), 0) !== 10000) {
      fail("Quando percentuais forem usados, a soma deve ser 100%.");
    }
  }

  nextSortOrder(table: ChildTable): number {
    return this.rows(table).reduce((max, row) => Math.max(max, Number(row.sort_order ?? -1)), -1) + 1;
  }
}

async function partySnapshot(pool: pg.Pool, work: DealWork, data: z.infer<typeof dealConfirmationPartyInputSchema>): Promise<Row> {
  const role = data.partyRole;
  const representativeName = data.representativeName ?? null;
  const base = (entity: Row, name: unknown) => ({
    name: text(entity.legal_name) || text(name), legalName: entity.legal_name ?? null, taxId: entity.cnpj ?? null, stateRegistration: entity.state_registration ?? null,
    addressLine: entity.address_line ?? null, addressNumber: entity.address_number ?? null, addressComplement: entity.address_complement ?? null,
    district: entity.district ?? null, city: entity.city ?? null, state: entity.state ?? null, postalCode: entity.postal_code ?? null,
    phone: entity.phone ?? null, email: entity.email ?? null, representativeName, role
  });
  if (data.ownLegalEntityId) {
    const own = await centralRecord(pool, "legal_entities", data.ownLegalEntityId);
    if (!own || own.organization_id !== work.deal.organization_id || data.ownLegalEntityId !== work.deal.own_legal_entity_id) fail("CNPJ proprio incompativel com a confirmacao.");
    return base(own!, own!.trade_name);
  }
  if (data.partnerLegalEntityId && !data.businessPartnerId) {
    const entity = await centralRecord(pool, "partner_legal_entities", data.partnerLegalEntityId);
    if (!entity) fail("Empresa nao encontrada.", "NOT_FOUND", 404);
    if (entity!.organization_id && entity!.organization_id !== work.deal.organization_id) fail("Empresa da NF pertence a outra organizacao.");
    return base(entity!, entity!.trade_name);
  }
  if (data.businessPartnerId) {
    const partner = await centralRecord(pool, "business_partners", data.businessPartnerId);
    if (!partner) fail("Cliente ou fornecedor nao encontrado.", "NOT_FOUND", 404);
    let entity: Row | null = null;
    if (data.partnerLegalEntityId) {
      entity = await centralRecord(pool, "partner_legal_entities", data.partnerLegalEntityId);
      const links = await rowsWhere(pool, "partner_company_links", "partner_legal_entity_id", [data.partnerLegalEntityId]);
      if (entity && entity.business_partner_id !== partner!.id && !links.some((link) => link.business_partner_id === partner!.id)) fail("Estabelecimento pertence a outro parceiro.");
    } else {
      entity = (await rowsWhere(pool, "partner_legal_entities", "business_partner_id", [text(partner!.id)])).find((row) => row.is_primary === 1 || row.is_primary === true) ?? null;
    }
    if (!entity) return { ...base({}, partner!.display_name), name: text(partner!.display_name) };
    return base(entity, partner!.display_name);
  }
  if (!data.manualName) fail("Participante manual exige nome.", "INVALID_REQUEST", 400);
  return { ...base({}, data.manualName), name: data.manualName };
}

async function addParty(pool: pg.Pool, work: DealWork, data: z.infer<typeof dealConfirmationPartyInputSchema>): Promise<Row> {
  if (data.partyRole === "ISSUER" && data.ownLegalEntityId !== work.deal.own_legal_entity_id) fail("Emissora deve ser o CNPJ proprio da confirmacao.");
  const snapshot = await partySnapshot(pool, work, data);
  const now = new Date().toISOString();
  return work.put("deal_confirmation_parties", {
    id: randomUUID(), deal_confirmation_id: work.id, party_role: data.partyRole, business_partner_id: data.businessPartnerId ?? null,
    partner_legal_entity_id: data.partnerLegalEntityId ?? null, own_legal_entity_id: data.ownLegalEntityId ?? null, manual_name: data.manualName ?? null,
    snapshot_json: JSON.stringify(snapshot), representative_name: data.representativeName ?? null, sort_order: data.sortOrder ?? 0, created_at: now, updated_at: now
  });
}

type ItemInput = z.infer<typeof dealConfirmationItemInputSchema>;
async function addItem(pool: pg.Pool, work: DealWork, data: ItemInput, id: string = randomUUID()): Promise<Row> {
  if (data.productId) {
    const product = await centralRecord(pool, "products", data.productId);
    if (!product) fail("Produto nao encontrado.", "NOT_FOUND", 404);
    if (product!.organization_id !== work.deal.organization_id) fail("Produto pertence a outra organizacao.");
  }
  const quantity = normalizeDecimalText(data.quantitySacksDecimal);
  const sackWeight = normalizeDecimalText(data.sackWeightKgDecimal);
  const unitPrice = normalizeDecimalText(data.unitPriceDecimal);
  const calculated = multiplyToCents(quantity, unitPrice);
  const override = data.totalAmountCents !== null && data.totalAmountCents !== undefined && data.totalAmountCents !== calculated;
  if (override && !data.totalOverrideReason) fail("Total manual divergente exige justificativa.", "INVALID_REQUEST", 400);
  const now = new Date().toISOString();
  return work.put("deal_confirmation_items", {
    id, deal_confirmation_id: work.id, sort_order: data.sortOrder, product_id: data.productId, product_name_snapshot: data.productNameSnapshot,
    product_description_snapshot: data.productDescriptionSnapshot, crop_snapshot: data.cropSnapshot, quality_snapshot: data.qualitySnapshot,
    packaging_snapshot: data.packagingSnapshot, origin_snapshot: data.originSnapshot, destination_snapshot: data.destinationSnapshot,
    quantity_sacks_decimal: quantity, sack_weight_kg_decimal: sackWeight, total_weight_kg_decimal: multiplyTexts(quantity, sackWeight),
    unit_price_decimal: unitPrice, calculated_total_amount_cents: calculated, total_amount_cents: data.totalAmountCents ?? calculated,
    total_was_manually_overridden: override ? 1 : 0, total_override_reason: override ? data.totalOverrideReason : null,
    delivery_start_date: data.deliveryStartDate, delivery_end_date: data.deliveryEndDate, delivery_location_snapshot: data.deliveryLocationSnapshot,
    notes: data.notes, created_at: now, updated_at: now
  });
}

async function defaultTemplate(pool: pg.Pool, organizationId: string, ownLegalEntityId: string): Promise<Row | null> {
  const templates = (await rowsWhere(pool, "deal_confirmation_templates", "organization_id", [organizationId])).filter(active)
    .sort((left, right) => text(left.name).localeCompare(text(right.name)) || Number(right.version ?? 0) - Number(left.version ?? 0));
  return templates.find((row) => row.own_legal_entity_id === ownLegalEntityId && Number(row.is_default))
    ?? templates.find((row) => !row.own_legal_entity_id && Number(row.is_default)) ?? null;
}

// Template no formato que o aplicativo grava em template_snapshot_json (camelCase).
function templateSnapshot(row: Row | null): string | null {
  if (!row) return null;
  return JSON.stringify({
    id: row.id, organizationId: row.organization_id, ownLegalEntityId: row.own_legal_entity_id ?? null, name: row.name, description: row.description ?? null,
    version: Number(row.version ?? 1), title: row.title, subtitle: row.subtitle ?? null, layoutMode: row.layout_mode,
    defaultPaymentTerms: row.default_payment_terms ?? null, defaultDeliveryTerms: row.default_delivery_terms ?? null,
    defaultQualityTerms: row.default_quality_terms ?? null, defaultGeneralTerms: row.default_general_terms ?? null,
    showBroker: Boolean(Number(row.show_broker)), showCommercialValues: Boolean(Number(row.show_commercial_values)),
    showItemOrigins: Boolean(Number(row.show_item_origins)), showSignatureBlocks: Boolean(Number(row.show_signature_blocks)),
    signatureBlockCount: Number(row.signature_block_count ?? 0), isDefault: Boolean(Number(row.is_default)), isActive: Boolean(Number(row.is_active)),
    createdAt: row.created_at, updatedAt: row.updated_at
  });
}

type DraftInput = { organizationId: string; ownLegalEntityId: string; confirmationDate: string; templateId?: string | null } & Partial<Record<
  "negotiationDate" | "deliveryLocationSnapshot" | "deliveryStartDate" | "deliveryEndDate" | "paymentTermsSnapshot" | "qualityTermsSnapshot"
  | "generalTermsSnapshot" | "publicNotes" | "internalNotes", string | null>>;

async function createDraft(pool: pg.Pool, input: DraftInput, userId: string | null): Promise<DealWork> {
  const own = await centralRecord(pool, "legal_entities", input.ownLegalEntityId);
  if (!own || own.organization_id !== input.organizationId) fail("CNPJ proprio pertence a outra organizacao.");
  const template = input.templateId ? await centralRecord(pool, "deal_confirmation_templates", input.templateId) : await defaultTemplate(pool, input.organizationId, input.ownLegalEntityId);
  if (input.templateId && (!template || template.organization_id !== input.organizationId)) fail("Modelo de confirmacao nao encontrado.", "NOT_FOUND", 404);
  const id = randomUUID();
  const now = new Date().toISOString();
  const work = DealWork.create(pool, {
    id, organization_id: input.organizationId, own_legal_entity_id: input.ownLegalEntityId, template_id: input.templateId ?? template?.id ?? null,
    confirmation_number: null, temporary_reference: `RASCUNHO-${id.slice(0, 8).toUpperCase()}`, confirmation_date: input.confirmationDate,
    negotiation_date: input.negotiationDate ?? null, status: "DRAFT", signature_status: "NOT_SENT", currency_code: "BRL",
    total_quantity_sacks_decimal: "0", total_commercial_amount_cents: 0,
    delivery_location_snapshot: input.deliveryLocationSnapshot ?? own!.default_delivery_terms ?? template?.default_delivery_terms ?? null,
    delivery_start_date: input.deliveryStartDate ?? null, delivery_end_date: input.deliveryEndDate ?? null,
    payment_terms_snapshot: input.paymentTermsSnapshot ?? own!.default_payment_terms ?? template?.default_payment_terms ?? null,
    quality_terms_snapshot: input.qualityTermsSnapshot ?? template?.default_quality_terms ?? null,
    general_terms_snapshot: input.generalTermsSnapshot ?? template?.default_general_terms ?? null,
    public_notes: input.publicNotes ?? own!.default_confirmation_notes ?? null, internal_notes: input.internalNotes ?? null,
    template_snapshot_json: templateSnapshot(template), pending_issues_json: "[]", issued_document_version_id: null, signed_document_version_id: null,
    created_at: now, updated_at: now, issued_at: null, sent_for_signature_at: null, signed_at: null, cancelled_at: null, cancellation_reason: null,
    replaced_by_confirmation_id: null, brokerage_percentage_basis_points: null,
    bank_name: own!.default_bank_name ?? null, bank_code: own!.default_bank_code ?? null, bank_agency: own!.default_bank_agency ?? null,
    bank_account: own!.default_bank_account ?? null, bank_account_type: own!.default_bank_account_type ?? null,
    bank_holder_name: own!.default_bank_holder_name ?? own!.legal_name ?? null, bank_holder_document: own!.default_bank_holder_document ?? own!.cnpj ?? null,
    pix_key: own!.default_pix_key ?? null, pix_key_type: own!.default_pix_key_type ?? null
  });
  await addParty(pool, work, { dealConfirmationId: id, partyRole: "ISSUER", ownLegalEntityId: input.ownLegalEntityId, businessPartnerId: null, partnerLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 0 } as z.infer<typeof dealConfirmationPartyInputSchema>);
  work.recordStatus(null, "DRAFT", "Rascunho criado", userId);
  work.refreshTotals(now);
  return work;
}

async function linkFiscalDocument(pool: pg.Pool, work: DealWork, documentId: string): Promise<{ document: Row; items: Row[]; operations: Row[] }> {
  const document = await centralRecord(pool, "fiscal_documents", documentId);
  if (!document) fail("Nota fiscal nao encontrada.", "NOT_FOUND", 404);
  if (document!.organization_id !== work.deal.organization_id) fail("Nota pertence a outra organizacao.");
  if (document!.own_legal_entity_id !== work.deal.own_legal_entity_id) fail("Nota pertence a outro CNPJ proprio.");
  const now = new Date().toISOString();
  if (!work.rows("deal_confirmation_fiscal_documents").some((row) => row.fiscal_document_id === documentId)) {
    work.put("deal_confirmation_fiscal_documents", { id: randomUUID(), deal_confirmation_id: work.id, fiscal_document_id: documentId, created_at: now, is_active: 1 });
  }
  const [items, operations] = await Promise.all([
    rowsWhere(pool, "fiscal_document_items", "fiscal_document_id", [documentId]), rowsWhere(pool, "operations", "fiscal_document_id", [documentId])
  ]);
  for (const operation of operations) {
    if (!work.rows("deal_confirmation_operations").some((row) => row.operation_id === operation.id)) {
      work.put("deal_confirmation_operations", { id: randomUUID(), deal_confirmation_id: work.id, operation_id: operation.id, created_at: now });
    }
  }
  return { document: document!, items, operations };
}

// Numero oficial como reserveNextDealConfirmationNumber: prefixo da empresa,
// piso manual de document_sequences e reaproveitamento de buracos acima dele.
async function reserveNumber(pool: pg.Pool, work: DealWork): Promise<{ number: string; changes: DomainChange[] }> {
  const current = text(work.deal.confirmation_number);
  if (current && !current.startsWith("RASCUNHO-")) return { number: current, changes: [] };
  const organizationId = text(work.deal.organization_id);
  const ownLegalEntityId = text(work.deal.own_legal_entity_id);
  const year = Number(text(work.deal.confirmation_date).slice(0, 4)) || new Date().getFullYear();
  const [own, organization] = await Promise.all([centralRecord(pool, "legal_entities", ownLegalEntityId), centralRecord(pool, "organizations", organizationId)]);
  let prefix = blank(own?.document_prefix);
  if (prefix) prefix = prefix.endsWith(" ") ? prefix : `${prefix} `;
  else {
    const name = normalizedDescription(`${text(organization?.slug)} ${text(organization?.display_name)} ${text(organization?.app_display_name)} ${text(own?.trade_name)} ${text(own?.legal_name)}`).toLowerCase();
    const state = text(own?.state).toUpperCase();
    prefix = name.includes("grao") ? (state === "MG" ? "GGMG " : state === "SP" ? "GGSP " : state === "DF" ? "GGDF " : "GG ")
      : name.includes("villa") || name.includes("coffee") ? (state === "MG" ? "VCMG " : state === "ES" ? "VCES " : "VC ") : "CN ";
  }
  const changes: DomainChange[] = [];
  let sequence = (await rowsWhere(pool, "document_sequences", "own_legal_entity_id", [ownLegalEntityId]))
    .find((row) => row.organization_id === organizationId && row.document_type === "DEAL_CONFIRMATION" && Number(row.year) === year && row.prefix === prefix && active(row));
  if (!sequence) {
    const now = new Date().toISOString();
    sequence = { id: randomUUID(), organization_id: organizationId, own_legal_entity_id: ownLegalEntityId, document_type: "DEAL_CONFIRMATION", year, prefix, current_number: 0, padding: 4, is_active: 1, created_at: now, updated_at: now };
    changes.push({ table: "document_sequences", key: text(sequence.id), operation: "UPSERT", data: sequence });
  }
  const used = new Set<number>();
  for (const row of await rowsWhere(pool, "deal_confirmations", "own_legal_entity_id", [ownLegalEntityId])) {
    if (row.id === work.id || row.organization_id !== organizationId || !row.confirmation_number) continue;
    const date = text(row.confirmation_date);
    if (date < `${year}-01-01` || date > `${year}-12-31`) continue;
    const number = text(row.confirmation_number);
    if (!number.startsWith(text(sequence.prefix))) continue;
    const suffix = number.slice(text(sequence.prefix).length).trim();
    if (/^\d+$/.test(suffix)) used.add(Number(suffix));
  }
  let next = Number(sequence.current_number ?? 0) + 1;
  while (used.has(next)) next += 1;
  return { number: `${text(sequence.prefix)}${String(next).padStart(Number(sequence.padding ?? 4), "0")}`, changes };
}

async function detailFor(pool: pg.Pool, work: DealWork, pendingIssues: Array<{ code: string; severity: string; message: string }>): Promise<DealConfirmationDetail> {
  const operationIds = work.rows("deal_confirmation_operations").map((row) => text(row.operation_id));
  const documentIds = work.rows("deal_confirmation_fiscal_documents").map((row) => text(row.fiscal_document_id));
  const [operations, documents, replacement] = await Promise.all([
    rowsWhere(pool, "operations", "id", operationIds), rowsWhere(pool, "fiscal_documents", "id", documentIds),
    work.deal.replaced_by_confirmation_id ? centralRecord(pool, "deal_confirmations", text(work.deal.replaced_by_confirmation_id)) : Promise.resolve(null)
  ]);
  return {
    confirmation: mapDealConfirmation(work.deal as never),
    parties: work.rows("deal_confirmation_parties").map((row) => mapDealConfirmationParty(row as never)),
    items: work.rows("deal_confirmation_items").map((row) => mapDealConfirmationItem(row as never)),
    operations: operations.map((row) => mapOperation(row as never)).sort((left, right) => left.operationDate.localeCompare(right.operationDate)),
    fiscalDocuments: documents.map((row) => mapFiscalDocument(row as never)).sort((left, right) => left.issueDate.localeCompare(right.issueDate)),
    clauses: work.rows("deal_confirmation_clauses").map((row) => mapDealConfirmationClause(row as never)),
    paymentTerms: work.rows("deal_payment_terms").map((row) => mapDealPaymentTerm(row as never)),
    signers: work.rows("deal_confirmation_signers").map((row) => mapDealConfirmationSigner(row as never)),
    documents: [],
    history: work.rows("deal_confirmation_status_history").map((row) => mapDealConfirmationStatusHistory(row as never)),
    replacementStatus: (replacement?.status as DealConfirmationDetail["replacementStatus"]) ?? null,
    pendingIssues: pendingIssues as DealConfirmationDetail["pendingIssues"]
  };
}

const schemaFor = <T extends z.ZodTypeAny>(schema: T, body: unknown, dealConfirmationId: string): z.infer<T> =>
  schema.parse({ ...(body && typeof body === "object" ? body : {}), dealConfirmationId });

export function registerConfirmationManagementRoutes(app: FastifyInstance, pool: pg.Pool): void {
  const authorize = async (session: WebSession, reply: FastifyReply, organizationId: string, ownLegalEntityId: string | null) =>
    requirePermission(pool, session, reply, "confirmations.manage", organizationId, ownLegalEntityId);

  // Abre a confirmacao, confere permissao, executa e grava a diferenca.
  const mutate = (path: string, action: string, handler: (work: DealWork, body: unknown, params: Record<string, string>, session: WebSession) => Promise<unknown>, method: "POST" | "PUT" | "DELETE" = "POST") => {
    app.route({
      method, url: `/v1/manage/confirmations/:id${path}`, handler: async (request, reply) => {
        const session = await requireWebSession(pool, request, reply); if (!session) return;
        const params = request.params as Record<string, string>;
        return send(reply, async () => {
          const work = await DealWork.load(pool, params.id);
          if (!(await authorize(session, reply, text(work.deal.organization_id), text(work.deal.own_legal_entity_id)))) return;
          const result = await handler(work, request.body, params, session);
          const changes = work.changes();
          const extra = (result as { extraChanges?: DomainChange[] } | undefined)?.extraChanges ?? [];
          const revision = changes.length + extra.length
            ? await commitDomainChanges(pool, session, action, "deal_confirmation", work.id, [...extra, ...changes], { organizationId: work.deal.organization_id, legalEntityId: work.deal.own_legal_entity_id, status: work.status })
            : null;
          const { extraChanges: _ignored, ...rest } = (result as Record<string, unknown> | undefined) ?? {};
          void _ignored;
          return { id: work.id, revision, status: work.status, ...rest };
        });
      }
    });
  };

  app.get("/v1/manage/confirmations/:id", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const { id } = request.params as { id: string };
    return send(reply, async () => {
      const work = await DealWork.load(pool, id);
      if (!(await authorize(session, reply, text(work.deal.organization_id), text(work.deal.own_legal_entity_id)))) return;
      const issues = ["DRAFT", "PENDING_REVIEW"].includes(work.status) ? work.validateForIssue() : JSON.parse(text(work.deal.pending_issues_json) || "[]");
      const detail = await detailFor(pool, work, issues);
      const editable = ["DRAFT", "PENDING_REVIEW"].includes(work.status);
      return {
        ...detail,
        permissions: {
          editable, canIssue: editable && !issues.some((issue: { severity: string }) => issue.severity === "critical"),
          canDelete: work.status === "DRAFT" && !work.deal.confirmation_number,
          canMarkSent: ["ISSUED", "SENT_FOR_SIGNATURE"].includes(work.status), canSign: ["ISSUED", "SENT_FOR_SIGNATURE"].includes(work.status),
          canCancel: work.status !== "CANCELLED" && !(work.status === "REPLACED" && detail.replacementStatus && detail.replacementStatus !== "CANCELLED"),
          canReplace: ["ISSUED", "SENT_FOR_SIGNATURE", "SIGNED"].includes(work.status)
        }
      };
    });
  });

  app.get("/v1/manage/confirmations/:id/pdf", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const { id } = request.params as { id: string };
    return send(reply, async () => {
      const work = await DealWork.load(pool, id);
      if (!(await authorize(session, reply, text(work.deal.organization_id), text(work.deal.own_legal_entity_id)))) return;
      const [organization, own] = await Promise.all([
        centralRecord(pool, "organizations", text(work.deal.organization_id)), centralRecord(pool, "legal_entities", text(work.deal.own_legal_entity_id))
      ]);
      const draft = ["DRAFT", "PENDING_REVIEW"].includes(work.status);
      const detail = await detailFor(pool, work, JSON.parse(text(work.deal.pending_issues_json) || "[]"));
      const bytes = await buildConfirmationPdf({
        directories: {} as never, organization: mapOrganization(organization as never), ownLegalEntity: mapLegalEntity(own as never), detail, versionId: "web", draft
      });
      const name = `${text(work.deal.confirmation_number || work.deal.temporary_reference).replace(/\s+/g, "-")}${draft ? "-previa" : ""}.pdf`;
      return reply.header("content-type", "application/pdf").header("content-disposition", `inline; filename="${name}"`).send(Buffer.from(bytes));
    });
  });

  // Rascunho em branco ou a partir de notas (createDealConfirmationFromFiscalDocuments).
  app.post("/v1/manage/confirmations", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const input = z.object({
      organizationId: z.string().uuid(), ownLegalEntityId: z.string().uuid().optional(),
      fiscalDocumentIds: z.array(z.string().uuid()).max(200).default([]), confirmationDate: z.string().date().optional()
    }).parse(request.body);
    return send(reply, async () => {
      let ownLegalEntityId = input.ownLegalEntityId ?? null;
      const documents = await rowsWhere(pool, "fiscal_documents", "id", input.fiscalDocumentIds);
      if (input.fiscalDocumentIds.length) {
        if (documents.length !== input.fiscalDocumentIds.length) fail("Nota fiscal nao encontrada.", "NOT_FOUND", 404);
        const owners = [...new Set(documents.map((row) => text(row.own_legal_entity_id)))];
        if (owners.length > 1) fail("Selecione notas do mesmo CNPJ proprio para gerar uma confirmacao.");
        ownLegalEntityId = owners[0];
      }
      if (!ownLegalEntityId) fail("Escolha a empresa propria.", "INVALID_REQUEST", 400);
      if (!(await authorize(session, reply, input.organizationId, ownLegalEntityId))) return;
      const work = await createDraft(pool, { organizationId: input.organizationId, ownLegalEntityId: ownLegalEntityId!, confirmationDate: input.confirmationDate ?? new Date().toISOString().slice(0, 10) }, session.userId);
      for (const documentId of input.fiscalDocumentIds) {
        const { document, items } = await linkFiscalDocument(pool, work, documentId);
        const productIds = [...new Set(items.map((item) => text(item.product_id)).filter(Boolean))];
        const products = new Map((await rowsWhere(pool, "products", "id", productIds)).map((row) => [text(row.id), row]));
        for (const item of items.sort((left, right) => text(left.created_at).localeCompare(text(right.created_at)))) {
          const product = products.get(text(item.product_id)) ?? null;
          const addition = isValueAddition(item.description);
          await addItem(pool, work, {
            dealConfirmationId: work.id, sortOrder: work.nextSortOrder("deal_confirmation_items"),
            productId: product && product.organization_id === input.organizationId ? text(item.product_id) : null,
            productNameSnapshot: text(item.description) || "Cafe", productDescriptionSnapshot: text(item.description) || null,
            cropSnapshot: null, qualitySnapshot: null, packagingSnapshot: null, originSnapshot: null, destinationSnapshot: null,
            quantitySacksDecimal: addition ? "0" : text(item.sacks_quantity_decimal ?? item.quantity_decimal) || "0",
            sackWeightKgDecimal: product?.default_sack_weight_kg ? normalizeDecimalText(String(product.default_sack_weight_kg)) : "60",
            unitPriceDecimal: addition ? "0" : text(item.unit_price_decimal) || "0", totalAmountCents: Number(item.total_amount_cents ?? 0),
            totalOverrideReason: "Valor oficial importado da nota fiscal.", deliveryStartDate: null, deliveryEndDate: null,
            deliveryLocationSnapshot: null, notes: `Origem: NF ${text(document.document_number)}`
          } as ItemInput);
        }
      }
      work.refreshTotals();
      const revision = await commitDomainChanges(pool, session, "WEB_CONFIRMATION_CREATED", "deal_confirmation", work.id, work.changes(), {
        organizationId: input.organizationId, legalEntityId: ownLegalEntityId, fiscalDocuments: input.fiscalDocumentIds.length
      });
      return reply.code(201).send({ id: work.id, revision, status: work.status });
    });
  });

  mutate("", "WEB_CONFIRMATION_UPDATED", async (work, body) => {
    work.assertEditable();
    const data = dealConfirmationUpdateSchema.parse(body);
    if (data.templateId) {
      const template = await centralRecord(pool, "deal_confirmation_templates", data.templateId);
      if (!template || template.organization_id !== work.deal.organization_id) fail("Modelo de confirmacao nao encontrado.", "NOT_FOUND", 404);
    }
    const map: Array<[keyof typeof data, string]> = [
      ["templateId", "template_id"], ["confirmationDate", "confirmation_date"], ["negotiationDate", "negotiation_date"],
      ["deliveryLocationSnapshot", "delivery_location_snapshot"], ["deliveryStartDate", "delivery_start_date"], ["deliveryEndDate", "delivery_end_date"],
      ["paymentTermsSnapshot", "payment_terms_snapshot"], ["qualityTermsSnapshot", "quality_terms_snapshot"], ["generalTermsSnapshot", "general_terms_snapshot"],
      ["publicNotes", "public_notes"], ["internalNotes", "internal_notes"], ["brokeragePercentageBasisPoints", "brokerage_percentage_basis_points"],
      ["bankName", "bank_name"], ["bankCode", "bank_code"], ["bankAgency", "bank_agency"], ["bankAccount", "bank_account"],
      ["bankAccountType", "bank_account_type"], ["bankHolderName", "bank_holder_name"], ["bankHolderDocument", "bank_holder_document"],
      ["pixKey", "pix_key"], ["pixKeyType", "pix_key_type"]
    ];
    for (const [key, column] of map) if (data[key] !== undefined && !(key === "templateId" && data[key] === null) && !(key === "confirmationDate" && data[key] === null)) work.deal[column] = data[key];
    work.touch();
  }, "PUT");

  app.delete("/v1/manage/confirmations/:id", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const { id } = request.params as { id: string };
    return send(reply, async () => {
      const work = await DealWork.load(pool, id);
      if (!(await authorize(session, reply, text(work.deal.organization_id), text(work.deal.own_legal_entity_id)))) return;
      if (work.deal.confirmation_number || work.status !== "DRAFT") {
        fail("Confirmacao numerada ou fora de rascunho nao pode ser excluida. Use Cancelar confirmacao para preservar o historico e a numeracao.");
      }
      const changes: DomainChange[] = [];
      for (const other of await rowsWhere(pool, "deal_confirmations", "replaced_by_confirmation_id", [id])) {
        changes.push({ table: "deal_confirmations", key: text(other.id), operation: "UPSERT", data: { ...other, replaced_by_confirmation_id: null, updated_at: new Date().toISOString() } });
      }
      for (const table of CHILD_TABLES) for (const row of work.children[table].values()) changes.push({ table, key: text(row.id), operation: "DELETE" });
      changes.push({ table: "deal_confirmations", key: id, operation: "DELETE" });
      const revision = await commitDomainChanges(pool, session, "WEB_CONFIRMATION_DELETED", "deal_confirmation", id, changes, { organizationId: work.deal.organization_id });
      return { id, revision, deleted: true };
    });
  });

  mutate("/items", "WEB_CONFIRMATION_ITEM_ADDED", async (work, body) => {
    work.assertEditable();
    const data = schemaFor(dealConfirmationItemInputSchema, body, work.id);
    const item = await addItem(pool, work, data);
    work.refreshTotals();
    return { itemId: item.id };
  });
  mutate("/items/:itemId", "WEB_CONFIRMATION_ITEM_UPDATED", async (work, body, params) => {
    work.assertEditable();
    if (!work.children.deal_confirmation_items.has(params.itemId)) fail("Item da confirmacao nao encontrado.", "NOT_FOUND", 404);
    const data = schemaFor(dealConfirmationItemInputSchema, body, work.id);
    // O aplicativo apaga e recria o item; aqui o id e mantido para nao gerar exclusao.
    await addItem(pool, work, data, params.itemId);
    work.refreshTotals();
  }, "PUT");
  mutate("/items/:itemId", "WEB_CONFIRMATION_ITEM_REMOVED", async (work, _body, params) => {
    work.assertEditable();
    work.remove("deal_confirmation_items", params.itemId);
    work.refreshTotals();
  }, "DELETE");

  mutate("/parties", "WEB_CONFIRMATION_PARTY_ADDED", async (work, body) => {
    work.assertEditable();
    const party = await addParty(pool, work, schemaFor(dealConfirmationPartyInputSchema, body, work.id));
    work.touch();
    return { partyId: party.id };
  });
  mutate("/parties/:partyId", "WEB_CONFIRMATION_PARTY_REMOVED", async (work, _body, params) => {
    work.assertEditable();
    const party = work.children.deal_confirmation_parties.get(params.partyId);
    if (!party) fail("Participante da confirmacao nao encontrado.", "NOT_FOUND", 404);
    if (party!.party_role === "ISSUER") fail("Emissora obrigatoria nao pode ser removida.");
    work.remove("deal_confirmation_parties", params.partyId);
    work.touch();
  }, "DELETE");

  mutate("/clauses", "WEB_CONFIRMATION_CLAUSE_ADDED", async (work, body) => {
    work.assertEditable();
    const data = schemaFor(dealConfirmationClauseInputSchema, body, work.id);
    const now = new Date().toISOString();
    const clause = work.put("deal_confirmation_clauses", {
      id: randomUUID(), deal_confirmation_id: work.id, clause_number: data.clauseNumber, title: data.title, clause_text: data.clauseText,
      sort_order: data.sortOrder, is_visible: data.isVisible ? 1 : 0, created_at: now, updated_at: now
    });
    work.touch();
    return { clauseId: clause.id };
  });
  mutate("/clauses/:clauseId", "WEB_CONFIRMATION_CLAUSE_UPDATED", async (work, body, params) => {
    work.assertEditable();
    const current = work.children.deal_confirmation_clauses.get(params.clauseId);
    if (!current) fail("Clausula da confirmacao nao encontrada.", "NOT_FOUND", 404);
    const data = schemaFor(dealConfirmationClauseInputSchema, body, work.id);
    work.put("deal_confirmation_clauses", { ...current, clause_number: data.clauseNumber, title: data.title, clause_text: data.clauseText, sort_order: data.sortOrder, is_visible: data.isVisible ? 1 : 0, updated_at: new Date().toISOString() });
  }, "PUT");
  mutate("/clauses/:clauseId", "WEB_CONFIRMATION_CLAUSE_REMOVED", async (work, _body, params) => {
    work.assertEditable();
    work.remove("deal_confirmation_clauses", params.clauseId);
  }, "DELETE");
  mutate("/clauses-order", "WEB_CONFIRMATION_CLAUSES_REORDERED", async (work, body) => {
    work.assertEditable();
    const { clauseIds } = z.object({ clauseIds: z.array(z.string().uuid()) }).parse(body);
    const now = new Date().toISOString();
    clauseIds.forEach((clauseId, index) => {
      const clause = work.children.deal_confirmation_clauses.get(clauseId);
      if (clause) work.put("deal_confirmation_clauses", { ...clause, sort_order: index, updated_at: now });
    });
  });

  mutate("/payment-terms", "WEB_CONFIRMATION_PAYMENT_TERM_ADDED", async (work, body) => {
    work.assertEditable();
    const data = schemaFor(dealPaymentTermInputSchema, body, work.id);
    const now = new Date().toISOString();
    const term = work.put("deal_payment_terms", {
      id: randomUUID(), deal_confirmation_id: work.id, sort_order: data.sortOrder, description: data.description,
      percentage_basis_points: data.percentageBasisPoints, amount_cents: data.amountCents, due_date: data.dueDate,
      days_after_event: data.daysAfterEvent, event_reference: data.eventReference, created_at: now, updated_at: now
    });
    work.assertPaymentPercentages();
    return { termId: term.id };
  });
  mutate("/payment-terms/:termId", "WEB_CONFIRMATION_PAYMENT_TERM_REMOVED", async (work, _body, params) => {
    work.assertEditable();
    work.remove("deal_payment_terms", params.termId);
  }, "DELETE");

  mutate("/signers", "WEB_CONFIRMATION_SIGNER_ADDED", async (work, body) => {
    work.assertEditableOrIssued();
    const data = schemaFor(dealConfirmationSignerInputSchema, body, work.id);
    const now = new Date().toISOString();
    const signer = work.put("deal_confirmation_signers", {
      id: randomUUID(), deal_confirmation_id: work.id, party_role: data.partyRole, name: data.name, document_number: data.documentNumber,
      position_title: data.positionTitle, email: data.email, phone: data.phone, signature_order: data.signatureOrder,
      signature_status: data.signatureStatus, signed_at: data.signedAt ?? null, notes: data.notes, created_at: now, updated_at: now
    });
    work.refreshSignatureStatus();
    work.touch(now);
    return { signerId: signer.id };
  });
  mutate("/signers/:signerId", "WEB_CONFIRMATION_SIGNER_UPDATED", async (work, body, params) => {
    work.assertEditableOrIssued();
    const current = work.children.deal_confirmation_signers.get(params.signerId);
    if (!current) fail("Signatario nao encontrado.", "NOT_FOUND", 404);
    const data = schemaFor(dealConfirmationSignerInputSchema, body, work.id);
    const now = new Date().toISOString();
    work.put("deal_confirmation_signers", {
      ...current, party_role: data.partyRole, name: data.name, document_number: data.documentNumber, position_title: data.positionTitle,
      email: data.email, phone: data.phone, signature_order: data.signatureOrder, signature_status: data.signatureStatus,
      signed_at: data.signedAt ?? null, notes: data.notes, updated_at: now
    });
    work.refreshSignatureStatus();
    work.touch(now);
  }, "PUT");
  mutate("/signers/:signerId", "WEB_CONFIRMATION_SIGNER_REMOVED", async (work, _body, params) => {
    work.assertEditable();
    work.remove("deal_confirmation_signers", params.signerId);
    work.refreshSignatureStatus();
    work.touch();
  }, "DELETE");

  mutate("/submit-review", "WEB_CONFIRMATION_SUBMITTED", async (work, _body, _params, session) => {
    if (work.status !== "DRAFT") fail("Somente rascunho pode ir para conferencia.");
    work.deal.status = "PENDING_REVIEW";
    work.touch();
    work.recordStatus("DRAFT", "PENDING_REVIEW", "Enviado para conferencia", session.userId);
  });

  mutate("/issue", "WEB_CONFIRMATION_ISSUED", async (work, _body, _params, session) => {
    const issues = work.validateForIssue();
    if (issues.some((issue) => issue.severity === "critical")) fail(`Pendencias criticas impedem emissao: ${issues.map((issue) => issue.message).join("; ")}`);
    if (!["DRAFT", "PENDING_REVIEW"].includes(work.status)) fail("Confirmacao ja emitida ou encerrada.");
    const reserved = await reserveNumber(pool, work);
    const previous = work.status;
    const now = new Date().toISOString();
    work.refreshTotals(now);
    if (!work.deal.template_snapshot_json) work.deal.template_snapshot_json = templateSnapshot(await defaultTemplate(pool, text(work.deal.organization_id), text(work.deal.own_legal_entity_id)));
    Object.assign(work.deal, { confirmation_number: reserved.number, temporary_reference: reserved.number, status: "ISSUED", signature_status: "NOT_SENT", issued_at: now, updated_at: now });
    work.recordStatus(previous, "ISSUED", "Confirmacao emitida", session.userId);
    return { confirmationNumber: reserved.number, extraChanges: reserved.changes };
  });

  mutate("/mark-sent", "WEB_CONFIRMATION_SENT_FOR_SIGNATURE", async (work, _body, _params, session) => {
    if (!["ISSUED", "SENT_FOR_SIGNATURE"].includes(work.status)) fail("Somente confirmacao emitida pode ser enviada para assinatura.");
    const previous = work.status;
    const now = new Date().toISOString();
    Object.assign(work.deal, { status: "SENT_FOR_SIGNATURE", signature_status: "WAITING_SIGNATURE", sent_for_signature_at: work.deal.sent_for_signature_at ?? now, updated_at: now });
    work.recordStatus(previous, "SENT_FOR_SIGNATURE", "Envio externo para assinatura registrado", session.userId);
  });

  mutate("/signature-status", "WEB_CONFIRMATION_SIGNATURE_STATUS", async (work, body, _params, session) => {
    const status = dealSignatureStatusSchema.parse((body as { signatureStatus?: unknown } | null)?.signatureStatus);
    if (["CANCELLED", "REPLACED"].includes(work.status)) fail("Confirmacao encerrada nao pode alterar assinatura.");
    const previous = work.status;
    const next = status === "SIGNED" ? "SIGNED" : work.status;
    const now = new Date().toISOString();
    Object.assign(work.deal, { signature_status: status, status: next, signed_at: status === "SIGNED" ? work.deal.signed_at ?? now : work.deal.signed_at, updated_at: now });
    work.recordStatus(previous, next, `Status de assinatura: ${status}`, session.userId);
  });

  mutate("/cancel", "WEB_CONFIRMATION_CANCELLED", async (work, body, _params, session) => {
    const { reason } = z.object({ reason: z.string().trim().min(3).max(2000) }).parse(body);
    if (work.status === "CANCELLED") return;
    if (work.status === "REPLACED" && work.deal.replaced_by_confirmation_id) {
      const replacement = await centralRecord(pool, "deal_confirmations", text(work.deal.replaced_by_confirmation_id));
      if (replacement && replacement.status !== "CANCELLED") fail("Confirmacao substituida nao pode ser cancelada enquanto a substituta estiver ativa.");
    }
    const previous = work.status;
    const now = new Date().toISOString();
    Object.assign(work.deal, { status: "CANCELLED", signature_status: "NOT_APPLICABLE", cancelled_at: now, cancellation_reason: reason, updated_at: now });
    work.recordStatus(previous, "CANCELLED", reason, session.userId);
  });

  // Duplica como rascunho (duplicateDealConfirmationAsDraft); usado tambem pela substituicao.
  const duplicate = async (source: DealWork, userId: string | null): Promise<DealWork> => {
    const deal = source.deal;
    const copy = await createDraft(pool, {
      organizationId: text(deal.organization_id), ownLegalEntityId: text(deal.own_legal_entity_id), templateId: (deal.template_id as string | null) ?? null,
      confirmationDate: new Date().toISOString().slice(0, 10), negotiationDate: deal.negotiation_date as string | null,
      deliveryLocationSnapshot: deal.delivery_location_snapshot as string | null, deliveryStartDate: deal.delivery_start_date as string | null,
      deliveryEndDate: deal.delivery_end_date as string | null, paymentTermsSnapshot: deal.payment_terms_snapshot as string | null,
      qualityTermsSnapshot: deal.quality_terms_snapshot as string | null, generalTermsSnapshot: deal.general_terms_snapshot as string | null,
      publicNotes: deal.public_notes as string | null, internalNotes: deal.internal_notes as string | null
    }, userId);
    const now = new Date().toISOString();
    const clone = (table: ChildTable, row: Row, extra: Row = {}) => copy.put(table, { ...row, id: randomUUID(), deal_confirmation_id: copy.id, created_at: now, updated_at: now, ...extra });
    // Como addDealPartyInternal: o retrato da parte e refeito com o cadastro atual.
    for (const party of source.rows("deal_confirmation_parties").filter((row) => row.party_role !== "ISSUER")) {
      await addParty(pool, copy, {
        dealConfirmationId: copy.id, partyRole: party.party_role, businessPartnerId: party.business_partner_id ?? null,
        partnerLegalEntityId: party.partner_legal_entity_id ?? null, ownLegalEntityId: party.own_legal_entity_id ?? null,
        manualName: party.manual_name ?? null, representativeName: party.representative_name ?? null, sortOrder: Number(party.sort_order ?? 0)
      } as z.infer<typeof dealConfirmationPartyInputSchema>);
    }
    source.rows("deal_confirmation_items").forEach((item) => clone("deal_confirmation_items", item));
    source.rows("deal_confirmation_clauses").forEach((clause) => clone("deal_confirmation_clauses", clause));
    source.rows("deal_payment_terms").forEach((term) => clone("deal_payment_terms", term));
    source.rows("deal_confirmation_signers").forEach((signer) => clone("deal_confirmation_signers", signer, { signature_status: "PENDING", signed_at: null }));
    copy.refreshSignatureStatus();
    copy.refreshTotals(now);
    return copy;
  };

  mutate("/duplicate", "WEB_CONFIRMATION_DUPLICATED", async (work, _body, _params, session) => {
    const copy = await duplicate(work, session.userId);
    return { newConfirmationId: copy.id, extraChanges: copy.changes() };
  });

  mutate("/replace", "WEB_CONFIRMATION_REPLACED", async (work, body, _params, session) => {
    const { reason } = z.object({ reason: z.string().trim().min(3).max(2000) }).parse(body);
    if (!["ISSUED", "SENT_FOR_SIGNATURE", "SIGNED"].includes(work.status)) fail("Somente confirmacao emitida ou em processo de assinatura pode ser substituida.");
    const copy = await duplicate(work, session.userId);
    const previous = work.status;
    const now = new Date().toISOString();
    Object.assign(work.deal, { status: "REPLACED", signature_status: "NOT_APPLICABLE", replaced_by_confirmation_id: copy.id, updated_at: now });
    work.recordStatus(previous, "REPLACED", reason, session.userId);
    return { newConfirmationId: copy.id, extraChanges: copy.changes() };
  });

  // Cadastros para montar a confirmacao: modelos de clausula e empresas da organizacao.
  app.get("/v1/manage/confirmation-options", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const { organizationId } = z.object({ organizationId: z.string().uuid() }).parse(request.query);
    if (!(await authorize(session, reply, organizationId, null))) return;
    const [clauses, templates, entities] = await Promise.all([
      rowsWhere(pool, "deal_clause_templates", "organization_id", [organizationId]),
      rowsWhere(pool, "deal_confirmation_templates", "organization_id", [organizationId]),
      centralRecords(pool, "partner_legal_entities")
    ]);
    return {
      clauseTemplates: clauses.filter(active).map((row) => ({ id: text(row.id), name: text(row.name), title: blank(row.title), clauseText: text(row.clause_text), category: text(row.category) }))
        .sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
      templates: templates.filter(active).map((row) => ({ id: text(row.id), name: text(row.name), ownLegalEntityId: row.own_legal_entity_id ?? null, isDefault: Boolean(Number(row.is_default)) })),
      companies: entities.filter((row) => active(row) && (!row.organization_id || row.organization_id === organizationId))
        .map((row) => mapBusinessPartnerLegalEntity(row as never)).map((entity) => ({ id: entity.id, businessPartnerId: entity.businessPartnerId, legalName: entity.legalName, cnpj: entity.cnpj }))
        .sort((left, right) => left.legalName.localeCompare(right.legalName, "pt-BR"))
    };
  });
}
