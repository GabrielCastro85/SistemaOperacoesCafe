import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type pg from "pg";
import { z } from "zod";
import { buildChargePdf, type ChargeDocumentsInput } from "../../electron/main/services/chargeDocuments.js";
import { resolveSession } from "./auth.js";

type JsonRecord = Record<string, unknown>;
type Session = NonNullable<Awaited<ReturnType<typeof resolveSession>>>;

const filterSchema = z.object({
  organizationId: z.string().min(1),
  legalEntityId: z.string().min(1).optional(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

const scopeSchema = z.object({
  organizationId: z.string().min(1),
  legalEntityId: z.string().min(1).optional()
});

const rateRuleListSchema = scopeSchema.extend({
  kind: z.enum(["SERVICE", "PURCHASE"])
});

const reportListSchema = scopeSchema.extend({
  year: z.coerce.number().int().min(2000).max(2200)
});

const chargeListSchema = filterSchema.extend({
  clientId: z.string().min(1).optional(),
  status: z.enum(["OPEN", "PAID", "ALL"]).default("ALL")
});

const openNoteListSchema = filterSchema.extend({
  clientId: z.string().min(1).optional()
});

const confirmationListSchema = filterSchema.extend({
  status: z.enum(["OPEN", "SIGNED", "ALL"]).default("ALL")
});

const ledgerListSchema = filterSchema.extend({
  clientId: z.string().min(1)
});

const invoiceListSchema = filterSchema.extend({
  direction: z.enum(["ALL", "INBOUND", "OUTBOUND"]).default("ALL"),
  status: z.enum(["ACTIVE", "PENDING", "CANCELED", "ALL"]).default("ACTIVE")
});

const warehouseListSchema = filterSchema.extend({
  warehouseCnpj: z.string().optional(),
  status: z.enum(["ALL", "ACTIVE", "CANCELED", "PENDING_REVIEW"]).default("ALL")
});

function text(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function nullableText(value: unknown): string | null {
  const result = text(value).trim();
  return result || null;
}

function numberValue(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function isActive(row: JsonRecord): boolean {
  return row.is_active === undefined || booleanValue(row.is_active);
}

async function records(pool: pg.Pool, table: string): Promise<JsonRecord[]> {
  const result = await pool.query<{ row_data: JsonRecord }>(
    "SELECT row_data FROM central_records WHERE table_name = $1 AND deleted = false AND row_data IS NOT NULL",
    [table]
  );
  return result.rows.map((row) => row.row_data);
}

async function record(pool: pg.Pool, table: string, id: string): Promise<JsonRecord | null> {
  const result = await pool.query<{ row_data: JsonRecord }>(
    "SELECT row_data FROM central_records WHERE table_name = $1 AND row_key = $2 AND deleted = false",
    [table, id]
  );
  return result.rows[0]?.row_data ?? null;
}

async function requireSession(pool: pg.Pool, request: FastifyRequest, reply: FastifyReply): Promise<Session | null> {
  const session = await resolveSession(pool, request);
  if (!session) {
    await reply.code(401).send({ error: "UNAUTHORIZED", message: "Sessao expirada. Entre novamente." });
    return null;
  }
  return session;
}

async function allowedScopes(pool: pg.Pool, userId: string): Promise<Array<{ organizationId: string; legalEntityId: string | null; accessMode: string }>> {
  const result = await pool.query<{ desktop_profile: unknown }>("SELECT desktop_profile FROM app_users WHERE id = $1", [userId]);
  const profile = result.rows[0]?.desktop_profile;
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return [];
  const access = (profile as { legalEntityAccess?: unknown }).legalEntityAccess;
  if (!Array.isArray(access)) return [];
  return access.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const value = item as Record<string, unknown>;
    const organizationId = text(value.organizationId);
    if (!organizationId) return [];
    return [{ organizationId, legalEntityId: nullableText(value.legalEntityId), accessMode: text(value.accessMode) }];
  });
}

function canAccess(scopes: Array<{ organizationId: string; legalEntityId: string | null; accessMode: string }>, organizationId: string, legalEntityId?: string): boolean {
  if (scopes.length === 0) return true;
  return scopes.some((scope) => scope.organizationId === organizationId && (
    scope.accessMode === "ALL" || !legalEntityId || scope.legalEntityId === legalEntityId
  ));
}

async function assertScope(pool: pg.Pool, session: Session, reply: FastifyReply, organizationId: string, legalEntityId?: string): Promise<boolean> {
  if (canAccess(await allowedScopes(pool, session.userId), organizationId, legalEntityId)) return true;
  await reply.code(403).send({ error: "ACCESS_DENIED", message: "Usuario sem acesso a esta empresa." });
  return false;
}

function inScope(row: JsonRecord, filters: z.infer<typeof filterSchema>): boolean {
  return text(row.organization_id) === filters.organizationId
    && (!filters.legalEntityId || text(row.own_legal_entity_id) === filters.legalEntityId);
}

function inOrganizationScope(row: JsonRecord, organizationId: string, legalEntityId?: string): boolean {
  return text(row.organization_id) === organizationId
    && (!legalEntityId || !row.own_legal_entity_id || text(row.own_legal_entity_id) === legalEntityId);
}

function inPeriod(value: unknown, start: string, end: string): boolean {
  const date = text(value).slice(0, 10);
  return Boolean(date) && date >= start && date <= end;
}

function openCharge(row: JsonRecord): boolean {
  return !["PAID", "CANCELLED", "REPLACED"].includes(text(row.status));
}

function sanitizeFileName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "cobranca";
}

function mapOrganization(row: JsonRecord): ChargeDocumentsInput["organization"] {
  return {
    id: text(row.id), slug: text(row.slug), displayName: text(row.display_name), appDisplayName: text(row.app_display_name) || text(row.display_name),
    logoPath: nullableText(row.logo_path), primaryColor: text(row.primary_color) || "#17130f",
    secondaryColor: text(row.secondary_color) || "#f8f5ed", accentColor: text(row.accent_color) || "#1d7a4c"
  } as ChargeDocumentsInput["organization"];
}

function mapLegalEntity(row: JsonRecord): ChargeDocumentsInput["ownLegalEntity"] {
  return {
    id: text(row.id), organizationId: text(row.organization_id), legalName: text(row.legal_name) || text(row.trade_name), tradeName: text(row.trade_name),
    cnpj: nullableText(row.cnpj), stateRegistration: nullableText(row.state_registration),
    defaultBankName: nullableText(row.default_bank_name), defaultBankCode: nullableText(row.default_bank_code),
    defaultBankAgency: nullableText(row.default_bank_agency), defaultBankAccount: nullableText(row.default_bank_account),
    defaultPixKey: nullableText(row.default_pix_key)
  } as ChargeDocumentsInput["ownLegalEntity"];
}

function mapClient(row: JsonRecord): ChargeDocumentsInput["client"] {
  return { id: text(row.id), displayName: text(row.display_name) } as ChargeDocumentsInput["client"];
}

function mapCharge(row: JsonRecord): ChargeDocumentsInput["detail"]["charge"] {
  return {
    id: text(row.id), organizationId: text(row.organization_id), ownLegalEntityId: text(row.own_legal_entity_id),
    clientPartnerId: text(row.client_partner_id), billingProfileId: nullableText(row.billing_profile_id), chargeNumber: nullableText(row.charge_number),
    referenceCode: nullableText(row.reference_code), periodicity: text(row.periodicity), periodStart: text(row.period_start), periodEnd: text(row.period_end),
    issueDate: nullableText(row.issue_date), dueDate: nullableText(row.due_date), status: text(row.status),
    subtotalServicesCents: numberValue(row.subtotal_services_cents), additionsCents: numberValue(row.additions_cents), deductionsCents: numberValue(row.deductions_cents),
    finalAmountCents: numberValue(row.final_amount_cents), paidAmountCents: numberValue(row.paid_amount_cents), openAmountCents: numberValue(row.open_amount_cents),
    notes: nullableText(row.notes), internalNotes: nullableText(row.internal_notes), pdfFilePath: null, pdfFileHash: null, excelFilePath: null, imageFilePath: null,
    snapshotJson: nullableText(row.snapshot_json), createdAt: text(row.created_at), updatedAt: text(row.updated_at), issuedAt: nullableText(row.issued_at),
    cancelledAt: nullableText(row.cancelled_at), cancellationReason: nullableText(row.cancellation_reason), replacedByChargeId: nullableText(row.replaced_by_charge_id)
  } as ChargeDocumentsInput["detail"]["charge"];
}

function snapshotParty(document: JsonRecord, key: "issuer" | "recipient"): JsonRecord | null {
  try {
    const parsed = JSON.parse(text(document.fiscal_snapshot_json)) as JsonRecord;
    const party = parsed[key];
    return party && typeof party === "object" && !Array.isArray(party) ? party as JsonRecord : null;
  } catch { return null; }
}

function partyName(party: JsonRecord | null): string | null {
  return party ? nullableText(party.legalName) ?? nullableText(party.tradeName) : null;
}

function fiscalCounterpartyName(document: JsonRecord, own: JsonRecord | undefined, responsible: JsonRecord | undefined): string {
  const issuer = snapshotParty(document, "issuer");
  const recipient = snapshotParty(document, "recipient");
  const issuerDocument = digits(issuer?.cnpjCpf) || text(document.access_key).slice(6, 20);
  const recipientDocument = digits(recipient?.cnpjCpf);
  const ownDocument = digits(own?.cnpj);
  const issuerName = partyName(issuer);
  const recipientName = partyName(recipient);
  if (ownDocument && issuerDocument === ownDocument) return (recipientName ?? issuerName ?? text(responsible?.display_name)) || "Nao informado";
  if (ownDocument && recipientDocument === ownDocument) return (issuerName ?? recipientName ?? text(responsible?.display_name)) || "Nao informado";
  if (text(document.direction) === "INBOUND") return (issuerName ?? recipientName ?? text(responsible?.display_name)) || "Nao informado";
  return (recipientName ?? issuerName ?? text(responsible?.display_name)) || "Nao informado";
}

function confirmationPartySnapshotName(row: JsonRecord): string | null {
  try {
    const snapshot = JSON.parse(text(row.snapshot_json)) as JsonRecord;
    return nullableText(snapshot.legalName)
      ?? nullableText(snapshot.tradeName)
      ?? nullableText(snapshot.displayName)
      ?? nullableText(snapshot.name);
  } catch {
    return null;
  }
}

function confirmationCounterparty(
  confirmationId: string,
  ownLegalEntityId: string,
  parties: JsonRecord[],
  partners: Map<string, JsonRecord>,
  partnerEntities: Map<string, JsonRecord>
): { name: string; role: string | null } {
  const candidates = parties
    .filter((row) => text(row.deal_confirmation_id) === confirmationId)
    .filter((row) => ["SELLER", "BUYER"].includes(text(row.party_role)))
    .sort((left, right) => numberValue(left.sort_order) - numberValue(right.sort_order));
  const counterparty = candidates.find((row) => text(row.own_legal_entity_id) !== ownLegalEntityId) ?? candidates[0];
  if (!counterparty) return { name: "Nao informado", role: null };
  const partner = partners.get(text(counterparty.business_partner_id));
  const partnerEntity = partnerEntities.get(text(counterparty.partner_legal_entity_id));
  return {
    name: nullableText(counterparty.manual_name)
      ?? nullableText(partnerEntity?.legal_name)
      ?? nullableText(partnerEntity?.trade_name)
      ?? nullableText(partner?.display_name)
      ?? confirmationPartySnapshotName(counterparty)
      ?? "Nao informado",
    role: nullableText(counterparty.party_role)
  };
}

function digits(value: unknown): string {
  return text(value).replace(/\D/g, "");
}

function normalized(value: unknown): string {
  return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function warehouseIdentity(row: JsonRecord): string {
  const cnpj = digits(row.warehouse_cnpj);
  const name = normalized(row.warehouse_name).toUpperCase();
  return `${text(row.own_legal_entity_id)}:${cnpj || `NAME:${name}`}`;
}

function warehouseProductFamily(value: unknown): "ARABICA" | "CONILON" | null {
  const description = normalized(value).toUpperCase();
  if (/\bARABICA\b/.test(description)) return "ARABICA";
  if (/\b(?:CONILON|ROBUSTA)\b/.test(description)) return "CONILON";
  return null;
}

function isThirdPartyEntity(row: JsonRecord | undefined): boolean {
  if (!row) return false;
  return text(row.document_prefix) === "TERC-XML"
    || normalized(`${text(row.trade_name)} ${text(row.legal_name)}`).includes("terceirizad");
}

function operationPartyLabels(
  operation: JsonRecord,
  document: JsonRecord,
  own: JsonRecord,
  partners: Map<string, JsonRecord>,
  partnerEntities: Map<string, JsonRecord>
): { issuer: string | null; destination: string | null } {
  const issuerParty = snapshotParty(document, "issuer");
  const recipientParty = snapshotParty(document, "recipient");
  const issuer = partyName(issuerParty);
  if (document.secondary_responsible_partner_id) {
    return {
      issuer,
      destination: nullableText(partners.get(text(operation.responsible_partner_id))?.display_name) ?? partyName(recipientParty)
    };
  }
  const linked = partnerEntities.get(text(document.partner_legal_entity_id));
  if (linked) {
    return { issuer, destination: nullableText(linked.legal_name) ?? nullableText(linked.trade_name) };
  }
  const issuerDocument = digits(issuerParty?.cnpjCpf) || text(document.access_key).slice(6, 20);
  const recipientDocument = digits(recipientParty?.cnpjCpf);
  const ownDocument = digits(own.cnpj);
  const issuerName = partyName(issuerParty);
  const recipientName = partyName(recipientParty);
  if (ownDocument && issuerDocument === ownDocument) return { issuer, destination: recipientName ?? issuerName };
  if (ownDocument && recipientDocument === ownDocument) return { issuer, destination: issuerName ?? recipientName };
  if (document.direction === "INBOUND") return { issuer, destination: issuerName ?? recipientName };
  return { issuer, destination: recipientName ?? issuerName };
}

function refreshedOperationSnapshots(
  row: JsonRecord,
  sourceOperations: Map<string, JsonRecord>,
  documents: Map<string, JsonRecord>,
  legalEntities: Map<string, JsonRecord>,
  partners: Map<string, JsonRecord>,
  partnerEntities: Map<string, JsonRecord>
): { issuer: string | null; destination: string | null } {
  const source = sourceOperations.get(text(row.operation_id));
  const document = source ? documents.get(text(source.fiscal_document_id)) : null;
  const own = source ? legalEntities.get(text(source.own_legal_entity_id)) : null;
  if (!source || !document || !own) return { issuer: nullableText(row.issuer_name_snapshot), destination: nullableText(row.destination_name_snapshot) };
  const issuerParty = snapshotParty(document, "issuer");
  const recipientParty = snapshotParty(document, "recipient");
  const issuer = partyName(issuerParty) ?? nullableText(row.issuer_name_snapshot);
  if (document.secondary_responsible_partner_id && text(source.operation_type) === "SALE") {
    return { issuer, destination: nullableText(partners.get(text(source.responsible_partner_id))?.display_name) ?? nullableText(row.destination_name_snapshot) };
  }
  const linked = partnerEntities.get(text(document.partner_legal_entity_id));
  if (linked) return { issuer, destination: nullableText(linked.legal_name) ?? nullableText(linked.trade_name) };
  const issuerDocument = digits(issuerParty?.cnpjCpf) || text(document.access_key).slice(6, 20);
  const recipientDocument = digits(recipientParty?.cnpjCpf);
  const ownDocument = digits(own.cnpj);
  const issuerName = partyName(issuerParty);
  const recipientName = partyName(recipientParty);
  let destination: string | null;
  if (ownDocument && issuerDocument === ownDocument) destination = recipientName ?? issuerName;
  else if (ownDocument && recipientDocument === ownDocument) destination = issuerName ?? recipientName;
  else if (document.direction === "INBOUND") destination = issuerName ?? recipientName;
  else if (document.direction === "OUTBOUND") destination = recipientName ?? issuerName;
  else destination = issuerName ?? recipientName;
  return { issuer, destination: destination ?? nullableText(row.destination_name_snapshot) };
}

export function registerViewerRoutes(app: FastifyInstance, pool: pg.Pool): void {
  app.get("/v1/viewer/context", async (request, reply) => {
    const session = await requireSession(pool, request, reply);
    if (!session) return;
    const scopes = await allowedScopes(pool, session.userId);
    const organizations = (await records(pool, "organizations")).filter(isActive).filter((row) => scopes.length === 0 || scopes.some((scope) => scope.organizationId === row.id));
    const legalEntities = (await records(pool, "legal_entities")).filter(isActive).filter((row) => text(row.document_prefix) !== "TERC-XML")
      .filter((row) => canAccess(scopes, text(row.organization_id), text(row.id)));
    return {
      user: { id: session.userId, username: session.username, displayName: session.displayName },
      organizations: organizations.map((row) => ({ id: text(row.id), slug: text(row.slug), displayName: text(row.display_name), appDisplayName: text(row.app_display_name) || text(row.display_name), logoPath: nullableText(row.logo_path), primaryColor: text(row.primary_color), secondaryColor: text(row.secondary_color), accentColor: text(row.accent_color) })),
      legalEntities: legalEntities.map((row) => ({ id: text(row.id), organizationId: text(row.organization_id), tradeName: text(row.trade_name), cnpj: nullableText(row.cnpj), state: nullableText(row.state) }))
    };
  });

  app.get("/v1/viewer/dashboard", async (request, reply) => {
    const session = await requireSession(pool, request, reply);
    if (!session) return;
    const filters = filterSchema.parse(request.query);
    if (!(await assertScope(pool, session, reply, filters.organizationId, filters.legalEntityId))) return;
    const [allOperations, allCharges, allPartners] = await Promise.all([
      records(pool, "operations"), records(pool, "client_charges"), records(pool, "business_partners")
    ]);
    const operations = allOperations.filter((row) => inScope(row, filters) && text(row.status) !== "CANCELED" && inPeriod(row.operation_date, filters.periodStart, filters.periodEnd));
    const sales = operations.filter((row) => text(row.operation_type) !== "PURCHASE");
    const globalSales = allOperations.filter((row) => text(row.operation_type) !== "PURCHASE" && text(row.status) !== "CANCELED"
      && inPeriod(row.operation_date, filters.periodStart, filters.periodEnd));
    const charges = allCharges.filter((row) => inScope(row, filters) && text(row.status) !== "CANCELLED" && inPeriod(row.period_start, filters.periodStart, filters.periodEnd));
    // "A receber" e "Recebido" replicam getBillingSummary({ includeAllCompanies: true })
    // do app desktop (electron/main/services/appRepository.ts) -- la' esses dois cards
    // do Dashboard somam todas as organizacoes de proposito (rotulados "Todas as
    // empresas" na tela), diferente do resto deste endpoint que e' escopado pela
    // empresa selecionada. Sem isso o site mostrava um numero por-empresa que nunca
    // bate com o card do app pro mesmo periodo.
    const globalCharges = allCharges.filter((row) => text(row.status) !== "CANCELLED" && inPeriod(row.period_start, filters.periodStart, filters.periodEnd));
    const globalUnbilled = allOperations.filter((row) => text(row.operation_type) !== "PURCHASE" && text(row.status) !== "CANCELED"
      && text(row.billing_status) === "UNBILLED" && inPeriod(row.operation_date, filters.periodStart, filters.periodEnd));
    const chargeById = new Map(allCharges.map((row) => [text(row.id), row]));
    const globalReceivedForOperationsPeriodCents = allOperations
      .filter((row) => text(row.operation_type) === "SALE" && ["DRAFT", "CONFIRMED"].includes(text(row.status))
        && text(chargeById.get(text(row.client_charge_id))?.status) === "PAID"
        && inPeriod(row.operation_date, filters.periodStart, filters.periodEnd))
      .reduce((sum, row) => sum + numberValue(row.service_amount_cents), 0);
    const today = new Date().toISOString().slice(0, 10);
    const partnerNameById = new Map(allPartners.map((row) => [text(row.id), text(row.display_name) || "Cliente"]));
    const isOverdueCharge = (row: Record<string, unknown>): boolean => {
      const dueDate = nullableText(row.due_date);
      return ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(text(row.status))
        && numberValue(row.open_amount_cents) > 0
        && Boolean(dueDate && dueDate < today);
    };
    const overdueCharges = allCharges
      // O desktop calcula OVERDUE ao ler uma cobranca ISSUED cuja data venceu.
      // O servidor central pode ainda guardar ISSUED quando essa atualizacao local
      // nao sincronizou, portanto a consulta web precisa aplicar a mesma regra.
      .filter((row) => inScope(row, filters) && isOverdueCharge(row))
      .map((row) => {
        const dueDate = nullableText(row.due_date);
        const daysOverdue = dueDate
          ? Math.max(0, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / 86_400_000))
          : 0;
        return {
          chargeId: text(row.id),
          chargeNumber: nullableText(row.charge_number),
          partnerName: partnerNameById.get(text(row.client_partner_id)) ?? "Cliente",
          dueDate,
          daysOverdue,
          openAmountCents: numberValue(row.open_amount_cents)
        };
      })
      .sort((left, right) => right.daysOverdue - left.daysOverdue || left.partnerName.localeCompare(right.partnerName, "pt-BR"));
    return {
      periodStart: filters.periodStart,
      periodEnd: filters.periodEnd,
      sacks: sales.reduce((sum, row) => sum + numberValue(row.quantity_sacks_decimal), 0),
      operationCount: sales.length,
      receivableCents: globalCharges.reduce((sum, row) => sum + numberValue(row.open_amount_cents), 0) + globalUnbilled.reduce((sum, row) => sum + numberValue(row.service_amount_cents), 0),
      receivedCents: globalReceivedForOperationsPeriodCents,
      generatedServiceCents: globalSales.reduce((sum, row) => sum + numberValue(row.service_amount_cents), 0),
      unbilledCount: globalUnbilled.length,
      overdueCents: charges.filter(isOverdueCharge).reduce((sum, row) => sum + numberValue(row.open_amount_cents), 0),
      overdueCharges
    };
  });

  app.get("/v1/viewer/invoices", async (request, reply) => {
    const session = await requireSession(pool, request, reply);
    if (!session) return;
    const filters = invoiceListSchema.parse(request.query);
    if (!(await assertScope(pool, session, reply, filters.organizationId, filters.legalEntityId))) return;
    const [documents, items, operations, entities, partners] = await Promise.all([
      records(pool, "fiscal_documents"), records(pool, "fiscal_document_items"), records(pool, "operations"),
      records(pool, "legal_entities"), records(pool, "business_partners")
    ]);
    const entityMap = new Map(entities.map((row) => [text(row.id), row]));
    const partnerMap = new Map(partners.map((row) => [text(row.id), row]));
    const itemsByDocument = new Map<string, JsonRecord[]>();
    const operationsByDocument = new Map<string, JsonRecord[]>();
    for (const item of items) {
      const documentId = text(item.fiscal_document_id);
      itemsByDocument.set(documentId, [...(itemsByDocument.get(documentId) ?? []), item]);
    }
    for (const operation of operations) {
      const documentId = text(operation.fiscal_document_id);
      operationsByDocument.set(documentId, [...(operationsByDocument.get(documentId) ?? []), operation]);
    }
    return documents
      .filter((row) => inScope(row, filters) && inPeriod(row.issue_date, filters.periodStart, filters.periodEnd))
      .filter((row) => filters.direction === "ALL" || text(row.direction) === filters.direction)
      .filter((row) => {
        const status = text(row.status);
        if (filters.status === "ALL") return true;
        if (filters.status === "CANCELED") return status === "CANCELED";
        if (filters.status === "PENDING") return status === "PENDING" || booleanValue(row.has_pending_issues);
        return status !== "CANCELED";
      })
      .map((row) => {
        const documentId = text(row.id);
        const documentItems = itemsByDocument.get(documentId) ?? [];
        const documentOperations = operationsByDocument.get(documentId) ?? [];
        const own = entityMap.get(text(row.own_legal_entity_id));
        const responsible = partnerMap.get(text(row.responsible_partner_id));
        const productNames = Array.from(new Set(documentItems.map((item) => text(item.description).trim()).filter(Boolean)));
        const operationTypes = Array.from(new Set(documentOperations.map((operation) => text(operation.operation_type)).filter(Boolean)));
        const issuer = snapshotParty(row, "issuer");
        const recipient = snapshotParty(row, "recipient");
        return {
          id: documentId,
          documentNumber: text(row.document_number),
          series: nullableText(row.series),
          issueDate: text(row.issue_date),
          status: text(row.status),
          direction: text(row.direction) || "UNKNOWN",
          source: text(row.source) || "MANUAL",
          ownLegalEntityName: nullableText(own?.trade_name) ?? nullableText(own?.legal_name) ?? "Empresa",
          responsiblePartnerName: nullableText(responsible?.display_name),
          counterpartyName: fiscalCounterpartyName(row, own, responsible),
          issuerName: partyName(issuer),
          recipientName: partyName(recipient),
          totalAmountCents: numberValue(row.total_amount_cents),
          sacks: documentItems.reduce((sum, item) => sum + (
            item.sacks_quantity_decimal == null && text(item.unit) === "SACK"
              ? numberValue(item.quantity_decimal)
              : numberValue(item.sacks_quantity_decimal)
          ), 0),
          productNames,
          operationTypes,
          hasPendingIssues: booleanValue(row.has_pending_issues),
          pendingNotes: nullableText(row.pending_notes)
        };
      })
      .sort((left, right) => right.issueDate.localeCompare(left.issueDate)
        || right.documentNumber.localeCompare(left.documentNumber, "pt-BR", { numeric: true }));
  });

  app.get("/v1/viewer/warehouses", async (request, reply) => {
    const session = await requireSession(pool, request, reply);
    if (!session) return;
    const filters = warehouseListSchema.parse(request.query);
    if (!(await assertScope(pool, session, reply, filters.organizationId, filters.legalEntityId))) return;
    const [allMovements, entities] = await Promise.all([
      records(pool, "warehouse_movements"), records(pool, "legal_entities")
    ]);
    const entityMap = new Map(entities.map((row) => [text(row.id), row]));
    const scoped = allMovements.filter((row) => inScope(row, filters));
    const active = scoped.filter((row) => text(row.status) === "ACTIVE");
    const manualProducts = new Map<string, Map<string, string>>();
    const manualWarehouseNames = new Map<string, string>();
    for (const row of active) {
      if (text(row.origin) !== "MANUAL") continue;
      const identity = warehouseIdentity(row);
      manualWarehouseNames.set(identity, text(row.warehouse_name));
      const description = text(row.product_description);
      const family = warehouseProductFamily(description);
      const productKey = family ?? `TEXT:${normalized(description).toUpperCase()}`;
      const products = manualProducts.get(identity) ?? new Map<string, string>();
      products.set(productKey, description);
      manualProducts.set(identity, products);
    }
    const balanceMap = new Map<string, {
      ownLegalEntityId: string; ownLegalEntityName: string; warehouseName: string; warehouseCnpj: string | null;
      productDescription: string; quantityKg: number;
    }>();
    for (const row of active) {
      const identity = warehouseIdentity(row);
      const description = text(row.product_description);
      const family = warehouseProductFamily(description);
      const knownProducts = manualProducts.get(identity);
      let productKey: string = family ?? `TEXT:${normalized(description).toUpperCase()}`;
      let productDescription = family ? knownProducts?.get(family) ?? family : description;
      if (!family && knownProducts?.size === 1) {
        const onlyProduct = [...knownProducts.entries()][0];
        productKey = onlyProduct[0];
        productDescription = onlyProduct[1];
      }
      const balanceKey = `${identity}:${productKey}`;
      const own = entityMap.get(text(row.own_legal_entity_id));
      const current = balanceMap.get(balanceKey) ?? {
        ownLegalEntityId: text(row.own_legal_entity_id),
        ownLegalEntityName: nullableText(own?.trade_name) ?? nullableText(own?.legal_name) ?? "Empresa",
        warehouseName: manualWarehouseNames.get(identity) ?? text(row.warehouse_name),
        warehouseCnpj: digits(row.warehouse_cnpj) || null,
        productDescription,
        quantityKg: 0
      };
      current.quantityKg += (text(row.movement_type) === "DEPOSIT" ? 1 : -1) * numberValue(row.quantity_kg_decimal);
      balanceMap.set(balanceKey, current);
    }
    const balances = [...balanceMap.values()]
      .filter((row) => Math.abs(row.quantityKg) > 0.0001)
      .map((row) => ({ ...row, quantitySacks: row.quantityKg / 60 }))
      .sort((left, right) => left.warehouseName.localeCompare(right.warehouseName, "pt-BR")
        || left.productDescription.localeCompare(right.productDescription, "pt-BR")
        || left.ownLegalEntityName.localeCompare(right.ownLegalEntityName, "pt-BR"));
    const totalKg = active.reduce((sum, row) => sum + (text(row.movement_type) === "DEPOSIT" ? 1 : -1) * numberValue(row.quantity_kg_decimal), 0);
    const movements = scoped
      .filter((row) => inPeriod(row.issue_date, filters.periodStart, filters.periodEnd))
      .filter((row) => !filters.warehouseCnpj || digits(row.warehouse_cnpj) === digits(filters.warehouseCnpj))
      .filter((row) => filters.status === "ALL" || text(row.status) === filters.status)
      .map((row) => {
        const own = entityMap.get(text(row.own_legal_entity_id));
        return {
          id: text(row.id), ownLegalEntityId: text(row.own_legal_entity_id),
          ownLegalEntityName: nullableText(own?.trade_name) ?? nullableText(own?.legal_name) ?? "Empresa",
          documentNumber: text(row.document_number), series: nullableText(row.series), issueDate: text(row.issue_date),
          warehouseName: text(row.warehouse_name), warehouseCnpj: digits(row.warehouse_cnpj) || null,
          productDescription: text(row.product_description), cfop: text(row.cfop), movementType: text(row.movement_type),
          movementKind: text(row.movement_kind), quantityKg: numberValue(row.quantity_kg_decimal), sourceUnit: text(row.source_unit),
          sourceQuantity: numberValue(row.source_quantity_decimal), referencedDocumentNumber: nullableText(row.referenced_document_number),
          referenceText: nullableText(row.reference_text), status: text(row.status), notes: nullableText(row.notes),
          origin: text(row.origin) || "XML", createdAt: text(row.created_at)
        };
      })
      .sort((left, right) => right.issueDate.localeCompare(left.issueDate)
        || right.documentNumber.localeCompare(left.documentNumber, "pt-BR", { numeric: true }));
    return {
      summary: {
        totalKg, totalSacks: totalKg / 60,
        warehouseCount: new Set(balances.map((row) => `${row.ownLegalEntityId}:${row.warehouseCnpj ?? normalized(row.warehouseName)}`)).size,
        activeMovementCount: active.length,
        pendingReviewCount: scoped.filter((row) => text(row.status) === "PENDING_REVIEW").length,
        balances
      },
      warehouses: Array.from(new Map(scoped.filter((row) => digits(row.warehouse_cnpj)).map((row) => [digits(row.warehouse_cnpj), {
        cnpj: digits(row.warehouse_cnpj), name: manualWarehouseNames.get(warehouseIdentity(row)) ?? text(row.warehouse_name)
      }])).values()).sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
      movements
    };
  });

  app.get("/v1/viewer/partners", async (request, reply) => {
    const session = await requireSession(pool, request, reply);
    if (!session) return;
    const filters = scopeSchema.parse(request.query);
    if (!(await assertScope(pool, session, reply, filters.organizationId, filters.legalEntityId))) return;
    const [partners, roles, partnerEntities] = await Promise.all([
      records(pool, "business_partners"), records(pool, "business_partner_roles"), records(pool, "partner_legal_entities")
    ]);
    const rolesByPartner = new Map<string, string[]>();
    for (const role of roles.filter((row) => text(row.organization_id) === filters.organizationId || !row.organization_id)) {
      const partnerId = text(role.business_partner_id);
      const list = rolesByPartner.get(partnerId) ?? [];
      if (text(role.role) && !list.includes(text(role.role))) list.push(text(role.role));
      rolesByPartner.set(partnerId, list);
    }
    const entitiesByPartner = new Map<string, JsonRecord[]>();
    for (const entity of partnerEntities.filter((row) => text(row.organization_id) === filters.organizationId || !row.organization_id)) {
      const partnerId = text(entity.business_partner_id);
      entitiesByPartner.set(partnerId, [...(entitiesByPartner.get(partnerId) ?? []), entity]);
    }
    return partners
      .filter((row) => text(row.organization_id) === filters.organizationId && isActive(row))
      .map((row) => ({
        id: text(row.id), display_name: text(row.display_name), document_number: nullableText(row.document_number),
        email: nullableText(row.email), phone: nullableText(row.phone), city: nullableText(row.city), state: nullableText(row.state),
        is_active: isActive(row), roles: (rolesByPartner.get(text(row.id)) ?? []).map((role) => ({ role })),
        legal_entities: (entitiesByPartner.get(text(row.id)) ?? []).filter(isActive).map((entity) => ({
          id: text(entity.id), legal_name: text(entity.legal_name), trade_name: nullableText(entity.trade_name),
          cnpj: nullableText(entity.cnpj), city: nullableText(entity.city), state: nullableText(entity.state)
        }))
      }))
      .sort((left, right) => left.display_name.localeCompare(right.display_name, "pt-BR"));
  });

  app.get("/v1/viewer/products", async (request, reply) => {
    const session = await requireSession(pool, request, reply);
    if (!session) return;
    const filters = scopeSchema.parse(request.query);
    if (!(await assertScope(pool, session, reply, filters.organizationId, filters.legalEntityId))) return;
    const [products, aliases] = await Promise.all([records(pool, "products"), records(pool, "product_aliases")]);
    const aliasesByProduct = new Map<string, string[]>();
    for (const alias of aliases.filter((row) => text(row.organization_id) === filters.organizationId || !row.organization_id)) {
      const productId = text(alias.product_id);
      aliasesByProduct.set(productId, [...(aliasesByProduct.get(productId) ?? []), text(alias.alias)]);
    }
    return products
      .filter((row) => text(row.organization_id) === filters.organizationId && isActive(row))
      .map((row) => ({
        id: text(row.id), name: text(row.name), code: nullableText(row.code), category: text(row.category),
        default_unit: text(row.default_unit), default_sack_weight_kg: row.default_sack_weight_kg == null ? null : numberValue(row.default_sack_weight_kg),
        is_active: isActive(row), aliases: aliasesByProduct.get(text(row.id)) ?? []
      }))
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  });

  app.get("/v1/viewer/rate-rules", async (request, reply) => {
    const session = await requireSession(pool, request, reply);
    if (!session) return;
    const filters = rateRuleListSchema.parse(request.query);
    if (!(await assertScope(pool, session, reply, filters.organizationId, filters.legalEntityId))) return;
    const table = filters.kind === "SERVICE" ? "service_rate_rules" : "purchase_rate_rules";
    const [rules, partners, products, partnerEntities, ownEntities] = await Promise.all([
      records(pool, table), records(pool, "business_partners"), records(pool, "products"),
      records(pool, "partner_legal_entities"), records(pool, "legal_entities")
    ]);
    const partnerMap = new Map(partners.map((row) => [text(row.id), row]));
    const productMap = new Map(products.map((row) => [text(row.id), row]));
    const partnerEntityMap = new Map(partnerEntities.map((row) => [text(row.id), row]));
    const ownEntityMap = new Map(ownEntities.map((row) => [text(row.id), row]));
    return rules
      .filter((row) => text(row.organization_id) === filters.organizationId && isActive(row))
      .filter((row) => !filters.legalEntityId || !row.own_legal_entity_id || text(row.own_legal_entity_id) === filters.legalEntityId)
      .map((row) => ({
        id: text(row.id), rate_value_cents: numberValue(row.rate_value_cents),
        financial_rate_value_cents: row.financial_rate_value_cents == null ? null : numberValue(row.financial_rate_value_cents),
        effective_from: text(row.effective_from), effective_to: nullableText(row.effective_to), priority: numberValue(row.priority),
        is_active: isActive(row), operation_scope: nullableText(row.operation_scope), state: nullableText(row.state),
        business_partner: partnerMap.has(text(row.business_partner_id)) ? { display_name: text(partnerMap.get(text(row.business_partner_id))?.display_name) } : null,
        product: productMap.has(text(row.product_id)) ? { name: text(productMap.get(text(row.product_id))?.name) } : null,
        partner_legal_entity: partnerEntityMap.has(text(row.partner_legal_entity_id)) ? { legal_name: text(partnerEntityMap.get(text(row.partner_legal_entity_id))?.legal_name) } : null,
        own_legal_entity: ownEntityMap.has(text(row.own_legal_entity_id)) ? { trade_name: text(ownEntityMap.get(text(row.own_legal_entity_id))?.trade_name) } : null
      }))
      .sort((left, right) => right.effective_from.localeCompare(left.effective_from) || right.priority - left.priority);
  });

  app.get("/v1/viewer/payables", async (request, reply) => {
    const session = await requireSession(pool, request, reply);
    if (!session) return;
    const filters = scopeSchema.parse(request.query);
    if (!(await assertScope(pool, session, reply, filters.organizationId, filters.legalEntityId))) return;
    const [payables, partners, entities] = await Promise.all([
      records(pool, "accounts_payable"), records(pool, "business_partners"), records(pool, "legal_entities")
    ]);
    const partnerMap = new Map(partners.map((row) => [text(row.id), row]));
    const entityMap = new Map(entities.map((row) => [text(row.id), row]));
    const today = new Date().toISOString().slice(0, 10);
    return payables
      .filter((row) => inOrganizationScope(row, filters.organizationId, filters.legalEntityId))
      .map((row) => {
        const openAmount = numberValue(row.open_amount_cents);
        const storedStatus = text(row.status);
        const status = ["SCHEDULED", "OPEN", "PARTIALLY_PAID"].includes(storedStatus) && openAmount > 0 && text(row.due_date) < today ? "OVERDUE" : storedStatus;
        return {
          id: text(row.id), payee_name_snapshot: text(row.payee_name_snapshot), description: text(row.description),
          document_number: nullableText(row.document_number), due_date: text(row.due_date), final_amount_cents: numberValue(row.final_amount_cents),
          paid_amount_cents: numberValue(row.paid_amount_cents), open_amount_cents: openAmount, status,
          supplier: partnerMap.has(text(row.supplier_partner_id)) ? { display_name: text(partnerMap.get(text(row.supplier_partner_id))?.display_name) } : null,
          own_legal_entity: entityMap.has(text(row.own_legal_entity_id)) ? { trade_name: text(entityMap.get(text(row.own_legal_entity_id))?.trade_name) } : null
        };
      })
      .sort((left, right) => right.due_date.localeCompare(left.due_date));
  });

  app.get("/v1/viewer/finance", async (request, reply) => {
    const session = await requireSession(pool, request, reply);
    if (!session) return;
    const filters = scopeSchema.parse(request.query);
    if (!(await assertScope(pool, session, reply, filters.organizationId, filters.legalEntityId))) return;
    const [charges, payables, entities] = await Promise.all([
      records(pool, "client_charges"), records(pool, "accounts_payable"), records(pool, "legal_entities")
    ]);
    const entityMap = new Map(entities.map((row) => [text(row.id), row]));
    const rows = new Map<string, { name: string; receivableCents: number; payableCents: number }>();
    const entityRow = (id: string) => {
      const current = rows.get(id);
      if (current) return current;
      const entity = entityMap.get(id);
      const created = { name: nullableText(entity?.trade_name) ?? nullableText(entity?.legal_name) ?? "Empresa", receivableCents: 0, payableCents: 0 };
      rows.set(id, created);
      return created;
    };
    for (const charge of charges.filter((row) => inOrganizationScope(row, filters.organizationId, filters.legalEntityId) && openCharge(row))) {
      entityRow(text(charge.own_legal_entity_id)).receivableCents += numberValue(charge.open_amount_cents);
    }
    for (const payable of payables.filter((row) => inOrganizationScope(row, filters.organizationId, filters.legalEntityId) && !["PAID", "CANCELLED"].includes(text(row.status)))) {
      entityRow(text(payable.own_legal_entity_id)).payableCents += numberValue(payable.open_amount_cents);
    }
    const byEntity = [...rows.values()].sort((left, right) => right.receivableCents + right.payableCents - left.receivableCents - left.payableCents);
    return {
      totalReceivableCents: byEntity.reduce((sum, row) => sum + row.receivableCents, 0),
      totalPayableCents: byEntity.reduce((sum, row) => sum + row.payableCents, 0),
      byEntity
    };
  });

  app.get("/v1/viewer/reports", async (request, reply) => {
    const session = await requireSession(pool, request, reply);
    if (!session) return;
    const filters = reportListSchema.parse(request.query);
    if (!(await assertScope(pool, session, reply, filters.organizationId, filters.legalEntityId))) return;
    const [operations, confirmations] = await Promise.all([records(pool, "operations"), records(pool, "deal_confirmations")]);
    const rows = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, operationCount: 0, sacks: 0, amountCents: 0, confirmationCount: 0 }));
    const prefix = `${filters.year}-`;
    for (const operation of operations.filter((row) => inOrganizationScope(row, filters.organizationId, filters.legalEntityId) && text(row.status) !== "CANCELED" && text(row.operation_date).startsWith(prefix))) {
      const month = Number(text(operation.operation_date).slice(5, 7));
      if (month < 1 || month > 12) continue;
      rows[month - 1].operationCount += 1;
      rows[month - 1].sacks += numberValue(operation.quantity_sacks_decimal);
      rows[month - 1].amountCents += numberValue(operation.service_amount_cents);
    }
    for (const confirmation of confirmations.filter((row) => inOrganizationScope(row, filters.organizationId, filters.legalEntityId) && !["CANCELLED", "REPLACED"].includes(text(row.status)) && text(row.confirmation_date).startsWith(prefix))) {
      const month = Number(text(confirmation.confirmation_date).slice(5, 7));
      if (month >= 1 && month <= 12) rows[month - 1].confirmationCount += 1;
    }
    return rows;
  });

  app.get("/v1/viewer/transfer-reconciliations", async (request, reply) => {
    const session = await requireSession(pool, request, reply);
    if (!session) return;
    const filters = scopeSchema.parse(request.query);
    if (!(await assertScope(pool, session, reply, filters.organizationId, filters.legalEntityId))) return;
    const [reconciliations, partners, invoices, payments] = await Promise.all([
      records(pool, "transfer_reconciliations"), records(pool, "business_partners"),
      records(pool, "transfer_reconciliation_invoices"), records(pool, "transfer_reconciliation_payments")
    ]);
    const partnerMap = new Map(partners.map((row) => [text(row.id), row]));
    const invoiceCount = new Map<string, number>();
    const paymentCount = new Map<string, number>();
    for (const row of invoices) invoiceCount.set(text(row.reconciliation_id), (invoiceCount.get(text(row.reconciliation_id)) ?? 0) + 1);
    for (const row of payments) paymentCount.set(text(row.reconciliation_id), (paymentCount.get(text(row.reconciliation_id)) ?? 0) + 1);
    return reconciliations
      .filter((row) => text(row.organization_id) === filters.organizationId)
      .map((row) => ({
        id: text(row.id), clientName: text(partnerMap.get(text(row.client_partner_id))?.display_name) || "Parceiro",
        counterpartyRole: text(row.counterparty_role) || "CLIENT", sourceMode: text(row.source_mode) || "INVOICES",
        referenceDate: text(row.reference_date), title: nullableText(row.title), notes: nullableText(row.notes),
        status: text(row.status), totalSourceCents: numberValue(row.total_source_cents),
        totalPaymentsCents: numberValue(row.total_payments_cents), balanceCents: numberValue(row.balance_cents),
        invoiceCount: invoiceCount.get(text(row.id)) ?? 0, paymentCount: paymentCount.get(text(row.id)) ?? 0
      }))
      .sort((left, right) => right.referenceDate.localeCompare(left.referenceDate));
  });

  app.get("/v1/viewer/clients", async (request, reply) => {
    const session = await requireSession(pool, request, reply);
    if (!session) return;
    const filters = filterSchema.parse(request.query);
    if (!(await assertScope(pool, session, reply, filters.organizationId, filters.legalEntityId))) return;
    const [partners, operations, charges, payments, ledgerEntries, entities] = await Promise.all([
      records(pool, "business_partners"), records(pool, "operations"), records(pool, "client_charges"), records(pool, "client_payments"), records(pool, "client_ledger_entries"), records(pool, "legal_entities")
    ]);
    const partnerMap = new Map(partners.map((row) => [text(row.id), text(row.display_name)]));
    const entityMap = new Map(entities.map((row) => [text(row.id), row]));
    const ids = new Set<string>();
    const scopedOperations = operations.filter((row) => text(row.organization_id) === filters.organizationId
      && (!filters.legalEntityId || text(row.own_legal_entity_id) === filters.legalEntityId || isThirdPartyEntity(entityMap.get(text(row.own_legal_entity_id))))
      && text(row.status) !== "CANCELED" && text(row.operation_type) !== "PURCHASE" && inPeriod(row.operation_date, filters.periodStart, filters.periodEnd));
    const scopedCharges = charges.filter((row) => inScope(row, filters) && text(row.status) !== "CANCELLED" && inPeriod(row.period_start, filters.periodStart, filters.periodEnd));
    const scopedPayments = payments.filter((row) => inScope(row, filters) && text(row.status) === "CONFIRMED" && inPeriod(row.payment_date, filters.periodStart, filters.periodEnd));
    const scopedLedgerEntries = ledgerEntries.filter((row) => inScope(row, filters) && inPeriod(row.entry_date, filters.periodStart, filters.periodEnd));
    [...scopedOperations, ...scopedCharges, ...scopedPayments, ...scopedLedgerEntries].forEach((row) => ids.add(text(row.responsible_partner_id || row.client_partner_id)));
    return Array.from(ids).filter(Boolean).map((id) => ({
      id, displayName: partnerMap.get(id) ?? "Cliente",
      sacks: scopedOperations.filter((row) => text(row.responsible_partner_id) === id).reduce((sum, row) => sum + numberValue(row.quantity_sacks_decimal), 0),
      receivableCents: scopedCharges.filter((row) => text(row.client_partner_id) === id).reduce((sum, row) => sum + numberValue(row.open_amount_cents), 0)
        + scopedOperations.filter((row) => text(row.responsible_partner_id) === id && text(row.billing_status) === "UNBILLED").reduce((sum, row) => sum + numberValue(row.service_amount_cents), 0),
      receivedCents: scopedPayments.filter((row) => text(row.client_partner_id) === id).reduce((sum, row) => sum + numberValue(row.amount_cents), 0)
    })).sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR"));
  });

  app.get("/v1/viewer/ledger", async (request, reply) => {
    const session = await requireSession(pool, request, reply);
    if (!session) return;
    const filters = ledgerListSchema.parse(request.query);
    if (!(await assertScope(pool, session, reply, filters.organizationId, filters.legalEntityId))) return;
    const [allEntries, allOperations, allCharges, allPartners] = await Promise.all([
      records(pool, "client_ledger_entries"), records(pool, "operations"), records(pool, "client_charges"), records(pool, "business_partners")
    ]);
    const client = allPartners.find((row) => text(row.id) === filters.clientId);
    if (!client) return reply.code(404).send({ error: "NOT_FOUND", message: "Cliente nao encontrado." });

    const chargeById = new Map(allCharges.map((row) => [text(row.id), row]));
    const entries = allEntries
      .filter((row) => inScope(row, filters) && text(row.client_partner_id) === filters.clientId && inPeriod(row.entry_date, filters.periodStart, filters.periodEnd))
      .map((row) => {
        const charge = chargeById.get(text(row.client_charge_id));
        const description = text(row.entry_type) === "SERVICE_CHARGE" && charge
          ? `Cobranca ${text(charge.period_start)} a ${text(charge.period_end)}`
          : text(row.description);
        return {
          id: text(row.id), entryType: text(row.entry_type), effect: text(row.effect), amountCents: numberValue(row.amount_cents),
          entryDate: text(row.entry_date), description, referenceNumber: nullableText(row.reference_number), notes: nullableText(row.notes),
          status: text(row.status), availableAmountCents: row.available_amount_cents == null ? null : numberValue(row.available_amount_cents),
          collectionDueDate: nullableText(row.collection_due_date), collectedAt: nullableText(row.collected_at),
          cancellationReason: nullableText(row.cancellation_reason), createdAt: text(row.created_at)
        };
      })
      .sort((left, right) => right.entryDate.localeCompare(left.entryDate) || right.createdAt.localeCompare(left.createdAt));

    const confirmed = entries.filter((entry) => entry.status === "CONFIRMED");
    const sumType = (type: string): number => confirmed.filter((entry) => entry.entryType === type).reduce((sum, entry) => sum + entry.amountCents, 0);
    const liveUnbilledServiceCents = allOperations
      .filter((row) => inScope(row, filters) && text(row.responsible_partner_id) === filters.clientId)
      .filter((row) => text(row.status) === "CONFIRMED" && text(row.operation_type) !== "PURCHASE" && text(row.billing_status) !== "BILLED")
      .filter((row) => inPeriod(row.operation_date, filters.periodStart, filters.periodEnd))
      .reduce((sum, row) => sum + numberValue(row.service_amount_cents), 0);
    const totalServiceCents = sumType("SERVICE_CHARGE") + liveUnbilledServiceCents;
    const surchargeCents = sumType("SURCHARGE") + sumType("LOAN") + sumType("MANUAL_ADJUSTMENT");
    const advanceCents = sumType("ADVANCE_RECEIVED");
    const creditCents = sumType("CREDIT");
    const paymentCents = sumType("PAYMENT_RECEIVED");
    const balanceCents = confirmed.reduce((sum, entry) => sum + (entry.effect === "INCREASE_RECEIVABLE" ? entry.amountCents : -entry.amountCents), 0) + liveUnbilledServiceCents;

    return {
      client: { id: text(client.id), displayName: text(client.display_name) || "Cliente" },
      periodStart: filters.periodStart,
      periodEnd: filters.periodEnd,
      summary: { totalServiceCents, liveUnbilledServiceCents, surchargeCents, advanceCents, creditCents, paymentCents, balanceCents },
      entries
    };
  });

  app.get("/v1/viewer/confirmations", async (request, reply) => {
    const session = await requireSession(pool, request, reply);
    if (!session) return;
    const filters = confirmationListSchema.parse(request.query);
    if (!(await assertScope(pool, session, reply, filters.organizationId, filters.legalEntityId))) return;
    const [confirmations, parties, entities, partners, partnerEntities] = await Promise.all([
      records(pool, "deal_confirmations"), records(pool, "deal_confirmation_parties"), records(pool, "legal_entities"),
      records(pool, "business_partners"), records(pool, "partner_legal_entities")
    ]);
    const entityMap = new Map(entities.map((row) => [text(row.id), row]));
    const partnerMap = new Map(partners.map((row) => [text(row.id), row]));
    const partnerEntityMap = new Map(partnerEntities.map((row) => [text(row.id), row]));
    const openStatuses = new Set(["DRAFT", "PENDING_REVIEW", "ISSUED", "SENT_FOR_SIGNATURE"]);
    return confirmations
      .filter((row) => inScope(row, filters) && inPeriod(row.confirmation_date, filters.periodStart, filters.periodEnd))
      .filter((row) => filters.status === "ALL"
        || (filters.status === "SIGNED" ? text(row.status) === "SIGNED" : openStatuses.has(text(row.status))))
      .map((row) => {
        const ownLegalEntityId = text(row.own_legal_entity_id);
        const ownEntity = entityMap.get(ownLegalEntityId);
        const counterparty = confirmationCounterparty(text(row.id), ownLegalEntityId, parties, partnerMap, partnerEntityMap);
        return {
          id: text(row.id),
          confirmationNumber: nullableText(row.confirmation_number),
          temporaryReference: text(row.temporary_reference),
          confirmationDate: text(row.confirmation_date),
          status: text(row.status),
          signatureStatus: text(row.signature_status),
          ownLegalEntityName: nullableText(ownEntity?.trade_name) ?? nullableText(ownEntity?.legal_name) ?? "Empresa",
          counterpartyName: counterparty.name,
          counterpartyRole: counterparty.role,
          totalQuantitySacks: text(row.total_quantity_sacks_decimal),
          totalCommercialAmountCents: numberValue(row.total_commercial_amount_cents)
        };
      })
      .sort((left, right) => right.confirmationDate.localeCompare(left.confirmationDate)
        || (right.confirmationNumber ?? right.temporaryReference).localeCompare(
          left.confirmationNumber ?? left.temporaryReference,
          "pt-BR",
          { numeric: true }
        ));
  });

  app.get("/v1/viewer/open-notes", async (request, reply) => {
    const session = await requireSession(pool, request, reply);
    if (!session) return;
    const filters = openNoteListSchema.parse(request.query);
    if (!(await assertScope(pool, session, reply, filters.organizationId, filters.legalEntityId))) return;
    const [operations, documents, entities, partners, partnerEntities] = await Promise.all([
      records(pool, "operations"), records(pool, "fiscal_documents"), records(pool, "legal_entities"),
      records(pool, "business_partners"), records(pool, "partner_legal_entities")
    ]);
    const documentMap = new Map(documents.map((row) => [text(row.id), row]));
    const entityMap = new Map(entities.map((row) => [text(row.id), row]));
    const partnerMap = new Map(partners.map((row) => [text(row.id), row]));
    const partnerEntityMap = new Map(partnerEntities.map((row) => [text(row.id), row]));
    return operations
      .filter((row) => text(row.organization_id) === filters.organizationId)
      .filter((row) => {
        if (!filters.legalEntityId) return true;
        const own = entityMap.get(text(row.own_legal_entity_id));
        return text(row.own_legal_entity_id) === filters.legalEntityId || isThirdPartyEntity(own);
      })
      .filter((row) => text(row.operation_type) === "SALE" && ["DRAFT", "CONFIRMED"].includes(text(row.status)))
      .filter((row) => text(row.billing_status) === "UNBILLED" && inPeriod(row.operation_date, filters.periodStart, filters.periodEnd))
      .filter((row) => !filters.clientId || text(row.responsible_partner_id) === filters.clientId)
      .flatMap((row) => {
        const document = documentMap.get(text(row.fiscal_document_id));
        const own = entityMap.get(text(row.own_legal_entity_id));
        if (!document || !own || text(document.status) === "CANCELED") return [];
        const triangulated = Boolean(document.secondary_responsible_partner_id);
        const thirdParty = triangulated || isThirdPartyEntity(own);
        const labels = operationPartyLabels(row, document, own, partnerMap, partnerEntityMap);
        const ownName = nullableText(own.trade_name) ?? nullableText(own.legal_name) ?? "Empresa";
        const tone = thirdParty ? "other" : normalized(ownName).startsWith("villa coffee") ? "villa" : normalized(ownName).startsWith("grao & grao") || normalized(ownName).startsWith("grao e grao") ? "grao" : "other";
        return [{
          id: text(row.id), fiscalDocumentId: text(row.fiscal_document_id), documentNumber: text(document.document_number), series: nullableText(document.series),
          operationDate: text(row.operation_date), clientId: text(row.responsible_partner_id), clientName: nullableText(partnerMap.get(text(row.responsible_partner_id))?.display_name) ?? "Cliente",
          ownLegalEntityName: ownName, issuerName: labels.issuer, destinationName: labels.destination,
          companyContext: thirdParty ? "Operacao terceirizada" : ownName, companyTone: tone,
          operationScope: text(row.operation_scope), quantitySacks: text(row.quantity_sacks_decimal), rateCents: numberValue(row.applied_rate_value_cents),
          serviceAmountCents: numberValue(row.service_amount_cents), billingStatus: text(row.billing_status), hasPendingIssues: booleanValue(document.has_pending_issues)
        }];
      })
      .sort((left, right) => left.operationDate.localeCompare(right.operationDate) || left.documentNumber.localeCompare(right.documentNumber, "pt-BR", { numeric: true }));
  });

  app.get("/v1/viewer/charges", async (request, reply) => {
    const session = await requireSession(pool, request, reply);
    if (!session) return;
    const filters = chargeListSchema.parse(request.query);
    if (!(await assertScope(pool, session, reply, filters.organizationId, filters.legalEntityId))) return;
    const [charges, partners, entities] = await Promise.all([records(pool, "client_charges"), records(pool, "business_partners"), records(pool, "legal_entities")]);
    const partnerMap = new Map(partners.map((row) => [text(row.id), text(row.display_name)]));
    const entityMap = new Map(entities.map((row) => [text(row.id), text(row.trade_name)]));
    const today = new Date().toISOString().slice(0, 10);
    return charges.filter((row) => inScope(row, filters) && text(row.status) !== "CANCELLED" && inPeriod(row.period_start, filters.periodStart, filters.periodEnd))
      .filter((row) => !filters.clientId || text(row.client_partner_id) === filters.clientId)
      .filter((row) => filters.status === "ALL" || (filters.status === "PAID" ? text(row.status) === "PAID" : openCharge(row)))
      .map((row) => {
        const dueDate = nullableText(row.due_date);
        const openAmountCents = numberValue(row.open_amount_cents);
        const storedStatus = text(row.status);
        const status = ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(storedStatus)
          && openAmountCents > 0
          && Boolean(dueDate && dueDate < today)
          ? "OVERDUE"
          : storedStatus;
        return {
          id: text(row.id), chargeNumber: nullableText(row.charge_number), referenceCode: nullableText(row.reference_code),
          clientId: text(row.client_partner_id), clientName: partnerMap.get(text(row.client_partner_id)) ?? "Cliente",
          legalEntityName: entityMap.get(text(row.own_legal_entity_id)) ?? "", periodStart: text(row.period_start), periodEnd: text(row.period_end),
          issueDate: nullableText(row.issue_date), dueDate, status, finalAmountCents: numberValue(row.final_amount_cents),
          paidAmountCents: numberValue(row.paid_amount_cents), openAmountCents
        };
      })
      .sort((a, b) => b.periodStart.localeCompare(a.periodStart) || a.clientName.localeCompare(b.clientName, "pt-BR"));
  });

  app.get("/v1/viewer/charges/:chargeId/pdf", async (request, reply) => {
    const session = await requireSession(pool, request, reply);
    if (!session) return;
    const { chargeId } = z.object({ chargeId: z.string().min(1) }).parse(request.params);
    const chargeRow = await record(pool, "client_charges", chargeId);
    if (!chargeRow) return reply.code(404).send({ error: "NOT_FOUND", message: "Cobranca nao encontrada." });
    const organizationId = text(chargeRow.organization_id);
    const legalEntityId = text(chargeRow.own_legal_entity_id);
    if (!(await assertScope(pool, session, reply, organizationId, legalEntityId))) return;
    const [organizationRow, entityRow, clientRow, operationRows, adjustmentRows, allocationRows, ledgerRows, sourceOperationRows, documentRows, entityRows, partnerRows, partnerEntityRows] = await Promise.all([
      record(pool, "organizations", organizationId), record(pool, "legal_entities", legalEntityId), record(pool, "business_partners", text(chargeRow.client_partner_id)),
      records(pool, "client_charge_operations"), records(pool, "client_charge_adjustments"), records(pool, "client_payment_allocations"), records(pool, "client_ledger_entries"),
      records(pool, "operations"), records(pool, "fiscal_documents"), records(pool, "legal_entities"), records(pool, "business_partners"), records(pool, "partner_legal_entities")
    ]);
    if (!organizationRow || !entityRow || !clientRow) return reply.code(409).send({ error: "INCOMPLETE_DATA", message: "Dados da cobranca incompletos no servidor." });
    const ledgerMap = new Map(ledgerRows.map((row) => [text(row.id), row]));
    const sourceOperationMap = new Map(sourceOperationRows.map((row) => [text(row.id), row]));
    const documentMap = new Map(documentRows.map((row) => [text(row.id), row]));
    const entityMap = new Map(entityRows.map((row) => [text(row.id), row]));
    const partnerMap = new Map(partnerRows.map((row) => [text(row.id), row]));
    const partnerEntityMap = new Map(partnerEntityRows.map((row) => [text(row.id), row]));
    const operations = operationRows.filter((row) => text(row.client_charge_id) === chargeId && !row.released_at).map((row) => {
      const refreshed = refreshedOperationSnapshots(row, sourceOperationMap, documentMap, entityMap, partnerMap, partnerEntityMap);
      return {
        id: text(row.id), clientChargeId: chargeId, operationId: text(row.operation_id), ownLegalEntityIdSnapshot: nullableText(row.own_legal_entity_id_snapshot), ownLegalEntityNameSnapshot: nullableText(row.own_legal_entity_name_snapshot),
        operationDateSnapshot: text(row.operation_date_snapshot), fiscalDocumentNumberSnapshot: nullableText(row.fiscal_document_number_snapshot), fiscalDocumentSeriesSnapshot: nullableText(row.fiscal_document_series_snapshot),
        issuerNameSnapshot: refreshed.issuer, destinationNameSnapshot: refreshed.destination, productNameSnapshot: nullableText(row.product_name_snapshot), operationScopeSnapshot: text(row.operation_scope_snapshot),
        quantitySacksDecimalSnapshot: text(row.quantity_sacks_decimal_snapshot), serviceRateCentsSnapshot: numberValue(row.service_rate_cents_snapshot), serviceAmountCentsSnapshot: numberValue(row.service_amount_cents_snapshot),
        releasedAt: null, createdAt: text(row.created_at), contractNumberSnapshot: nullableText(row.contract_number_snapshot), billingObservationsSnapshot: nullableText(row.billing_observations_snapshot)
      };
    });
    const adjustments = adjustmentRows.filter((row) => text(row.client_charge_id) === chargeId).map((row) => ({
      id: text(row.id), clientChargeId: chargeId, ledgerEntryId: nullableText(row.ledger_entry_id), ledgerEntryDate: nullableText(ledgerMap.get(text(row.ledger_entry_id))?.entry_date),
      adjustmentType: text(row.adjustment_type), effect: text(row.effect), description: text(row.description), reason: nullableText(row.reason), amountCents: numberValue(row.amount_cents), sortOrder: numberValue(row.sort_order), createdAt: text(row.created_at), updatedAt: text(row.updated_at)
    }));
    const payments = allocationRows.filter((row) => text(row.client_charge_id) === chargeId && !row.cancelled_at).map((row) => ({
      id: text(row.id), clientPaymentId: text(row.client_payment_id), clientChargeId: chargeId, amountCents: numberValue(row.amount_cents), allocatedAt: text(row.allocated_at), cancelledAt: null, cancellationReason: null
    }));
    const input = {
      directories: {} as ChargeDocumentsInput["directories"], organization: mapOrganization(organizationRow), ownLegalEntity: mapLegalEntity(entityRow), client: mapClient(clientRow),
      detail: { charge: mapCharge(chargeRow), operations, adjustments, creditAllocations: [], payments, documents: [] }
    } as ChargeDocumentsInput;
    const pdf = await buildChargePdf(input);
    const fileName = sanitizeFileName(`${text(clientRow.display_name)}-${text(chargeRow.period_start)}-a-${text(chargeRow.period_end)}.pdf`);
    return reply.header("Content-Type", "application/pdf").header("Content-Disposition", `attachment; filename="${fileName}"`).send(Buffer.from(pdf));
  });
}
