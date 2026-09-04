import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { AppRepository } from "../electron/main/services/appRepository";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";
import type { SharedRepository } from "../electron/main/services/sharedRepository";

const tempDirs: string[] = [];
const villaId = "11111111-1111-4111-8111-111111111111";
const ownLegalEntityId = "33333333-3333-4333-8333-333333333331";
const villaEsLegalEntityId = "33333333-3333-4333-8333-333333333332";

// Simulacao minima do Supabase pra cobrir a numeracao atomica (ver
// ensureDealConfirmationNumberOnServer em appRepository.ts) -- emitir uma
// confirmacao agora exige conexao remota de verdade. Mesma logica usada em
// tests/deal-confirmations.test.ts.
class FakeSharedRepository {
  private tables = new Map<string, Map<string, Record<string, unknown>>>();
  private sequences = new Map<string, number>();
  private reservations = new Map<string, { number: string; sequence: number }>();

  checkConnectivity = async () => ({ online: true, authenticated: true, error: null });
  getSession = async () => ({ user: { email: "teste@operacoescafe.com" } }) as never;

  async findOne(table: string, match: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const rows = [...(this.tables.get(table)?.values() ?? [])];
    return rows.find((row) => Object.entries(match).every(([key, value]) => String(row[key] ?? "") === String(value ?? ""))) ?? null;
  }

  async listAll(table: string): Promise<Array<Record<string, unknown>>> {
    return [...(this.tables.get(table)?.values() ?? [])];
  }

  async upsertRow(table: string, row: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!this.tables.has(table)) this.tables.set(table, new Map());
    const stored = { ...row };
    this.tables.get(table)!.set(String(row.id), stored);
    return stored;
  }

  async upsertRows(table: string, rows: Array<Record<string, unknown>>): Promise<void> {
    for (const row of rows) await this.upsertRow(table, row);
  }

  async updateRow(table: string, id: string, patch: Record<string, unknown>): Promise<Record<string, unknown>> {
    const existing = this.tables.get(table)?.get(id) ?? { id };
    const updated = { ...existing, ...patch, id };
    if (!this.tables.has(table)) this.tables.set(table, new Map());
    this.tables.get(table)!.set(id, updated);
    return updated;
  }

  async deleteWhere(table: string, match: Record<string, unknown>): Promise<void> {
    const rows = this.tables.get(table);
    if (!rows) return;
    const [key, value] = Object.entries(match)[0];
    for (const [id, row] of [...rows.entries()]) if (row[key] === value) rows.delete(id);
  }

  async pullChangesSince(table: string, timestampColumn: string, since: string): Promise<Array<Record<string, unknown>>> {
    const rows = [...(this.tables.get(table)?.values() ?? [])];
    return rows.filter((row) => String(row[timestampColumn]) > since);
  }

  async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    if (name !== "ensure_deal_confirmation_number") throw new Error(`RPC nao simulada no teste: ${name}`);
    const confirmationId = String(args.p_confirmation_id);
    const organizationId = String(args.p_organization_id);
    const entityId = String(args.p_own_legal_entity_id);
    const year = Number(args.p_year);
    const prefix = String(args.p_prefix);
    const padding = Number(args.p_padding ?? 4);
    const confirmations = this.tables.get("deal_confirmations") ?? new Map();
    const current = confirmations.get(confirmationId);
    if (!current) throw new Error(`Confirmation ${confirmationId} is missing, belongs to another company, or is no longer editable`);

    const conflictsWith = (number: string): boolean =>
      [...confirmations.values()].some((row) => String(row.id) !== confirmationId && String(row.confirmation_number ?? "") === number);

    if (typeof current.confirmation_number === "string" && current.confirmation_number && conflictsWith(current.confirmation_number)) {
      current.confirmation_number = null;
    }

    const existingReservation = this.reservations.get(confirmationId);
    if (existingReservation && !conflictsWith(existingReservation.number)) {
      current.confirmation_number = existingReservation.number;
      current.temporary_reference = existingReservation.number;
      return [{ confirmation_number: existingReservation.number, sequence_number: existingReservation.sequence }] as unknown as T;
    }
    if (existingReservation) this.reservations.delete(confirmationId);

    const seqKey = `${organizationId}|${entityId}|${year}|${prefix}`;
    const highestFromConfirmations = [...confirmations.values()].reduce((max, row) => {
      const match = typeof row.confirmation_number === "string" ? row.confirmation_number.match(/(\d+)\s*$/) : null;
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    const highestFromReservations = [...this.reservations.values()].reduce((max, entry) => Math.max(max, entry.sequence), 0);
    const next = Math.max(this.sequences.get(seqKey) ?? 0, highestFromConfirmations, highestFromReservations) + 1;
    this.sequences.set(seqKey, next);
    const number = `${prefix}${String(next).padStart(padding, "0")}`;
    this.reservations.set(confirmationId, { number, sequence: next });
    current.confirmation_number = number;
    current.temporary_reference = number;
    return [{ confirmation_number: number, sequence_number: next }] as unknown as T;
  }
}

