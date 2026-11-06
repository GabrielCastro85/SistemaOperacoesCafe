import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import type pg from "pg";
import { z } from "zod";
import { decimalTextToScaled, divideDecimalText, multiplyDecimalByCents, normalizeDecimalText } from "../../src/shared/utils/decimal.js";
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
import { isThirdPartyEntity, resolveThirdPartyEntity, THIRD_PARTY_NOTE } from "./thirdPartyEntities.js";

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
  // Vazio quando a nota e' terceirizada: a emissora vem de issuerPartnerLegalEntityId.
  ownLegalEntityId: z.string().min(1).nullable().optional(),
  issuerPartnerLegalEntityId: z.string().min(1).nullable().optional(),
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
  freightDaeReference: z.string().trim().max(120).nullable().optional(),
  freightDaeAmountCents: z.number().int().min(0).default(0),
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
  freightDaeReference: z.string().trim().max(120).nullable().optional(),
  freightDaeAmountCents: z.number().int().min(0).optional(),
  resolvePendingIssues: z.boolean().default(false)
});

const returnSchema = z.object({
  returnDate: z.string().date(),
  inputUnit: z.enum(["SACKS", "KG"]),
  inputQuantity: decimalText.refine((value) => Number(value) > 0, "Quantidade deve ser maior que zero."),
  reason: z.string().trim().min(2).max(500)
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

// Nota terceirizada nao pertence a um CNPJ proprio: a permissao vale pela organizacao.
async function authorize(pool: pg.Pool, session: WebSession, reply: FastifyReply, document: Row): Promise<boolean> {
  const own = await centralRecord(pool, "legal_entities", text(document.own_legal_entity_id));
  const legalEntityId = isThirdPartyEntity(own) ? null : text(document.own_legal_entity_id);
  return requirePermission(pool, session, reply, "operations.manage", text(document.organization_id), legalEntityId);
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

const DECIMAL_SCALE = 1_000_000n;
function scaledToText(value: bigint): string {
  const whole = value / DECIMAL_SCALE;
  const fraction = (value % DECIMAL_SCALE).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

const activeSales = (operations: Row[]): Row[] => operations
  .filter((row) => text(row.operation_type) === "SALE" && text(row.status) !== "CANCELED")
  .sort((left, right) => text(left.created_at).localeCompare(text(right.created_at)) || text(left.id).localeCompare(text(right.id)));

const grossSacks = (operation: Row): string => text(operation.gross_quantity_sacks_decimal) || text(operation.quantity_sacks_decimal) || "0";

// Como assertReturnCanChangeBilling: depois que a cobranca recebeu pagamento,
// a devolucao nao pode mais mudar o valor dela.
async function assertReturnCanChangeBilling(pool: pg.Pool, operations: Row[]): Promise<void> {
  for (const operation of operations) {
    if (!operation.client_charge_id) continue;
    const charge = await centralRecord(pool, "client_charges", text(operation.client_charge_id));
    if (charge && (numberValue(charge.paid_amount_cents) > 0 || text(charge.status) === "PAID")) {
      throw new HttpError(409, "CHARGE_PAID", "Nao e possivel alterar devolucoes depois que a cobranca recebeu pagamento.");
    }
  }
}

// Espelha recalculateDocumentReturnQuantities e recalculateClientCharge: abate
// as sacas devolvidas das vendas na ordem de criacao e, se a operacao ja esta
// numa cobranca, atualiza o retrato da operacao, os totais e o lancamento de
// servico na conta-corrente.
async function returnRecalculationChanges(pool: pg.Pool, operations: Row[], returns: Row[], now: string): Promise<DomainChange[]> {
  const changes: DomainChange[] = [];
  let remaining = returns.reduce((sum, row) => sum + decimalTextToScaled(text(row.quantity_sacks_decimal) || "0"), 0n);
  const linkUpdates = new Map<string, Row>();
  const changedCharges = new Set<string>();
  for (const operation of activeSales(operations)) {
    const gross = decimalTextToScaled(grossSacks(operation));
    const deducted = remaining > gross ? gross : remaining;
    remaining -= deducted;
    const net = scaledToText(gross - deducted);
    const amount = multiplyDecimalByCents(net, numberValue(operation.applied_rate_value_cents));
    changes.push({ table: "operations", key: text(operation.id), operation: "UPSERT", data: { ...operation, quantity_sacks_decimal: net, service_amount_cents: amount, updated_at: now } });
    if (!operation.client_charge_id) continue;
    const chargeId = text(operation.client_charge_id);
    for (const link of await recordsWhere(pool, "client_charge_operations", "operation_id", [text(operation.id)])) {
      if (text(link.client_charge_id) !== chargeId || link.released_at) continue;
      linkUpdates.set(text(link.id), { ...link, quantity_sacks_decimal_snapshot: net, service_amount_cents_snapshot: amount });
    }
    changedCharges.add(chargeId);
  }
  for (const [key, data] of linkUpdates) changes.push({ table: "client_charge_operations", key, operation: "UPSERT", data });
  for (const chargeId of changedCharges) {
    const charge = await centralRecord(pool, "client_charges", chargeId);
    if (!charge) continue;
    const [links, adjustments, allocations, ledger] = await Promise.all([
      recordsWhere(pool, "client_charge_operations", "client_charge_id", [chargeId]),
      recordsWhere(pool, "client_charge_adjustments", "client_charge_id", [chargeId]),
      recordsWhere(pool, "client_payment_allocations", "client_charge_id", [chargeId]),
      recordsWhere(pool, "client_ledger_entries", "client_charge_id", [chargeId])
    ]);
    const subtotal = links.filter((row) => !row.released_at)
      .reduce((sum, row) => sum + numberValue((linkUpdates.get(text(row.id)) ?? row).service_amount_cents_snapshot), 0);
    const additions = adjustments.filter((row) => text(row.effect) === "INCREASE_RECEIVABLE").reduce((sum, row) => sum + numberValue(row.amount_cents), 0);
    const deductions = adjustments.filter((row) => text(row.effect) === "REDUCE_RECEIVABLE").reduce((sum, row) => sum + numberValue(row.amount_cents), 0);
    const finalAmount = Math.max(0, subtotal + additions - deductions);
    const paid = allocations.filter((row) => !row.cancelled_at).reduce((sum, row) => sum + numberValue(row.amount_cents), 0);
    const open = Math.max(0, finalAmount - paid);
    let status = text(charge.status);
    if (!["DRAFT", "PENDING_REVIEW", "CANCELLED", "REPLACED"].includes(status)) {
      status = open === 0 ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : "ISSUED";
      if (status === "ISSUED" && charge.due_date && text(charge.due_date) < now.slice(0, 10)) status = "OVERDUE";
    }
    changes.push({
      table: "client_charges", key: chargeId, operation: "UPSERT", data: {
        ...charge, subtotal_services_cents: subtotal, additions_cents: additions, deductions_cents: deductions,
        final_amount_cents: finalAmount, paid_amount_cents: paid, open_amount_cents: open, status, updated_at: now
      }
    });
    for (const entry of ledger.filter((row) => text(row.entry_type) === "SERVICE_CHARGE")) {
      changes.push({ table: "client_ledger_entries", key: text(entry.id), operation: "UPSERT", data: { ...entry, amount_cents: finalAmount, updated_at: now } });
    }
  }
  return changes;
}

function daeFields(amountCents: number, reference: string | null | undefined): { freight_dae_amount_cents: number; freight_dae_reference: string | null } {
  return { freight_dae_amount_cents: amountCents, freight_dae_reference: amountCents > 0 ? blank(reference) : null };
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
      const returns = await recordsWhere(pool, "fiscal_document_returns", "fiscal_document_id", [id]);
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
          thirdParty: isThirdPartyEntity(ownEntity),
          responsiblePartnerId: text(document.responsible_partner_id), responsiblePartnerName: partnerName.get(text(document.responsible_partner_id)) ?? null,
          partnerLegalEntityId: document.partner_legal_entity_id ?? null, partnerLegalEntityName: partnerEntity ? text(partnerEntity.legal_name) : null,
          documentNumber: text(document.document_number), series: document.series ?? null, issueDate: text(document.issue_date),
          accessKey: document.access_key ?? null, totalAmountCents: numberValue(document.total_amount_cents), status,
          source: text(document.source), hasPendingIssues: Boolean(document.has_pending_issues), pendingNotes: document.pending_notes ?? null,
          duplicateWarning: document.duplicate_warning ?? null, notes: document.notes ?? null, contractNumber: document.contract_number ?? null,
          billingObservations: document.billing_observations ?? null, hasFinancialService: Boolean(document.has_financial_service),
          cancelReason: document.cancel_reason ?? null, confirmedAt: document.confirmed_at ?? null, canceledAt: document.canceled_at ?? null,
          freightDaeReference: document.freight_dae_reference ?? null, freightDaeAmountCents: numberValue(document.freight_dae_amount_cents)
        },
        returns: returns.sort((left, right) => text(left.return_date).localeCompare(text(right.return_date))).map((row) => ({
          id: text(row.id), returnDate: text(row.return_date), inputUnit: text(row.input_unit), inputQuantity: text(row.input_quantity_decimal),
          quantitySacks: text(row.quantity_sacks_decimal), reason: text(row.reason)
        })),
        items: items.map((row) => ({
          id: text(row.id), productId: row.product_id ?? null, productName: productName.get(text(row.product_id)) ?? null,
          description: text(row.description), quantity: text(row.quantity_decimal), unit: text(row.unit),
          totalAmountCents: numberValue(row.total_amount_cents), sacks: row.sacks_quantity_decimal ?? null
        })),
        operations: operations.map((row) => ({
          id: text(row.id), operationType: text(row.operation_type), operationScope: text(row.operation_scope), status: text(row.status),
          productName: productName.get(text(row.product_id)) ?? null, responsiblePartnerName: partnerName.get(text(row.responsible_partner_id)) ?? null,
          quantitySacks: text(row.quantity_sacks_decimal), grossQuantitySacks: grossSacks(row), rateCents: numberValue(row.applied_rate_value_cents),
          amountCents: numberValue(row.service_amount_cents), manualRate: Boolean(row.rate_was_manually_overridden),
          manualReason: row.manual_override_reason ?? null, billingStatus: text(row.billing_status),
          settlementStatus: text(row.purchase_settlement_status || "UNSETTLED")
        })),
        permissions: {
          canEdit: status !== "CANCELED" && !linked,
          canConfirm: status !== "CANCELED" && status !== "CONFIRMED",
          canCancel: status !== "CANCELED" && !linked,
          canDelete: !linked && !deal,
          canReturn: status !== "CANCELED" && activeSales(operations).length > 0,
          lockedReason: linked ? "Nota vinculada a cobranca ou acerto de entrada." : deal ? "Nota vinculada a confirmacao de negocio ativa." : null
        }
      };
    });
  });

  // Como listUnlinkedPartnerLegalEntities: empresas cadastradas sem cliente ou
  // fornecedor dono, que podem ser a emissora de uma nota terceirizada.
  app.get("/v1/manage/third-party-issuers", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const { organizationId } = z.object({ organizationId: z.string().min(1) }).parse(request.query);
    if (!(await requirePermission(pool, session, reply, "operations.manage", organizationId, null))) return;
    const rows = await centralRecords(pool, "partner_legal_entities");
    return rows
      .filter((row) => !row.business_partner_id && active(row) && (!row.organization_id || row.organization_id === organizationId))
      .filter((row) => text(row.cnpj).replace(/\D/g, "").length === 14)
      .map((row) => ({ id: text(row.id), legalName: text(row.legal_name), tradeName: row.trade_name ?? null, cnpj: text(row.cnpj), state: row.state ?? null }))
      .sort((left, right) => left.legalName.localeCompare(right.legalName, "pt-BR"));
  });

  app.post("/v1/manage/invoices", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const input = createSchema.parse(request.body);
    return send(reply, async () => {
      // Terceirizada (como resolveIssuerLegalEntityFromPartner): a emissora e'
      // uma empresa cadastrada sem ser CNPJ proprio; a nota fica sob a empresa
      // TERC-XML do CNPJ dela e entra apenas em cobrancas.
      const thirdParty = Boolean(input.issuerPartnerLegalEntityId);
      const preChanges: DomainChange[] = [];
      let ownLegalEntityId: string;
      if (input.issuerPartnerLegalEntityId) {
        if (!(await requirePermission(pool, session, reply, "operations.manage", input.organizationId, null))) return;
        const issuer = await centralRecord(pool, "partner_legal_entities", input.issuerPartnerLegalEntityId);
        if (!issuer || !active(issuer)) throw new HttpError(404, "ISSUER_NOT_FOUND", "Empresa emissora nao encontrada.");
        if (text(issuer.cnpj).replace(/\D/g, "").length !== 14) throw new HttpError(409, "THIRD_PARTY_CNPJ", "Empresa emissora sem CNPJ valido cadastrado.");
        const resolvedIssuer = await resolveThirdPartyEntity(pool, input.organizationId, {
          cnpj: text(issuer.cnpj), legalName: text(issuer.legal_name), tradeName: text(issuer.trade_name), stateRegistration: text(issuer.state_registration),
          municipalRegistration: text(issuer.municipal_registration), email: text(issuer.email), phone: text(issuer.phone),
          addressLine: text(issuer.address_line), addressNumber: text(issuer.address_number), addressComplement: text(issuer.address_complement),
          district: text(issuer.district), city: text(issuer.city), state: text(issuer.state), postalCode: text(issuer.postal_code)
        });
        ownLegalEntityId = text(resolvedIssuer.entity.id);
        if (resolvedIssuer.change) preChanges.push(resolvedIssuer.change);
      } else {
        if (!input.ownLegalEntityId) throw new HttpError(400, "OWN_ENTITY_REQUIRED", "Selecione a empresa propria ou a emissora terceirizada.");
        if (!(await requirePermission(pool, session, reply, "operations.manage", input.organizationId, input.ownLegalEntityId))) return;
        const ownEntity = await centralRecord(pool, "legal_entities", input.ownLegalEntityId);
        if (!ownEntity || !active(ownEntity) || text(ownEntity.organization_id) !== input.organizationId || isThirdPartyEntity(ownEntity)) {
          throw new HttpError(404, "OWN_ENTITY_NOT_FOUND", "Empresa propria nao encontrada nesta organizacao.");
        }
        ownLegalEntityId = input.ownLegalEntityId;
      }
      const partnerLegalEntityId = thirdParty ? null : input.partnerLegalEntityId ?? null;
      const partner = await assertResponsible(pool, input.responsiblePartnerId, input.operationType);
      if (partnerLegalEntityId && !(await centralRecord(pool, "partner_legal_entities", partnerLegalEntityId))) {
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
        const resolved = resolveRate(rules, input.operationType, input.organizationId, input.responsiblePartnerId, ownLegalEntityId,
          partnerLegalEntityId, item.productId, input.operationScope, input.issueDate, input.operationType === "SALE" && input.hasFinancialService);
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
          own_legal_entity_id: ownLegalEntityId, responsible_partner_id: input.responsiblePartnerId, product_id: item.productId,
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
          id: documentId, organization_id: input.organizationId, own_legal_entity_id: ownLegalEntityId,
          responsible_partner_id: input.responsiblePartnerId, partner_legal_entity_id: partnerLegalEntityId,
          secondary_responsible_partner_id: null, secondary_operation_type: null, document_type: "MANUAL_INVOICE",
          access_key: input.accessKey ?? null, document_number: input.documentNumber, series: blank(input.series),
          issue_date: input.issueDate, total_amount_cents: input.totalAmountCents, status, has_pending_issues: pending ? 1 : 0,
          pending_notes: pending ? pendingReasons.join("; ") : null, duplicate_warning: duplicateWarning,
          notes: thirdParty ? [THIRD_PARTY_NOTE, blank(input.notes)].filter(Boolean).join(" | ") : blank(input.notes),
          confirmed_at: input.confirm ? now : null, canceled_at: null, cancel_reason: null, source: "MANUAL",
          import_job_id: null, import_row_id: null, xml_file_path: null, xml_file_hash: null, protocol_number: null, protocol_date: null,
          authorization_status_code: null, authorization_status_message: null, xml_import_job_id: null, merged_from_source: null, merged_at: null,
          direction: input.operationType === "PURCHASE" ? "INBOUND" : "OUTBOUND", fiscal_snapshot_json: null,
          contract_number: blank(input.contractNumber), billing_observations: null, ...daeFields(input.freightDaeAmountCents, input.freightDaeReference),
          has_financial_service: input.operationType === "SALE" && input.hasFinancialService ? 1 : 0, created_at: now, updated_at: now
        }
      });
      const revision = await commitDomainChanges(pool, session, "WEB_INVOICE_CREATED", "fiscal_document", documentId, [...preChanges, ...changes], {
        organizationId: input.organizationId, legalEntityId: ownLegalEntityId, itemCount: input.items.length, status, thirdParty
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
          ...daeFields(
            input.freightDaeAmountCents ?? numberValue(document.freight_dae_amount_cents),
            input.freightDaeReference === undefined ? text(document.freight_dae_reference) || null : input.freightDaeReference
          ),
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

  app.post("/v1/manage/invoices/:id/returns", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = returnSchema.parse(request.body);
    return send(reply, async () => {
      const { document, operations } = await loadDocument(pool, id);
      if (!(await authorize(pool, session, reply, document))) return;
      if (text(document.status) === "CANCELED") throw new HttpError(409, "DOCUMENT_CANCELED", "Nota cancelada nao aceita devolucao.");
      if (isPackagingDocument({ documentNotes: text(document.notes) || null, overrideReasons: operations.map((row) => text(row.manual_override_reason) || null) })) {
        throw new HttpError(409, "PACKAGING_DOCUMENT", "Remessa de sacaria nao tem sacas de cafe para devolver.");
      }
      const sales = activeSales(operations);
      if (!sales.length) throw new HttpError(409, "NO_SALE", "Esta nota nao possui operacao de venda para ajustar na cobranca.");
      await assertReturnCanChangeBilling(pool, sales);
      const quantitySacks = input.inputUnit === "KG" ? divideDecimalText(input.inputQuantity, "60") : input.inputQuantity;
      const existing = await recordsWhere(pool, "fiscal_document_returns", "fiscal_document_id", [id]);
      const gross = sales.reduce((sum, row) => sum + decimalTextToScaled(grossSacks(row)), 0n);
      const returned = existing.reduce((sum, row) => sum + decimalTextToScaled(text(row.quantity_sacks_decimal) || "0"), 0n);
      if (returned + decimalTextToScaled(quantitySacks) > gross) {
        throw new HttpError(409, "RETURN_EXCEEDS", "A devolucao informada ultrapassa a quantidade original da nota.");
      }
      const now = new Date().toISOString();
      const returnId = randomUUID();
      const returnRow: Row = {
        id: returnId, fiscal_document_id: id, return_date: input.returnDate, input_unit: input.inputUnit,
        input_quantity_decimal: input.inputQuantity, quantity_sacks_decimal: quantitySacks, reason: input.reason, created_at: now, updated_at: now
      };
      const changes: DomainChange[] = [
        { table: "fiscal_document_returns", key: returnId, operation: "UPSERT", data: returnRow },
        ...await returnRecalculationChanges(pool, operations, [...existing, returnRow], now)
      ];
      const revision = await commitDomainChanges(pool, session, "WEB_INVOICE_RETURN_ADDED", "fiscal_document", id, changes, {
        organizationId: text(document.organization_id), legalEntityId: text(document.own_legal_entity_id), quantitySacks
      });
      return reply.code(201).send({ id: returnId, revision, quantitySacks });
    });
  });

  app.delete("/v1/manage/invoice-returns/:id", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    return send(reply, async () => {
      const row = await centralRecord(pool, "fiscal_document_returns", id);
      if (!row) throw new HttpError(404, "NOT_FOUND", "Devolucao nao encontrada.");
      const documentId = text(row.fiscal_document_id);
      const { document, operations } = await loadDocument(pool, documentId);
      if (!(await authorize(pool, session, reply, document))) return;
      await assertReturnCanChangeBilling(pool, activeSales(operations));
      const now = new Date().toISOString();
      const remaining = (await recordsWhere(pool, "fiscal_document_returns", "fiscal_document_id", [documentId])).filter((item) => item.id !== id);
      const changes: DomainChange[] = [
        { table: "fiscal_document_returns", key: id, operation: "DELETE" },
        ...await returnRecalculationChanges(pool, operations, remaining, now)
      ];
      const revision = await commitDomainChanges(pool, session, "WEB_INVOICE_RETURN_DELETED", "fiscal_document", documentId, changes, {
        organizationId: text(document.organization_id), legalEntityId: text(document.own_legal_entity_id)
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
