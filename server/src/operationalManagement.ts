import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import type pg from "pg";
import { z } from "zod";
import { parseXmlContent } from "../../electron/main/services/xmlNfeService.js";
import {
  centralRecord,
  centralRecords,
  commitDomainChanges,
  requirePermission,
  requireWebSession,
  type WebSession
} from "./domainMutations.js";

const scopeSchema = z.object({
  organizationId: z.string().min(1),
  legalEntityId: z.string().min(1)
});

const warehouseAdjustmentSchema = scopeSchema.extend({
  warehouseName: z.string().trim().min(1).max(240),
  warehouseCnpj: z.string().trim().optional().default(""),
  productDescription: z.string().trim().min(1).max(240),
  adjustmentMode: z.enum(["SET_BALANCE", "ADD", "REMOVE"]),
  unit: z.enum(["SACK", "KG"]),
  quantity: z.number().positive(),
  issueDate: z.string().date(),
  reason: z.string().trim().min(3).max(2000)
});

const ledgerEntrySchema = scopeSchema.extend({
  clientPartnerId: z.string().min(1),
  entryType: z.enum([
    "ADVANCE_RECEIVED", "DISCOUNT", "CREDIT", "SURCHARGE", "REIMBURSEMENT",
    "PREVIOUS_BALANCE", "MANUAL_ADJUSTMENT", "LOAN", "OTHER"
  ]),
  effect: z.enum(["INCREASE_RECEIVABLE", "REDUCE_RECEIVABLE"]).optional(),
  amountCents: z.number().int().positive(),
  entryDate: z.string().date(),
  description: z.string().trim().min(1).max(300),
  referenceNumber: z.string().trim().max(120).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
  collectionDueDate: z.string().date().nullable().optional(),
  applyNow: z.boolean().default(true)
});

const cancelLedgerEntrySchema = z.object({ reason: z.string().trim().min(3).max(2000) });

const clientPaymentSchema = z.object({
  chargeId: z.string().min(1),
  paymentDate: z.string().date(),
  amountCents: z.number().int().positive(),
  paymentMethod: z.enum(["PIX", "BANK_TRANSFER", "CASH", "CHECK", "OFFSET", "OTHER"]),
  bankAccountDescription: z.string().trim().max(240).optional().default(""),
  transactionReference: z.string().trim().max(120).optional().default(""),
  notes: z.string().trim().max(2000).optional().default("")
});

const cancelClientPaymentSchema = z.object({ reason: z.string().trim().min(3).max(2000) });

const issueClientChargeSchema = scopeSchema.extend({
  clientPartnerId: z.string().min(1),
  operationIds: z.array(z.string().min(1)).min(1).max(500),
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  dueDate: z.string().date().nullable().optional(),
  notes: z.string().trim().max(2000).optional().default("")
});

const xmlTextSchema = z.string().min(1).max(10 * 1024 * 1024);
const xmlPreviewSchema = z.object({ organizationId: z.string().min(1), xml: xmlTextSchema });
const xmlImportSchema = xmlPreviewSchema.extend({
  responsiblePartnerId: z.string().min(1),
  operationScope: z.enum(["INTERNAL", "EXTERNAL"]),
  hasFinancialService: z.boolean().default(false),
  itemProducts: z.array(z.object({ itemNumber: z.string().min(1), productId: z.string().min(1) })).min(1),
  confirmOperations: z.boolean().default(true)
});

