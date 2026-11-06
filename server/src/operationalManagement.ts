import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import type pg from "pg";
import { z } from "zod";
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

const clean = (value: string): string | null => value.trim() || null;
const digits = (value: unknown): string => String(value ?? "").replace(/\D/g, "");
const numberValue = (value: unknown): number => {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};
const normalized = (value: unknown): string => String(value ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim().replace(/\s+/g, " ");
const decimal = (value: number): string => Number(value.toFixed(6)).toString();

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

export function registerOperationalManagementRoutes(app: FastifyInstance, pool: pg.Pool): void {
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
}
