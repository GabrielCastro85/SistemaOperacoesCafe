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

const chargeListSchema = filterSchema.extend({
  clientId: z.string().min(1).optional(),
  status: z.enum(["OPEN", "PAID", "ALL"]).default("ALL")
});

const openNoteListSchema = filterSchema.extend({
  clientId: z.string().min(1).optional()
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

function digits(value: unknown): string {
  return text(value).replace(/\D/g, "");
}

function normalized(value: unknown): string {
  return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
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
    const [allOperations, allCharges] = await Promise.all([
      records(pool, "operations"), records(pool, "client_charges")
    ]);
    const operations = allOperations.filter((row) => inScope(row, filters) && text(row.status) !== "CANCELED" && inPeriod(row.operation_date, filters.periodStart, filters.periodEnd));
    const sales = operations.filter((row) => text(row.operation_type) !== "PURCHASE");
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
    return {
      periodStart: filters.periodStart,
      periodEnd: filters.periodEnd,
      sacks: operations.reduce((sum, row) => sum + numberValue(row.quantity_sacks_decimal), 0),
      operationCount: operations.length,
      receivableCents: globalCharges.reduce((sum, row) => sum + numberValue(row.open_amount_cents), 0) + globalUnbilled.reduce((sum, row) => sum + numberValue(row.service_amount_cents), 0),
      receivedCents: globalReceivedForOperationsPeriodCents,
      generatedServiceCents: sales.reduce((sum, row) => sum + numberValue(row.service_amount_cents), 0),
      unbilledCount: globalUnbilled.length,
      overdueCents: charges.filter((row) => text(row.status) === "OVERDUE").reduce((sum, row) => sum + numberValue(row.open_amount_cents), 0)
    };
  });

  app.get("/v1/viewer/clients", async (request, reply) => {
    const session = await requireSession(pool, request, reply);
    if (!session) return;
    const filters = filterSchema.parse(request.query);
    if (!(await assertScope(pool, session, reply, filters.organizationId, filters.legalEntityId))) return;
    const [partners, operations, charges, payments, entities] = await Promise.all([
      records(pool, "business_partners"), records(pool, "operations"), records(pool, "client_charges"), records(pool, "client_payments"), records(pool, "legal_entities")
    ]);
    const partnerMap = new Map(partners.map((row) => [text(row.id), text(row.display_name)]));
    const entityMap = new Map(entities.map((row) => [text(row.id), row]));
    const ids = new Set<string>();
    const scopedOperations = operations.filter((row) => text(row.organization_id) === filters.organizationId
      && (!filters.legalEntityId || text(row.own_legal_entity_id) === filters.legalEntityId || isThirdPartyEntity(entityMap.get(text(row.own_legal_entity_id))))
      && text(row.status) !== "CANCELED" && text(row.operation_type) !== "PURCHASE" && inPeriod(row.operation_date, filters.periodStart, filters.periodEnd));
    const scopedCharges = charges.filter((row) => inScope(row, filters) && text(row.status) !== "CANCELLED" && inPeriod(row.period_start, filters.periodStart, filters.periodEnd));
    const scopedPayments = payments.filter((row) => inScope(row, filters) && text(row.status) === "CONFIRMED" && inPeriod(row.payment_date, filters.periodStart, filters.periodEnd));
    [...scopedOperations, ...scopedCharges, ...scopedPayments].forEach((row) => ids.add(text(row.responsible_partner_id || row.client_partner_id)));
    return Array.from(ids).filter(Boolean).map((id) => ({
      id, displayName: partnerMap.get(id) ?? "Cliente",
      sacks: scopedOperations.filter((row) => text(row.responsible_partner_id) === id).reduce((sum, row) => sum + numberValue(row.quantity_sacks_decimal), 0),
      receivableCents: scopedCharges.filter((row) => text(row.client_partner_id) === id).reduce((sum, row) => sum + numberValue(row.open_amount_cents), 0)
        + scopedOperations.filter((row) => text(row.responsible_partner_id) === id && text(row.billing_status) === "UNBILLED").reduce((sum, row) => sum + numberValue(row.service_amount_cents), 0),
      receivedCents: scopedPayments.filter((row) => text(row.client_partner_id) === id).reduce((sum, row) => sum + numberValue(row.amount_cents), 0)
    })).sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR"));
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
    return charges.filter((row) => inScope(row, filters) && text(row.status) !== "CANCELLED" && inPeriod(row.period_start, filters.periodStart, filters.periodEnd))
      .filter((row) => !filters.clientId || text(row.client_partner_id) === filters.clientId)
      .filter((row) => filters.status === "ALL" || (filters.status === "PAID" ? text(row.status) === "PAID" : openCharge(row)))
      .map((row) => ({ id: text(row.id), clientId: text(row.client_partner_id), clientName: partnerMap.get(text(row.client_partner_id)) ?? "Cliente", legalEntityName: entityMap.get(text(row.own_legal_entity_id)) ?? "", periodStart: text(row.period_start), periodEnd: text(row.period_end), dueDate: nullableText(row.due_date), status: text(row.status), finalAmountCents: numberValue(row.final_amount_cents), paidAmountCents: numberValue(row.paid_amount_cents), openAmountCents: numberValue(row.open_amount_cents) }))
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