const clean = (value: string): string | null => value.trim() || null;
const digits = (value: unknown): string => String(value ?? "").replace(/\D/g, "");
const numberValue = (value: unknown): number => {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};
const normalized = (value: unknown): string => String(value ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim().replace(/\s+/g, " ");
const decimal = (value: number): string => Number(value.toFixed(6)).toString();
const cents = (value: unknown): number => Math.max(0, Math.round(numberValue(value)));

function chargeStatus(charge: Record<string, unknown>, paidAmountCents: number, openAmountCents: number): string {
  if (openAmountCents === 0) return "PAID";
  if (paidAmountCents > 0) return "PARTIALLY_PAID";
  const dueDate = String(charge.due_date ?? "");
  return dueDate && dueDate < new Date().toISOString().slice(0, 10) ? "OVERDUE" : "ISSUED";
}

function jsonObject(value: unknown): Record<string, unknown> | null {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}

function fiscalPartyName(document: Record<string, unknown>, key: "issuer" | "recipient"): string | null {
  const party = jsonObject(jsonObject(document.fiscal_snapshot_json)?.[key]);
  return clean(String(party?.legalName ?? party?.tradeName ?? ""));
}

function warehouseProductFamily(value: unknown): string | null {
  const description = normalized(value);
  if (/\b(CONILON|CANEPHORA|ROBUSTA)\b/.test(description)) return "CONILON";
  if (/\b(ARABICA|ARABICA)\b/.test(description)) return "ARABICA";
  return null;
}

function warehouseIdentity(row: Record<string, unknown>): string {
  const cnpj = digits(row.warehouse_cnpj);
  return `${String(row.own_legal_entity_id ?? "")}:${cnpj ? `CNPJ:${cnpj}` : `NAME:${normalized(row.warehouse_name)}`}`;
}

function warehouseMatches(
  row: Record<string, unknown>,
  legalEntityId: string,
  warehouseCnpj: string,
  warehouseName: string,
  productDescription: string
): boolean {
  if (String(row.own_legal_entity_id ?? "") !== legalEntityId || String(row.status ?? "") !== "ACTIVE") return false;
  const sameWarehouse = warehouseCnpj
    ? digits(row.warehouse_cnpj) === warehouseCnpj
    : !digits(row.warehouse_cnpj) && normalized(row.warehouse_name) === normalized(warehouseName);
  if (!sameWarehouse) return false;
  const requestedFamily = warehouseProductFamily(productDescription);
  const rowFamily = warehouseProductFamily(row.product_description);
  return requestedFamily ? rowFamily === requestedFamily : normalized(row.product_description) === normalized(productDescription);
}

async function authorize(
  pool: pg.Pool,
  session: WebSession,
  reply: FastifyReply,
  permission: string,
  organizationId: string,
  legalEntityId: string
): Promise<boolean> {
  return requirePermission(pool, session, reply, permission, organizationId, legalEntityId);
}

function ledgerEffect(entryType: z.infer<typeof ledgerEntrySchema>["entryType"], requested?: "INCREASE_RECEIVABLE" | "REDUCE_RECEIVABLE") {
  if (["ADVANCE_RECEIVED", "DISCOUNT", "CREDIT"].includes(entryType)) return "REDUCE_RECEIVABLE" as const;
  if (["SURCHARGE", "LOAN"].includes(entryType)) return "INCREASE_RECEIVABLE" as const;
  return requested;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(objectValue) : [];
}

function ownEntityForXml(entities: Record<string, unknown>[], organizationId: string, extracted: Record<string, unknown>) {
  const issuer = objectValue(extracted.issuer);
  const recipient = objectValue(extracted.recipient);
  const issuerCnpj = digits(issuer.cnpjCpf);
  const recipientCnpj = digits(recipient.cnpjCpf);
  const candidates = entities.filter((row) => row.organization_id === organizationId && row.is_active !== 0 && row.is_active !== false);
  const outbound = candidates.find((row) => digits(row.cnpj) === issuerCnpj);
  if (outbound) return { entity: outbound, direction: "OUTBOUND" as const, counterparty: recipient };
  const inbound = candidates.find((row) => digits(row.cnpj) === recipientCnpj);
  if (inbound) return { entity: inbound, direction: "INBOUND" as const, counterparty: issuer };
  return null;
}

function canonicalUnit(value: unknown): "SACK" | "KG" | "TON" | "UNIT" {
  const unit = normalized(value);
  if (["SC", "SACA", "SACAS"].includes(unit)) return "SACK";
  if (["KG", "KILO", "QUILO", "QUILOS"].includes(unit)) return "KG";
  if (["TON", "T", "TONELADA", "TONELADAS"].includes(unit)) return "TON";
  return "UNIT";
}

function sacksForItem(item: Record<string, unknown>, product: Record<string, unknown>): number {
  const quantity = numberValue(item.commercialQuantity);
  const unit = canonicalUnit(item.commercialUnit);
  const weight = numberValue(product.default_sack_weight_kg) || 60;
  if (unit === "SACK") return quantity;
  if (unit === "KG") return quantity / weight;
  if (unit === "TON") return quantity * 1000 / weight;
  return 0;
}

export type ResolvedRate = { status: "found" | "missing" | "conflict"; rule: Record<string, unknown> | null; rateCents: number };

export function resolveRate(
  rules: Record<string, unknown>[], kind: "SALE" | "PURCHASE", organizationId: string,
  partnerId: string, ownEntityId: string, counterpartyEntityId: string | null,
  productId: string, scope: "INTERNAL" | "EXTERNAL", date: string, hasFinancialService: boolean
): ResolvedRate {
  const applicable = rules.filter((row) => row.organization_id === organizationId && row.business_partner_id === partnerId)
    .filter((row) => row.is_active !== 0 && row.is_active !== false)
    .filter((row) => !row.own_legal_entity_id || row.own_legal_entity_id === ownEntityId)
    .filter((row) => !row.counterparty_partner_legal_entity_id || row.counterparty_partner_legal_entity_id === counterpartyEntityId)
    .filter((row) => !row.product_id || row.product_id === productId)
    .filter((row) => row.operation_scope === "ALL" || row.operation_scope === scope)
    .filter((row) => String(row.effective_from ?? "") <= date && (!row.effective_to || String(row.effective_to) >= date))
    .map((row) => ({ row, specificity: Number(Boolean(row.counterparty_partner_legal_entity_id)) * 8
      + Number(Boolean(row.own_legal_entity_id)) * 4 + Number(Boolean(row.product_id)) * 2
      + Number(row.operation_scope !== "ALL"), priority: numberValue(row.priority) }))
    .sort((left, right) => right.specificity - left.specificity || right.priority - left.priority);
  if (!applicable.length) return { status: "missing", rule: null, rateCents: 0 };
  const best = applicable[0];
  const tied = applicable.filter((candidate) => candidate.specificity === best.specificity && candidate.priority === best.priority);
  if (tied.length > 1) return { status: "conflict", rule: null, rateCents: 0 };
  const rateCents = kind === "SALE" && hasFinancialService && best.row.financial_rate_value_cents != null
    ? cents(best.row.financial_rate_value_cents) : cents(best.row.rate_value_cents);
  return { status: "found", rule: best.row, rateCents };
}

function xmlPreviewPayload(parsed: ReturnType<typeof parseXmlContent>, match: ReturnType<typeof ownEntityForXml>, partnerEntity: Record<string, unknown> | null) {
  const extracted = objectValue(parsed.extractedData);
  return {
    accessKey: parsed.accessKey, xmlType: parsed.xmlType, warnings: parsed.warnings,
    number: String(extracted.number ?? ""), series: String(extracted.series ?? ""), issueDate: String(extracted.issuedAt ?? ""),
    nature: String(extracted.nature ?? ""), issuer: objectValue(extracted.issuer), recipient: objectValue(extracted.recipient),
    totals: objectValue(extracted.totals), items: arrayValue(extracted.items),
    ownLegalEntityId: String(match?.entity.id ?? ""), ownLegalEntityName: String(match?.entity.trade_name ?? match?.entity.legal_name ?? ""),
    direction: match?.direction ?? "UNKNOWN", counterpartyPartnerLegalEntityId: partnerEntity ? String(partnerEntity.id) : null,
    counterpartyCnpj: digits(match?.counterparty.cnpjCpf), counterpartyName: String(match?.counterparty.legalName ?? match?.counterparty.tradeName ?? "")
  };
}

function readInvoiceXml(xml: string): ReturnType<typeof parseXmlContent> {
  try {
    return parseXmlContent(xml);
  } catch (error) {
    const message = error instanceof Error ? error.message : "XML inválido.";
    throw Object.assign(new Error(message), { statusCode: 400, code: "INVALID_XML" });
  }
}

export function registerOperationalManagementRoutes(app: FastifyInstance, pool: pg.Pool): void {
  app.post("/v1/manage/invoices/xml/preview", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const input = xmlPreviewSchema.parse(request.body);
    const parsed = readInvoiceXml(input.xml);
    if (!["NFE", "NFE_PROC"].includes(parsed.xmlType) || !parsed.extractedData) {
      return reply.code(400).send({ error: "UNSUPPORTED_XML", message: "Selecione o XML autorizado de uma NF-e. Eventos de cancelamento e carta de correcao ainda nao entram por esta tela." });
    }
    const extracted = objectValue(parsed.extractedData);
    const entities = await centralRecords(pool, "legal_entities");
    const match = ownEntityForXml(entities, input.organizationId, extracted);
    if (!match) {
      return reply.code(409).send({ error: "OWN_ENTITY_NOT_FOUND", message: "O CNPJ emitente ou destinatario do XML nao corresponde a uma empresa propria cadastrada nesta organizacao." });
    }
    if (!(await authorize(pool, session, reply, "imports.manage", input.organizationId, String(match.entity.id)))) return;
    const partnerEntities = await centralRecords(pool, "partner_legal_entities");
    const counterpartyCnpj = digits(match.counterparty.cnpjCpf);
    const partnerEntity = partnerEntities.find((row) => row.organization_id === input.organizationId && digits(row.cnpj) === counterpartyCnpj) ?? null;
    return xmlPreviewPayload(parsed, match, partnerEntity);
  });

  app.post("/v1/manage/invoices/xml/import", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const input = xmlImportSchema.parse(request.body);
    const parsed = readInvoiceXml(input.xml);
    if (!["NFE", "NFE_PROC"].includes(parsed.xmlType) || !parsed.extractedData || !parsed.accessKey) {
      return reply.code(400).send({ error: "UNSUPPORTED_XML", message: "O arquivo precisa ser uma NF-e com chave de acesso valida." });
    }
    const extracted = objectValue(parsed.extractedData);
    const [entities, partnerEntities, partners, products, documents, serviceRules, purchaseRules] = await Promise.all([
      centralRecords(pool, "legal_entities"), centralRecords(pool, "partner_legal_entities"), centralRecords(pool, "business_partners"),
      centralRecords(pool, "products"), centralRecords(pool, "fiscal_documents"), centralRecords(pool, "service_rate_rules"), centralRecords(pool, "purchase_rate_rules")
    ]);
    const match = ownEntityForXml(entities, input.organizationId, extracted);
    if (!match) return reply.code(409).send({ error: "OWN_ENTITY_NOT_FOUND", message: "Empresa propria nao identificada pelo CNPJ do XML." });
    const ownEntityId = String(match.entity.id);
    if (!(await authorize(pool, session, reply, "imports.manage", input.organizationId, ownEntityId))) return;
    if (documents.some((row) => row.access_key === parsed.accessKey)) {
      return reply.code(409).send({ error: "DUPLICATE_ACCESS_KEY", message: "Esta NF-e ja esta cadastrada no sistema." });
    }
    const partner = partners.find((row) => row.id === input.responsiblePartnerId && row.organization_id === input.organizationId && row.is_active !== 0 && row.is_active !== false);
    if (!partner) return reply.code(404).send({ error: "PARTNER_NOT_FOUND", message: "Cliente ou fornecedor responsavel nao encontrado." });
    const counterpartyCnpj = digits(match.counterparty.cnpjCpf);
    const partnerEntity = partnerEntities.find((row) => row.organization_id === input.organizationId && digits(row.cnpj) === counterpartyCnpj) ?? null;
    const xmlItems = arrayValue(extracted.items);
    const productByItem = new Map(input.itemProducts.map((row) => [row.itemNumber, row.productId]));
    if (xmlItems.length === 0 || xmlItems.some((item) => !productByItem.has(String(item.itemNumber ?? "")))) {
      return reply.code(400).send({ error: "PRODUCT_REQUIRED", message: "Selecione o produto correspondente para todos os itens da nota." });
    }
    const selectedProducts = new Map<string, Record<string, unknown>>();
    for (const productId of new Set(productByItem.values())) {
      const product = products.find((row) => row.id === productId && row.organization_id === input.organizationId && row.is_active !== 0 && row.is_active !== false);
      if (!product) return reply.code(404).send({ error: "PRODUCT_NOT_FOUND", message: "Um dos produtos selecionados nao foi encontrado." });
      selectedProducts.set(productId, product);
    }
    const warehouseCfops = new Set(["5905", "6905", "5906", "6906", "5907", "6907", "5934", "6934", "1905", "2905", "1906", "2906", "1907", "2907", "1934", "2934"]);
    if (xmlItems.some((item) => warehouseCfops.has(digits(item.cfop)))) {
      return reply.code(409).send({ error: "WAREHOUSE_XML", message: "Esta e uma nota de armazem. Continue lancando-a pelo aplicativo enquanto o fluxo web de cafes armazenados e finalizado." });
    }

    const documentId = randomUUID();
    const now = new Date().toISOString();
    const issueDate = String(extracted.issuedAt ?? "");
    const operationType = match.direction === "OUTBOUND" ? "SALE" as const : "PURCHASE" as const;
    const hasFinancialService = operationType === "SALE" && input.hasFinancialService;
    const changes: Array<{ table: string; key: string; operation: "UPSERT"; data: Record<string, unknown> }> = [];
    const pendingReasons = new Set<string>();
    const itemRows: Record<string, unknown>[] = [];
    const operationRows: Record<string, unknown>[] = [];
    for (const item of xmlItems) {
      const itemNumber = String(item.itemNumber ?? "");
      const productId = productByItem.get(itemNumber)!;
      const product = selectedProducts.get(productId)!;
      const itemId = randomUUID();
      const operationId = randomUUID();
      const sacks = sacksForItem(item, product);
      if (sacks <= 0) pendingReasons.add(`Conferir unidade do item ${itemNumber}`);
      const resolved = resolveRate(operationType === "SALE" ? serviceRules : purchaseRules, operationType, input.organizationId,
        input.responsiblePartnerId, ownEntityId, partnerEntity ? String(partnerEntity.id) : null,
        productId, input.operationScope, issueDate, hasFinancialService);
      if (resolved.status === "missing") pendingReasons.add(`Sem tarifa para o item ${itemNumber}`);
      if (resolved.status === "conflict") pendingReasons.add(`Tarifas conflitantes no item ${itemNumber}`);
      const itemStatus = input.confirmOperations && sacks > 0 && resolved.status === "found" ? "CONFIRMED" : "PENDING";
      const amountCents = Math.round(sacks * resolved.rateCents);
      const itemRow: Record<string, unknown> = {
        id: itemId, fiscal_document_id: documentId, product_id: productId,
        description: String(item.description ?? product.name ?? "Produto"), quantity_decimal: decimal(numberValue(item.commercialQuantity)),
        unit: canonicalUnit(item.commercialUnit), unit_price_decimal: decimal(numberValue(item.commercialUnitValue)),
        total_amount_cents: cents(item.totalAmountCents), sacks_quantity_decimal: decimal(sacks), created_at: now, updated_at: now
      };
      const operationRow: Record<string, unknown> = {
        id: operationId, fiscal_document_id: documentId, fiscal_document_item_id: itemId,
        organization_id: input.organizationId, own_legal_entity_id: ownEntityId, responsible_partner_id: input.responsiblePartnerId,
        product_id: productId, operation_type: operationType, operation_scope: input.operationScope, operation_date: issueDate,
        quantity_sacks_decimal: decimal(sacks), gross_quantity_sacks_decimal: decimal(sacks),
        service_rate_rule_id: operationType === "SALE" ? resolved.rule?.id ?? null : null,
        purchase_rate_rule_id: operationType === "PURCHASE" ? resolved.rule?.id ?? null : null,
        applied_rate_value_cents: resolved.rateCents, service_amount_cents: amountCents,
        rate_was_manually_overridden: 0, manual_rate_value_cents: null, manual_override_reason: null,
        notes: null, status: itemStatus, source: "XML", import_job_id: null, import_row_id: null, xml_import_job_id: null,
        classification_rule_id: null, billing_status: "UNBILLED", client_charge_id: null,
        purchase_settlement_status: "UNSETTLED", account_payable_id: null, created_at: now, updated_at: now
      };
      itemRows.push(itemRow); operationRows.push(operationRow);
      changes.push(
        { table: "fiscal_document_items", key: itemId, operation: "UPSERT", data: itemRow },
        { table: "operations", key: operationId, operation: "UPSERT", data: operationRow }
      );
    }
    const pending = pendingReasons.size > 0 || !input.confirmOperations;
    if (pending) {
      for (const row of operationRows) row.status = "PENDING";
    }
    const documentRow: Record<string, unknown> = {
      id: documentId, organization_id: input.organizationId, own_legal_entity_id: ownEntityId,
      responsible_partner_id: input.responsiblePartnerId, partner_legal_entity_id: partnerEntity?.id ?? null,
      secondary_responsible_partner_id: null, secondary_operation_type: null, document_type: "MANUAL_INVOICE",
      access_key: parsed.accessKey, document_number: String(extracted.number ?? ""), series: clean(String(extracted.series ?? "")),
      issue_date: issueDate, total_amount_cents: cents(objectValue(extracted.totals).invoiceAmountCents),
      status: pending ? "PENDING" : "CONFIRMED", has_pending_issues: pending ? 1 : 0,
      pending_notes: pending ? [...pendingReasons].join("; ") || "Importada como rascunho" : null,
      duplicate_warning: null, notes: null, confirmed_at: pending ? null : now, canceled_at: null, cancel_reason: null,
      source: "XML", import_job_id: null, import_row_id: null, xml_file_path: null,
      xml_file_hash: createHash("sha256").update(input.xml).digest("hex"), protocol_number: objectValue(extracted.protocol).number ?? null,
      protocol_date: objectValue(extracted.protocol).receivedAt ?? null, authorization_status_code: objectValue(extracted.protocol).statusCode ?? null,
      authorization_status_message: objectValue(extracted.protocol).statusMessage ?? null, xml_import_job_id: null,
      merged_from_source: null, merged_at: null, direction: match.direction, fiscal_snapshot_json: JSON.stringify(extracted),
      contract_number: extracted.contractNumber ?? null, billing_observations: null, freight_dae_reference: null,
      freight_dae_amount_cents: 0, has_financial_service: hasFinancialService ? 1 : 0,
      created_at: now, updated_at: now
    };
    changes.unshift({ table: "fiscal_documents", key: documentId, operation: "UPSERT", data: documentRow });
    const revision = await commitDomainChanges(pool, session, "WEB_XML_INVOICE_IMPORTED", "fiscal_document", documentId, changes, {
      organizationId: input.organizationId, legalEntityId: ownEntityId, direction: match.direction,
      accessKey: parsed.accessKey, itemCount: itemRows.length, operationCount: operationRows.length, pending
    });
    return reply.code(201).send({ id: documentId, revision, status: documentRow.status, pendingNotes: documentRow.pending_notes });
  });

  app.post("/v1/manage/client-charges/issue", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const input = issueClientChargeSchema.parse(request.body);
    if (!(await authorize(pool, session, reply, "billing.manage", input.organizationId, input.legalEntityId))) return;
    if (input.periodEnd < input.periodStart) {
      return reply.code(400).send({ error: "INVALID_PERIOD", message: "A data final deve ser posterior a data inicial." });
    }
    const [ownEntity, client, operations, documents, products, activeLinks] = await Promise.all([
      centralRecord(pool, "legal_entities", input.legalEntityId), centralRecord(pool, "business_partners", input.clientPartnerId),
      centralRecords(pool, "operations"), centralRecords(pool, "fiscal_documents"), centralRecords(pool, "products"),
      centralRecords(pool, "client_charge_operations")
    ]);
    if (!ownEntity || ownEntity.organization_id !== input.organizationId) {
      return reply.code(404).send({ error: "NOT_FOUND", message: "Empresa propria nao encontrada." });
    }
    if (!client || client.organization_id !== input.organizationId) {
      return reply.code(404).send({ error: "NOT_FOUND", message: "Cliente nao encontrado." });
    }
    const operationMap = new Map(operations.map((row) => [String(row.id), row]));
    const documentMap = new Map(documents.map((row) => [String(row.id), row]));
    const productMap = new Map(products.map((row) => [String(row.id), row]));
    const requested = input.operationIds.map((id) => operationMap.get(id));
    if (requested.some((row) => !row)) {
      return reply.code(404).send({ error: "NOT_FOUND", message: "Uma das operacoes selecionadas nao foi encontrada." });
    }
    const selected = requested as Record<string, unknown>[];
    for (const operation of selected) {
      const document = documentMap.get(String(operation.fiscal_document_id));
      const alreadyLinked = activeLinks.some((row) => row.operation_id === operation.id && !row.released_at);
      if (operation.organization_id !== input.organizationId || operation.own_legal_entity_id !== input.legalEntityId || operation.responsible_partner_id !== input.clientPartnerId) {
        return reply.code(409).send({ error: "SCOPE_MISMATCH", message: "Todas as notas devem pertencer ao mesmo cliente e empresa." });
      }
      if (!document || !["DRAFT", "CONFIRMED"].includes(String(document.status)) || Boolean(document.has_pending_issues)) {
        return reply.code(409).send({ error: "DOCUMENT_PENDING", message: "Revise notas pendentes ou canceladas antes de emitir a cobranca." });
      }
      if (!["DRAFT", "CONFIRMED"].includes(String(operation.status)) || operation.operation_type !== "SALE"
        || operation.billing_status !== "UNBILLED" || alreadyLinked || cents(operation.applied_rate_value_cents) <= 0) {
        return reply.code(409).send({ error: "OPERATION_UNAVAILABLE", message: "Uma das operacoes ja foi cobrada, esta pendente ou nao possui tarifa valida." });
      }
      if (Boolean(client.requires_contract) && !clean(String(document.contract_number ?? ""))) {
        return reply.code(409).send({ error: "CONTRACT_REQUIRED", message: "Contrato obrigatorio ausente em uma das notas." });
      }
    }

    const chargeId = randomUUID();
    const ledgerId = randomUUID();
    const statusHistoryId = randomUUID();
    const now = new Date().toISOString();
    const issueDate = now.slice(0, 10);
    const ownName = String(ownEntity.legal_name ?? ownEntity.trade_name ?? "Empresa");
    const changes: Array<{ table: string; key: string; operation: "UPSERT"; data: Record<string, unknown> }> = [];
    let subtotal = 0;
    let additions = 0;
    const daeDocuments = new Set<string>();
    const chargeOperations: Record<string, unknown>[] = [];
    for (const operation of selected) {
      const document = documentMap.get(String(operation.fiscal_document_id))!;
      const amountCents = cents(operation.service_amount_cents);
      subtotal += amountCents;
      const linkId = randomUUID();
      const link: Record<string, unknown> = {
        id: linkId, client_charge_id: chargeId, operation_id: operation.id, third_party_operation_id: null,
        own_legal_entity_id_snapshot: input.legalEntityId, own_legal_entity_name_snapshot: ownName,
        operation_date_snapshot: document.issue_date ?? operation.operation_date,
        fiscal_document_number_snapshot: document.document_number ?? null, fiscal_document_series_snapshot: document.series ?? null,
        issuer_name_snapshot: fiscalPartyName(document, "issuer") ?? ownName,
        destination_name_snapshot: fiscalPartyName(document, "recipient") ?? String(client.display_name ?? "Cliente"),
        product_name_snapshot: productMap.get(String(operation.product_id))?.name ?? null,
        operation_scope_snapshot: operation.operation_scope, quantity_sacks_decimal_snapshot: operation.quantity_sacks_decimal,
        service_rate_cents_snapshot: cents(operation.applied_rate_value_cents), service_amount_cents_snapshot: amountCents,
        released_at: null, created_at: now, contract_number_snapshot: document.contract_number ?? null,
        billing_observations_snapshot: document.billing_observations ?? null
      };
      chargeOperations.push(link);
      changes.push(
        { table: "client_charge_operations", key: linkId, operation: "UPSERT", data: link },
        { table: "operations", key: String(operation.id), operation: "UPSERT", data: { ...operation, billing_status: "BILLED", client_charge_id: chargeId, updated_at: now } }
      );
      const documentId = String(document.id);
      const daeAmount = cents(document.freight_dae_amount_cents);
      if (daeAmount > 0 && !daeDocuments.has(documentId)) {
        daeDocuments.add(documentId); additions += daeAmount;
        const adjustmentId = randomUUID();
        const reference = clean(String(document.freight_dae_reference ?? ""));
        changes.push({ table: "client_charge_adjustments", key: adjustmentId, operation: "UPSERT", data: {
          id: adjustmentId, client_charge_id: chargeId, ledger_entry_id: null, source_fiscal_document_id: documentId,
          adjustment_type: "SURCHARGE", effect: "INCREASE_RECEIVABLE",
          description: `DAE de frete referente a NF ${String(document.document_number ?? "")}${reference ? ` - DAE ${reference}` : ""}`,
          reason: `Valor de DAE de frete registrado na nota fiscal ${String(document.document_number ?? "")}.`,
          amount_cents: daeAmount, sort_order: 40, created_at: now, updated_at: now
        } });
      }
    }
    const finalAmount = subtotal + additions;
    const charge: Record<string, unknown> = {
      id: chargeId, organization_id: input.organizationId, own_legal_entity_id: input.legalEntityId,
      client_partner_id: input.clientPartnerId, billing_profile_id: null, charge_number: null, reference_code: null,
      periodicity: "CUSTOM", period_start: input.periodStart, period_end: input.periodEnd, issue_date: issueDate,
      due_date: input.dueDate ?? null, status: "ISSUED", subtotal_services_cents: subtotal, additions_cents: additions,
      deductions_cents: 0, final_amount_cents: finalAmount, paid_amount_cents: 0, open_amount_cents: finalAmount,
      notes: clean(input.notes), internal_notes: null, pdf_file_path: null, pdf_file_hash: null, excel_file_path: null,
      image_file_path: null, snapshot_json: JSON.stringify({ operationCount: chargeOperations.length, issuedBy: "WEB" }),
      created_at: now, updated_at: now, issued_at: now, cancelled_at: null, cancellation_reason: null, replaced_by_charge_id: null
    };
    const ledger: Record<string, unknown> = {
      id: ledgerId, organization_id: input.organizationId, own_legal_entity_id: input.legalEntityId,
      client_partner_id: input.clientPartnerId, client_charge_id: chargeId, entry_type: "SERVICE_CHARGE",
      effect: "INCREASE_RECEIVABLE", amount_cents: finalAmount, entry_date: issueDate,
      description: `Cobranca ${input.periodStart} a ${input.periodEnd}`, reference_number: null, notes: null,
      attachment_path: null, status: "CONFIRMED", available_amount_cents: null, collection_due_date: null,
      collected_at: null, created_at: now, updated_at: now, cancelled_at: null, cancellation_reason: null
    };
    changes.unshift({ table: "client_charges", key: chargeId, operation: "UPSERT", data: charge });
    changes.push(
      { table: "client_ledger_entries", key: ledgerId, operation: "UPSERT", data: ledger },
      { table: "charge_status_history", key: statusHistoryId, operation: "UPSERT", data: {
        id: statusHistoryId, client_charge_id: chargeId, previous_status: null, next_status: "ISSUED",
        reason: "Cobranca criada e emitida pelo site", created_at: now
      } }
    );
    const revision = await commitDomainChanges(pool, session, "WEB_CLIENT_CHARGE_ISSUED", "client_charge", chargeId, changes,
      { organizationId: input.organizationId, legalEntityId: input.legalEntityId, clientPartnerId: input.clientPartnerId, operationCount: selected.length, finalAmountCents: finalAmount });
    return reply.code(201).send({ id: chargeId, revision, finalAmountCents: finalAmount });
  });

  app.post("/v1/manage/warehouse-adjustments", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const input = warehouseAdjustmentSchema.parse(request.body);
    if (!(await authorize(pool, session, reply, "operations.manage", input.organizationId, input.legalEntityId))) return;

    const ownEntity = await centralRecord(pool, "legal_entities", input.legalEntityId);
    if (!ownEntity || ownEntity.organization_id !== input.organizationId) {
      return reply.code(404).send({ error: "NOT_FOUND", message: "Empresa propria nao encontrada." });
    }
    const warehouseCnpj = digits(input.warehouseCnpj);
    if (warehouseCnpj && warehouseCnpj.length !== 14) {
      return reply.code(400).send({ error: "INVALID_CNPJ", message: "O CNPJ do armazem deve ter 14 digitos." });
    }

    const movements = (await centralRecords(pool, "warehouse_movements"))
      .filter((row) => row.organization_id === input.organizationId)
      .filter((row) => warehouseMatches(row, input.legalEntityId, warehouseCnpj, input.warehouseName, input.productDescription));
    const currentKg = movements.reduce((sum, row) => sum
      + (row.movement_type === "DEPOSIT" ? 1 : -1) * numberValue(row.quantity_kg_decimal), 0);
    const requestedKg = input.unit === "SACK" ? input.quantity * 60 : input.quantity;
    const deltaKg = input.adjustmentMode === "SET_BALANCE" ? requestedKg - currentKg
      : input.adjustmentMode === "ADD" ? requestedKg : -requestedKg;
    if (Math.abs(deltaKg) < 0.000001) {
      return reply.code(409).send({ error: "NO_CHANGE", message: "O saldo informado ja e o saldo atual." });
    }
    if (currentKg + deltaKg < -0.000001) {
      return reply.code(409).send({ error: "NEGATIVE_BALANCE", message: "Este ajuste deixaria o saldo armazenado negativo." });
    }

    const identity = movements[0] ? warehouseIdentity(movements[0]) : "";
    const canonical = movements.find((row) => row.origin === "MANUAL" && (!identity || warehouseIdentity(row) === identity));
    const canonicalWarehouseName = String(canonical?.warehouse_name ?? input.warehouseName).trim();
    const canonicalProduct = String(canonical?.product_description ?? input.productDescription).trim();
    const id = randomUUID();
    const now = new Date().toISOString();
    const quantityKg = Math.abs(deltaKg);
    const sourceQuantity = input.unit === "SACK" ? quantityKg / 60 : quantityKg;
    const data: Record<string, unknown> = {
      id, organization_id: input.organizationId, own_legal_entity_id: input.legalEntityId,
      access_key: `MANUAL-${id}`, item_number: "1", document_number: "AJUSTE", series: null,
      issue_date: input.issueDate, warehouse_name: canonicalWarehouseName,
      warehouse_cnpj: warehouseCnpj || null, product_description: canonicalProduct, cfop: "AJUSTE",
      movement_type: deltaKg > 0 ? "DEPOSIT" : "RETURN", movement_kind: "PHYSICAL",
      quantity_kg_decimal: decimal(quantityKg), source_unit: input.unit === "SACK" ? "SC" : "KG",
      source_quantity_decimal: decimal(sourceQuantity), referenced_document_number: null, reference_text: null,
      status: "ACTIVE", notes: input.reason, origin: "MANUAL", created_by_user_id: session.userId,
      created_at: now, updated_at: now
    };
    const revision = await commitDomainChanges(pool, session, "WEB_WAREHOUSE_ADJUSTMENT_CREATED", "warehouse_movement", id,
      [{ table: "warehouse_movements", key: id, operation: "UPSERT", data }],
      { organizationId: input.organizationId, legalEntityId: input.legalEntityId, adjustmentMode: input.adjustmentMode, deltaKg });
    return reply.code(201).send({ id, revision, previousBalanceKg: currentKg, newBalanceKg: currentKg + deltaKg });
  });

  app.post("/v1/manage/ledger-entries", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const input = ledgerEntrySchema.parse(request.body);
    if (!(await authorize(pool, session, reply, "finance.manage", input.organizationId, input.legalEntityId))) return;
    const [ownEntity, client] = await Promise.all([
      centralRecord(pool, "legal_entities", input.legalEntityId),
      centralRecord(pool, "business_partners", input.clientPartnerId)
    ]);
    if (!ownEntity || ownEntity.organization_id !== input.organizationId) {
      return reply.code(404).send({ error: "NOT_FOUND", message: "Empresa propria nao encontrada." });
    }
    if (!client || client.organization_id !== input.organizationId) {
      return reply.code(404).send({ error: "NOT_FOUND", message: "Cliente nao encontrado." });
    }
    const effect = ledgerEffect(input.entryType, input.effect);
    if (!effect) {
      return reply.code(400).send({ error: "EFFECT_REQUIRED", message: "Informe se o lancamento aumenta ou reduz o saldo a receber." });
    }
    const id = randomUUID();
    const now = new Date().toISOString();
    const status = input.applyNow ? "CONFIRMED" : "DRAFT";
    const availableAmountCents = status === "CONFIRMED" && ["ADVANCE_RECEIVED", "CREDIT", "SURCHARGE", "LOAN"].includes(input.entryType)
      ? input.amountCents : null;
    const data: Record<string, unknown> = {
      id, organization_id: input.organizationId, own_legal_entity_id: input.legalEntityId,
      client_partner_id: input.clientPartnerId, client_charge_id: null, entry_type: input.entryType,
      effect, amount_cents: input.amountCents, entry_date: input.entryDate, description: input.description,
      reference_number: clean(input.referenceNumber), notes: clean(input.notes), attachment_path: null,
      status, available_amount_cents: availableAmountCents, collection_due_date: input.collectionDueDate ?? null,
      collected_at: null, created_at: now, updated_at: now, cancelled_at: null, cancellation_reason: null
    };
    const revision = await commitDomainChanges(pool, session, "WEB_LEDGER_ENTRY_CREATED", "client_ledger_entry", id,
      [{ table: "client_ledger_entries", key: id, operation: "UPSERT", data }],
      { organizationId: input.organizationId, legalEntityId: input.legalEntityId, clientPartnerId: input.clientPartnerId, entryType: input.entryType });
    return reply.code(201).send({ id, revision });
  });

  app.post("/v1/manage/ledger-entries/:id/cancel", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const { reason } = cancelLedgerEntrySchema.parse(request.body);
    const entry = await centralRecord(pool, "client_ledger_entries", id);
    if (!entry) return reply.code(404).send({ error: "NOT_FOUND", message: "Lancamento nao encontrado." });
    const organizationId = String(entry.organization_id ?? "");
    const legalEntityId = String(entry.own_legal_entity_id ?? "");
    if (!(await authorize(pool, session, reply, "finance.manage", organizationId, legalEntityId))) return;
    if (entry.status === "CANCELLED") return { id, alreadyCancelled: true };
    if (["SERVICE_CHARGE", "PAYMENT_RECEIVED", "REVERSAL"].includes(String(entry.entry_type))) {
      return reply.code(409).send({ error: "PROTECTED_ENTRY", message: "Este lancamento deve ser cancelado pela cobranca ou pelo pagamento de origem." });
    }
    const [allocations, adjustments] = await Promise.all([
      centralRecords(pool, "client_credit_allocations"), centralRecords(pool, "client_charge_adjustments")
    ]);
    const used = Boolean(entry.client_charge_id)
      || allocations.some((row) => row.ledger_entry_id === id && !row.cancelled_at)
      || adjustments.some((row) => row.ledger_entry_id === id);
    if (used) {
      return reply.code(409).send({ error: "ENTRY_IN_USE", message: "Este lancamento ja foi usado em uma cobranca e nao pode ser cancelado por aqui." });
    }
    const now = new Date().toISOString();
    const data = { ...entry, status: "CANCELLED", available_amount_cents: 0, cancelled_at: now, cancellation_reason: reason, updated_at: now };
    const revision = await commitDomainChanges(pool, session, "WEB_LEDGER_ENTRY_CANCELLED", "client_ledger_entry", id,
      [{ table: "client_ledger_entries", key: id, operation: "UPSERT", data }],
      { organizationId, legalEntityId, reason });
    return { id, revision };
  });

  app.post("/v1/manage/client-payments", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const input = clientPaymentSchema.parse(request.body);
    const charge = await centralRecord(pool, "client_charges", input.chargeId);
    if (!charge) return reply.code(404).send({ error: "NOT_FOUND", message: "Cobranca nao encontrada." });
    const organizationId = String(charge.organization_id ?? "");
    const legalEntityId = String(charge.own_legal_entity_id ?? "");
    if (!(await authorize(pool, session, reply, "billing.manage", organizationId, legalEntityId))) return;
    if (!["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(String(charge.status ?? ""))) {
      return reply.code(409).send({ error: "INVALID_STATUS", message: "Somente cobrancas emitidas e em aberto aceitam pagamento." });
    }
    const openAmountCents = cents(charge.open_amount_cents);
    if (input.amountCents > openAmountCents) {
      return reply.code(409).send({ error: "AMOUNT_EXCEEDS_OPEN", message: "O valor informado e maior que o saldo em aberto." });
    }
    const paymentId = randomUUID();
    const allocationId = randomUUID();
    const ledgerId = randomUUID();
    const now = new Date().toISOString();
    const paidAmountCents = cents(charge.paid_amount_cents) + input.amountCents;
    const remainingCents = Math.max(0, cents(charge.final_amount_cents) - paidAmountCents);
    const payment: Record<string, unknown> = {
      id: paymentId, organization_id: organizationId, own_legal_entity_id: legalEntityId,
      client_partner_id: charge.client_partner_id, payment_date: input.paymentDate,
      amount_cents: input.amountCents, payment_method: input.paymentMethod,
      bank_account_description: clean(input.bankAccountDescription), transaction_reference: clean(input.transactionReference),
      notes: clean(input.notes), attachment_path: null, status: "CONFIRMED", created_at: now, updated_at: now,
      cancelled_at: null, cancellation_reason: null, receipt_pdf_file_path: null, receipt_image_file_path: null
    };
    const allocation: Record<string, unknown> = {
      id: allocationId, client_payment_id: paymentId, client_charge_id: input.chargeId,
      amount_cents: input.amountCents, allocated_at: now, cancelled_at: null, cancellation_reason: null
    };
    const ledger: Record<string, unknown> = {
      id: ledgerId, organization_id: organizationId, own_legal_entity_id: legalEntityId,
      client_partner_id: charge.client_partner_id, client_charge_id: input.chargeId,
      entry_type: "PAYMENT_RECEIVED", effect: "REDUCE_RECEIVABLE", amount_cents: input.amountCents,
      entry_date: input.paymentDate, description: "Pagamento recebido", reference_number: clean(input.transactionReference),
      notes: clean(input.notes), attachment_path: null, status: "CONFIRMED", available_amount_cents: null,
      collection_due_date: null, collected_at: null, created_at: now, updated_at: now,
      cancelled_at: null, cancellation_reason: null
    };
    const updatedCharge = {
      ...charge, paid_amount_cents: paidAmountCents, open_amount_cents: remainingCents,
      status: chargeStatus(charge, paidAmountCents, remainingCents), updated_at: now
    };
    const revision = await commitDomainChanges(pool, session, "WEB_CLIENT_PAYMENT_CREATED", "client_payment", paymentId, [
      { table: "client_payments", key: paymentId, operation: "UPSERT", data: payment },
      { table: "client_payment_allocations", key: allocationId, operation: "UPSERT", data: allocation },
      { table: "client_ledger_entries", key: ledgerId, operation: "UPSERT", data: ledger },
      { table: "client_charges", key: input.chargeId, operation: "UPSERT", data: updatedCharge }
    ], { organizationId, legalEntityId, chargeId: input.chargeId, amountCents: input.amountCents });
    return reply.code(201).send({ id: paymentId, revision, chargeStatus: updatedCharge.status, openAmountCents: remainingCents });
  });

  app.post("/v1/manage/client-payments/:id/cancel", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const { reason } = cancelClientPaymentSchema.parse(request.body);
    const payment = await centralRecord(pool, "client_payments", id);
    if (!payment) return reply.code(404).send({ error: "NOT_FOUND", message: "Pagamento nao encontrado." });
    const organizationId = String(payment.organization_id ?? "");
    const legalEntityId = String(payment.own_legal_entity_id ?? "");
    if (!(await authorize(pool, session, reply, "billing.manage", organizationId, legalEntityId))) return;
    if (payment.status === "CANCELLED") return { id, alreadyCancelled: true };
    const allocations = (await centralRecords(pool, "client_payment_allocations"))
      .filter((row) => row.client_payment_id === id && !row.cancelled_at);
    if (!allocations.length) {
      return reply.code(409).send({ error: "NO_ACTIVE_ALLOCATION", message: "Este pagamento nao possui baixa ativa para estornar." });
    }
    const now = new Date().toISOString();
    const changes: Array<{ table: string; key: string; operation: "UPSERT"; data: Record<string, unknown> }> = [{
      table: "client_payments", key: id, operation: "UPSERT",
      data: { ...payment, status: "CANCELLED", cancelled_at: now, cancellation_reason: reason, updated_at: now }
    }];
    for (const allocation of allocations) {
      const chargeId = String(allocation.client_charge_id ?? "");
      const charge = await centralRecord(pool, "client_charges", chargeId);
      if (!charge || charge.organization_id !== organizationId || charge.own_legal_entity_id !== legalEntityId || charge.client_partner_id !== payment.client_partner_id) {
        return reply.code(409).send({ error: "SCOPE_MISMATCH", message: "A baixa esta fora do escopo do pagamento." });
      }
      const amountCents = cents(allocation.amount_cents);
      const paidAmountCents = Math.max(0, cents(charge.paid_amount_cents) - amountCents);
      const openAmountCents = Math.max(0, cents(charge.final_amount_cents) - paidAmountCents);
      const reversalId = randomUUID();
      changes.push(
        { table: "client_payment_allocations", key: String(allocation.id), operation: "UPSERT", data: { ...allocation, cancelled_at: now, cancellation_reason: reason } },
        { table: "client_ledger_entries", key: reversalId, operation: "UPSERT", data: {
          id: reversalId, organization_id: organizationId, own_legal_entity_id: legalEntityId,
          client_partner_id: payment.client_partner_id, client_charge_id: chargeId,
          entry_type: "REVERSAL", effect: "INCREASE_RECEIVABLE", amount_cents: amountCents,
          entry_date: now.slice(0, 10), description: "Estorno de pagamento recebido",
          reference_number: payment.transaction_reference ?? null, notes: `Pagamento estornado: ${reason}`,
          attachment_path: null, status: "CONFIRMED", available_amount_cents: null, collection_due_date: null,
          collected_at: null, created_at: now, updated_at: now, cancelled_at: null, cancellation_reason: null
        } },
        { table: "client_charges", key: chargeId, operation: "UPSERT", data: {
          ...charge, paid_amount_cents: paidAmountCents, open_amount_cents: openAmountCents,
          status: chargeStatus(charge, paidAmountCents, openAmountCents), updated_at: now
        } }
      );
    }
    const revision = await commitDomainChanges(pool, session, "WEB_CLIENT_PAYMENT_CANCELLED", "client_payment", id, changes,
      { organizationId, legalEntityId, reason, allocationCount: allocations.length });
    return { id, revision };
  });
}