async function setup(): Promise<{ repo: AppRepository; db: ReturnType<typeof initializeDatabase>; partnerId: string; productId: string }> {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-dashboard-alerts-"));
  tempDirs.push(userData);
  const dirs = resolveAppDirectories(userData);
  ensureAppDirectories(dirs);
  const db = initializeDatabase(dirs);
  const cloud = new FakeSharedRepository();
  const repo = new AppRepository(db, dirs, cloud as unknown as SharedRepository);
  repo.saveInstallationProfile({ installationName: "Operacoes", appVariant: "multiempresa", defaultOrganizationId: villaId, defaultLegalEntityId: ownLegalEntityId, allowOrganizationSwitch: true, allowLegalEntitySwitch: true, completedSetup: true });
  const partner = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Alertas", notes: null, roles: ["CLIENT"], isActive: true });
  const product = repo.listProducts({ organizationId: villaId })[0];
  await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: partner.id, ownLegalEntityId: null, productId: product.id, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 10, notes: null, isActive: true });
  return { repo, db, partnerId: partner.id, productId: product.id };
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

function createConfirmedOperation(repo: AppRepository, partnerId: string, productId: string, documentNumber: string, sacks: string, entityId = ownLegalEntityId): void {
  const doc = repo.createFiscalDocument({ organizationId: villaId, ownLegalEntityId: entityId, responsiblePartnerId: partnerId, partnerLegalEntityId: null, accessKey: null, documentNumber, series: "1", issueDate: "2026-07-16", totalAmountCents: 100000, hasPendingIssues: false, pendingNotes: null, notes: null });
  const item = repo.addFiscalDocumentItem({ fiscalDocumentId: doc.document.id, productId, description: "Cafe", quantity: sacks, unit: "SACK", unitPriceDecimal: "1000.000", totalAmountCents: 100000, sacksQuantity: sacks });
  repo.addOperation({ fiscalDocumentId: doc.document.id, fiscalDocumentItemId: item.id, ownLegalEntityId: entityId, responsiblePartnerId: partnerId, productId, operationType: "SALE", operationScope: "EXTERNAL", operationDate: "2026-07-16", quantitySacks: sacks, manualRateValueCents: null, manualOverrideReason: null, notes: null });
  repo.confirmFiscalDocument(doc.document.id);
}

async function issueCharge(repo: AppRepository, partnerId: string, entityId: string, periodEnd: string, dueDate: string): Promise<void> {
  const eligible = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId: entityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd });
  const draft = repo.createClientChargeDraft({ organizationId: villaId, ownLegalEntityId: entityId, clientPartnerId: partnerId, billingProfileId: null, periodicity: "MONTHLY", periodStart: "2026-07-01", periodEnd, dueDate, notes: null, internalNotes: null, operationIds: eligible.map((item) => item.id) });
  await repo.issueClientCharge(draft.charge.id);
}

