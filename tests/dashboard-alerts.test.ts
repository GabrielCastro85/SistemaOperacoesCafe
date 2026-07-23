import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { AppRepository } from "../electron/main/services/appRepository";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";

const tempDirs: string[] = [];
const villaId = "11111111-1111-4111-8111-111111111111";
const ownLegalEntityId = "33333333-3333-4333-8333-333333333331";
const villaEsLegalEntityId = "33333333-3333-4333-8333-333333333332";

function setup(): { repo: AppRepository; db: ReturnType<typeof initializeDatabase>; partnerId: string; productId: string } {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-dashboard-alerts-"));
  tempDirs.push(userData);
  const dirs = resolveAppDirectories(userData);
  ensureAppDirectories(dirs);
  const db = initializeDatabase(dirs);
  const repo = new AppRepository(db, dirs);
  repo.saveInstallationProfile({ installationName: "Operacoes", appVariant: "multiempresa", defaultOrganizationId: villaId, defaultLegalEntityId: ownLegalEntityId, allowOrganizationSwitch: true, allowLegalEntitySwitch: true, completedSetup: true });
  const partner = repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Alertas", notes: null, roles: ["CLIENT"], isActive: true });
  const product = repo.listProducts({ organizationId: villaId })[0];
  repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: partner.id, ownLegalEntityId: null, productId: product.id, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 10, notes: null, isActive: true });
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
    const { repo, db, partnerId, productId } = setup();
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
    const { repo, db, partnerId, productId } = setup();
    createConfirmedOperation(repo, partnerId, productId, "8002", "5");
    const eligible = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    const draft = repo.createClientChargeDraft({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, billingProfileId: null, periodicity: "MONTHLY", periodStart: "2026-07-01", periodEnd: "2026-07-31", dueDate: "2099-01-10", notes: null, internalNotes: null, operationIds: eligible.map((item) => item.id) });
    await repo.issueClientCharge(draft.charge.id);

    const alerts = repo.getDashboardAlerts(villaId, ownLegalEntityId);
    expect(alerts.overdueCharges).toHaveLength(0);
    db.close();
  });

  it("flags a deal confirmation waiting for signature for 7+ days, but not a recent one", async () => {
    const { repo, db, partnerId, productId } = setup();
    const seller = repo.createBusinessPartner({ organizationId: villaId, displayName: "Villa Vendedora", notes: null, roles: ["SELLER"], isActive: true });

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
    const { repo, db, partnerId, productId } = setup();
    repo.updateBusinessPartner(partnerId, { organizationId: villaId, displayName: "Cliente Alertas", notes: null, roles: ["CLIENT"], isActive: true, creditLimitCents: 5500 });
    createConfirmedOperation(repo, partnerId, productId, "8003", "10.5");
    const eligible = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    const draft = repo.createClientChargeDraft({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, billingProfileId: null, periodicity: "MONTHLY", periodStart: "2026-07-01", periodEnd: "2026-07-31", dueDate: "2099-01-10", notes: null, internalNotes: null, operationIds: eligible.map((item) => item.id) });
    await repo.issueClientCharge(draft.charge.id);

    const comfortablePartner = repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Tranquilo", notes: null, roles: ["CLIENT"], isActive: true, creditLimitCents: 1000000 });
    repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: comfortablePartner.id, ownLegalEntityId: null, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 10, notes: null, isActive: true });
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
    const { repo, db, partnerId, productId } = setup();
    repo.updateBusinessPartner(partnerId, { organizationId: villaId, displayName: "Cliente Alertas", notes: null, roles: ["CLIENT"], isActive: true, creditLimitCents: 10000 });

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