describe("dashboard alerts", () => {
  it("flags an issued charge as overdue once its due date has passed", async () => {
    const { repo, db, partnerId, productId } = await setup();
    createConfirmedOperation(repo, partnerId, productId, "8001", "10.5");
    const eligible = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    const draft = repo.createClientChargeDraft({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, billingProfileId: null, periodicity: "MONTHLY", periodStart: "2026-07-01", periodEnd: "2026-07-31", dueDate: "2020-01-10", notes: null, internalNotes: null, operationIds: eligible.map((item) => item.id) });
    await repo.issueClientCharge(draft.charge.id);

    const alerts = repo.getDashboardAlerts(villaId, ownLegalEntityId);
    expect(alerts.overdueCharges).toHaveLength(1);
    expect(alerts.overdueCharges[0]).toMatchObject({ partnerId, partnerName: "Cliente Alertas", dueDate: "2020-01-10", openAmountCents: 5250 });
    expect(alerts.overdueCharges[0].daysOverdue).toBeGreaterThan(365);
    db.close();
  });

  it("does not flag a charge whose due date has not passed yet", async () => {
    const { repo, db, partnerId, productId } = await setup();
    createConfirmedOperation(repo, partnerId, productId, "8002", "5");
    const eligible = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    const draft = repo.createClientChargeDraft({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, billingProfileId: null, periodicity: "MONTHLY", periodStart: "2026-07-01", periodEnd: "2026-07-31", dueDate: "2099-01-10", notes: null, internalNotes: null, operationIds: eligible.map((item) => item.id) });
    await repo.issueClientCharge(draft.charge.id);

    const alerts = repo.getDashboardAlerts(villaId, ownLegalEntityId);
    expect(alerts.overdueCharges).toHaveLength(0);
    db.close();
  });

  it("flags a deal confirmation waiting for signature for 7+ days, but not a recent one", async () => {
    const { repo, db, partnerId, productId } = await setup();
    const seller = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Villa Vendedora", notes: null, roles: ["SELLER"], isActive: true });

    const oldDraft = repo.createDealConfirmationDraft({ organizationId: villaId, ownLegalEntityId, confirmationDate: "2026-07-01", paymentTermsSnapshot: "A vista", deliveryLocationSnapshot: "Armazem", qualityTermsSnapshot: "Padrao", generalTermsSnapshot: "Revisado" });
    repo.addDealConfirmationParty({ dealConfirmationId: oldDraft.confirmation.id, partyRole: "SELLER", businessPartnerId: seller.id, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 1 });
    repo.addDealConfirmationParty({ dealConfirmationId: oldDraft.confirmation.id, partyRole: "BUYER", businessPartnerId: partnerId, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 2 });
    repo.addDealConfirmationItem({ dealConfirmationId: oldDraft.confirmation.id, sortOrder: 0, productId, productNameSnapshot: "Cafe", productDescriptionSnapshot: "Cafe arabica", cropSnapshot: "2026", qualitySnapshot: "Bebida dura", packagingSnapshot: "Sacas de juta", originSnapshot: "Sul de Minas", destinationSnapshot: "Armazem", quantitySacksDecimal: "10", sackWeightKgDecimal: "60", unitPriceDecimal: "1000", totalAmountCents: null, totalOverrideReason: null, deliveryStartDate: "2026-07-05", deliveryEndDate: "2026-07-10", deliveryLocationSnapshot: "Armazem", notes: null });
    const oldIssued = await repo.issueDealConfirmation(oldDraft.confirmation.id);
    repo.markDealConfirmationSentForSignature(oldIssued.confirmation.id);
    db.prepare("UPDATE deal_confirmations SET sent_for_signature_at = ? WHERE id = ?").run("2020-01-01T00:00:00.000Z", oldIssued.confirmation.id);

    const recentDraft = repo.createDealConfirmationDraft({ organizationId: villaId, ownLegalEntityId, confirmationDate: "2026-07-20", paymentTermsSnapshot: "A vista", deliveryLocationSnapshot: "Armazem", qualityTermsSnapshot: "Padrao", generalTermsSnapshot: "Revisado" });
    repo.addDealConfirmationParty({ dealConfirmationId: recentDraft.confirmation.id, partyRole: "SELLER", businessPartnerId: seller.id, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 1 });
    repo.addDealConfirmationParty({ dealConfirmationId: recentDraft.confirmation.id, partyRole: "BUYER", businessPartnerId: partnerId, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 2 });
    repo.addDealConfirmationItem({ dealConfirmationId: recentDraft.confirmation.id, sortOrder: 0, productId, productNameSnapshot: "Cafe", productDescriptionSnapshot: "Cafe arabica", cropSnapshot: "2026", qualitySnapshot: "Bebida dura", packagingSnapshot: "Sacas de juta", originSnapshot: "Sul de Minas", destinationSnapshot: "Armazem", quantitySacksDecimal: "10", sackWeightKgDecimal: "60", unitPriceDecimal: "1000", totalAmountCents: null, totalOverrideReason: null, deliveryStartDate: "2026-07-22", deliveryEndDate: "2026-07-25", deliveryLocationSnapshot: "Armazem", notes: null });
    const recentIssued = await repo.issueDealConfirmation(recentDraft.confirmation.id);
    repo.markDealConfirmationSentForSignature(recentIssued.confirmation.id);

    const alerts = repo.getDashboardAlerts(villaId, ownLegalEntityId);
    expect(alerts.waitingSignatureConfirmations).toHaveLength(1);
    expect(alerts.waitingSignatureConfirmations[0]).toMatchObject({ confirmationId: oldIssued.confirmation.id, buyerName: "Cliente Alertas" });
    expect(alerts.waitingSignatureConfirmations[0].daysWaiting).toBeGreaterThan(365);
    db.close();
  });

  it("flags a client whose outstanding balance reaches 90% of its credit limit, but not one comfortably below it", async () => {
    const { repo, db, partnerId, productId } = await setup();
    await repo.updateBusinessPartner(partnerId, { organizationId: villaId, displayName: "Cliente Alertas", notes: null, roles: ["CLIENT"], isActive: true, creditLimitCents: 5500 });
    createConfirmedOperation(repo, partnerId, productId, "8003", "10.5");
    const eligible = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    const draft = repo.createClientChargeDraft({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, billingProfileId: null, periodicity: "MONTHLY", periodStart: "2026-07-01", periodEnd: "2026-07-31", dueDate: "2099-01-10", notes: null, internalNotes: null, operationIds: eligible.map((item) => item.id) });
    await repo.issueClientCharge(draft.charge.id);

    const comfortablePartner = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Tranquilo", notes: null, roles: ["CLIENT"], isActive: true, creditLimitCents: 1000000 });
    await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: comfortablePartner.id, ownLegalEntityId: null, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 10, notes: null, isActive: true });
    createConfirmedOperation(repo, comfortablePartner.id, productId, "8004", "1");
    const comfortableEligible = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: comfortablePartner.id, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    const comfortableDraft = repo.createClientChargeDraft({ organizationId: villaId, ownLegalEntityId, clientPartnerId: comfortablePartner.id, billingProfileId: null, periodicity: "MONTHLY", periodStart: "2026-07-01", periodEnd: "2026-07-31", dueDate: "2099-01-10", notes: null, internalNotes: null, operationIds: comfortableEligible.map((item) => item.id) });
    await repo.issueClientCharge(comfortableDraft.charge.id);

    const alerts = repo.getDashboardAlerts(villaId, ownLegalEntityId);
    expect(alerts.partnersNearCreditLimit).toHaveLength(1);
    expect(alerts.partnersNearCreditLimit[0]).toMatchObject({ partnerId, partnerName: "Cliente Alertas", creditLimitCents: 5500, outstandingCents: 5250, percentUsed: 95 });
    db.close();
  });

  it("does not mix credit limit balances between different own CNPJs", async () => {
    const { repo, db, partnerId, productId } = await setup();
    await repo.updateBusinessPartner(partnerId, { organizationId: villaId, displayName: "Cliente Alertas", notes: null, roles: ["CLIENT"], isActive: true, creditLimitCents: 10000 });

    createConfirmedOperation(repo, partnerId, productId, "8005", "10", ownLegalEntityId);
    await issueCharge(repo, partnerId, ownLegalEntityId, "2026-07-20", "2099-01-10");

    createConfirmedOperation(repo, partnerId, productId, "8006", "10", villaEsLegalEntityId);
    await issueCharge(repo, partnerId, villaEsLegalEntityId, "2026-07-21", "2099-01-10");

    const mgAlerts = repo.getDashboardAlerts(villaId, ownLegalEntityId);
    expect(mgAlerts.partnersNearCreditLimit).toHaveLength(0);

    const consolidatedAlerts = repo.getDashboardAlerts(villaId, null);
    expect(consolidatedAlerts.partnersNearCreditLimit).toHaveLength(1);
    expect(consolidatedAlerts.partnersNearCreditLimit[0]).toMatchObject({ partnerId, outstandingCents: 10000, percentUsed: 100 });
    db.close();
  });
});
