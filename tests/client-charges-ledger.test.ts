import { existsSync, mkdtempSync, rmSync } from "node:fs";
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
const graoId = "22222222-2222-4222-8222-222222222222";
const graoMgLegalEntityId = "44444444-4444-4444-8444-444444444441";
const graoSpLegalEntityId = "44444444-4444-4444-8444-444444444442";

function setup(organizationId = villaId, defaultLegalEntityId = ownLegalEntityId): { repo: AppRepository; db: ReturnType<typeof initializeDatabase>; partnerId: string; productId: string } {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-charge-"));
  tempDirs.push(userData);
  const dirs = resolveAppDirectories(userData);
  ensureAppDirectories(dirs);
  const db = initializeDatabase(dirs);
  const repo = new AppRepository(db, dirs);
  repo.saveInstallationProfile({ installationName: "Operacoes", appVariant: "multiempresa", defaultOrganizationId: organizationId, defaultLegalEntityId, allowOrganizationSwitch: true, allowLegalEntitySwitch: true, completedSetup: true });
  const partner = repo.createBusinessPartner({ organizationId, displayName: "Cliente Cobranca", notes: null, roles: ["CLIENT"], isActive: true });
  const product = repo.listProducts({ organizationId })[0];
  repo.createServiceRateRule({ organizationId, businessPartnerId: partner.id, ownLegalEntityId: null, productId: product.id, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 10, notes: null, isActive: true });
  return { repo, db, partnerId: partner.id, productId: product.id };
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe("client charges and ledger", () => {
  it("suggests periods including leap-year monthly and biweekly windows", () => {
    const { repo, db, partnerId } = setup();
    expect(repo.suggestChargePeriods({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodicity: "MONTHLY", referenceDate: "2024-02-20" })[0]).toMatchObject({ periodStart: "2024-02-01", periodEnd: "2024-02-29" });
    expect(repo.suggestChargePeriods({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodicity: "BIWEEKLY", referenceDate: "2026-07-20" })[0]).toMatchObject({ periodStart: "2026-07-16", periodEnd: "2026-07-31" });
    db.close();
  });

  it("reserves operations, applies credit, issues documents and receives partial payment", async () => {
    const { repo, db, partnerId, productId } = setup();
    createConfirmedOperation(repo, partnerId, productId, "7001", "10.5");
    const eligible = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    expect(eligible).toHaveLength(1);
    const draft = repo.createClientChargeDraft({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, billingProfileId: null, periodicity: "MONTHLY", periodStart: "2026-07-01", periodEnd: "2026-07-31", dueDate: "2026-08-05", notes: null, internalNotes: null, operationIds: eligible.map((item) => item.id) });
    expect(draft.charge.subtotalServicesCents).toBe(5250);
    expect(repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" })).toHaveLength(0);
    const credit = repo.createAdvance({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, clientChargeId: null, entryType: "ADVANCE_RECEIVED", effect: "REDUCE_RECEIVABLE", amountCents: 2000, entryDate: "2026-07-10", description: "Adiantamento", referenceNumber: null, notes: null, attachmentPath: null, availableAmountCents: 2000 });
    const withCredit = repo.applyCredit({ ledgerEntryId: credit.id, clientChargeId: draft.charge.id, amountCents: 1500 });
    expect(withCredit.charge.finalAmountCents).toBe(3750);
    const issued = await repo.issueClientCharge(draft.charge.id);
    expect(issued.charge.chargeNumber).toMatch(/^COB-2026-/);
    expect(issued.charge.pdfFilePath && existsSync(issued.charge.pdfFilePath)).toBe(true);
    expect(issued.charge.excelFilePath && existsSync(issued.charge.excelFilePath)).toBe(true);
    expect(issued.charge.imageFilePath && existsSync(issued.charge.imageFilePath)).toBe(true);
    const payment = repo.createClientPayment({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, paymentDate: "2026-08-01", amountCents: 1000, paymentMethod: "PIX", bankAccountDescription: null, transactionReference: null, notes: null, attachmentPath: null });
    const paid = repo.allocatePayment({ clientPaymentId: payment.id, clientChargeId: issued.charge.id, amountCents: 1000 });
    expect(paid.charge.status).toBe("PARTIALLY_PAID");
    expect(paid.charge.openAmountCents).toBe(2750);
    db.close();
  });

  it("summarizes internal/external sacks and value per client, zeroing clients without operations in the period", () => {
    const { repo, db, partnerId, productId } = setup();
    const otherPartner = repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Sem Operacao", notes: null, roles: ["CLIENT"], isActive: true });
    repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: partnerId, ownLegalEntityId: null, productId, operationScope: "INTERNAL", rateType: "PER_SACK", rateValueCents: 300, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 10, notes: null, isActive: true });
    createConfirmedOperation(repo, partnerId, productId, "9001", "10.5", "EXTERNAL");
    createConfirmedOperation(repo, partnerId, productId, "9002", "4.5", "INTERNAL");

    const summary = repo.getPartnerRateSummary({ organizationId: villaId, ownLegalEntityId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    const withOperations = summary.find((row) => row.partnerId === partnerId);
    const withoutOperations = summary.find((row) => row.partnerId === otherPartner.id);
    expect(withOperations).toMatchObject({ externalSacks: "10.5", internalSacks: "4.5", externalAmountCents: 5250, internalAmountCents: 1350, totalAmountCents: 6600, operationCount: 2 });
    expect(withoutOperations).toMatchObject({ externalSacks: "0", internalSacks: "0", totalAmountCents: 0, operationCount: 0 });

    const eligible = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    repo.createClientChargeDraft({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, billingProfileId: null, periodicity: "MONTHLY", periodStart: "2026-07-01", periodEnd: "2026-07-31", dueDate: "2026-08-05", notes: null, internalNotes: null, operationIds: eligible.map((item) => item.id) });

    const afterBilling = repo.getPartnerRateSummary({ organizationId: villaId, ownLegalEntityId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    expect(afterBilling.find((row) => row.partnerId === partnerId)?.operationCount).toBe(0);
    const includingBilled = repo.getPartnerRateSummary({ organizationId: villaId, ownLegalEntityId, periodStart: "2026-07-01", periodEnd: "2026-07-31", includeAlreadyBilled: true });
    expect(includingBilled.find((row) => row.partnerId === partnerId)?.operationCount).toBe(2);
    db.close();
  });

  it("lists client operations across legal entities for billing diagnostics", () => {
    const { repo, db, partnerId, productId } = setup();
    createConfirmedOperation(repo, partnerId, productId, "9101", "310", "EXTERNAL");
    const operations = repo.listOperations({ organizationId: villaId, responsiblePartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31", status: "all", billingStatus: "all" });
    expect(operations).toHaveLength(1);
    expect(operations[0]).toMatchObject({
      responsiblePartnerId: partnerId,
      quantitySacks: "310",
      appliedRateValueCents: 500,
      serviceAmountCents: 155000,
      billingStatus: "UNBILLED"
    });
    db.close();
  });

  it("backfills an active client rate into older unbilled operations without a calculated value", () => {
    const { repo, db, productId } = setup();
    const partner = repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Regra Posterior", notes: null, roles: ["CLIENT"], isActive: true });
    createConfirmedOperation(repo, partner.id, productId, "9201", "330", "EXTERNAL");
    expect(repo.listOperations({ organizationId: villaId, ownLegalEntityId, responsiblePartnerId: partner.id, status: "all", billingStatus: "all" })[0].serviceAmountCents).toBe(0);

    repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: partner.id, ownLegalEntityId: null, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-07-23", effectiveTo: null, priority: 10, notes: null, isActive: true });
    const eligible = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partner.id, periodStart: "2026-07-01", periodEnd: "2026-07-31" });

    expect(eligible).toHaveLength(1);
    expect(eligible[0]).toMatchObject({ appliedRateValueCents: 500, serviceAmountCents: 165000 });
    db.close();
  });

  it("keeps Villa MG and Villa ES billing and sacks indicators independent", () => {
    const { repo, db, partnerId, productId } = setup();
    createConfirmedOperation(repo, partnerId, productId, "9301", "100", "EXTERNAL", ownLegalEntityId);
    createConfirmedOperation(repo, partnerId, productId, "9302", "250", "EXTERNAL", villaEsLegalEntityId);

    const mgSummary = repo.getBillingSummary({ organizationId: villaId, ownLegalEntityId });
    const esSummary = repo.getBillingSummary({ organizationId: villaId, ownLegalEntityId: villaEsLegalEntityId });
    expect(mgSummary.unbilledOperations).toBe(1);
    expect(mgSummary.unbilledSacks).toBe("100");
    expect(mgSummary.openCents).toBe(50000);
    expect(esSummary.unbilledOperations).toBe(1);
    expect(esSummary.unbilledSacks).toBe("250");
    expect(esSummary.openCents).toBe(125000);

    const mgMonthly = repo.getMonthlyOperationTotals(villaId, 2026, ownLegalEntityId);
    const esMonthly = repo.getMonthlyOperationTotals(villaId, 2026, villaEsLegalEntityId);
    expect(mgMonthly[6]).toMatchObject({ sacksDecimal: "100", amountCents: 50000, operationCount: 1 });
    expect(esMonthly[6]).toMatchObject({ sacksDecimal: "250", amountCents: 125000, operationCount: 1 });
    db.close();
  });

  it("keeps Grao & Grao MG and SP billing and sacks indicators independent", () => {
    const { repo, db, partnerId, productId } = setup(graoId, graoMgLegalEntityId);
    createConfirmedOperation(repo, partnerId, productId, "9401", "80", "EXTERNAL", graoMgLegalEntityId, graoId);
    createConfirmedOperation(repo, partnerId, productId, "9402", "175", "EXTERNAL", graoSpLegalEntityId, graoId);

    const mgSummary = repo.getBillingSummary({ organizationId: graoId, ownLegalEntityId: graoMgLegalEntityId });
    const spSummary = repo.getBillingSummary({ organizationId: graoId, ownLegalEntityId: graoSpLegalEntityId });
    expect(mgSummary.unbilledOperations).toBe(1);
    expect(mgSummary.unbilledSacks).toBe("80");
    expect(mgSummary.openCents).toBe(40000);
    expect(spSummary.unbilledOperations).toBe(1);
    expect(spSummary.unbilledSacks).toBe("175");
    expect(spSummary.openCents).toBe(87500);

    const mgDocs = repo.listFiscalDocuments({ organizationId: graoId, ownLegalEntityId: graoMgLegalEntityId });
    const spDocs = repo.listFiscalDocuments({ organizationId: graoId, ownLegalEntityId: graoSpLegalEntityId });
    expect(mgDocs.map((doc) => doc.documentNumber)).toEqual(["9401"]);
    expect(spDocs.map((doc) => doc.documentNumber)).toEqual(["9402"]);
    db.close();
  });

  it("refreshes unbilled operation service values when a rate rule is created after the note", () => {
    const { repo, db, productId } = setup();
    const partner = repo.createBusinessPartner({ organizationId: villaId, displayName: "Diamante", notes: null, roles: ["CLIENT"], isActive: true });
    createConfirmedOperation(repo, partner.id, productId, "9102", "310", "EXTERNAL");
    expect(repo.listOperations({ organizationId: villaId, responsiblePartnerId: partner.id })[0].serviceAmountCents).toBe(0);
    repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: partner.id, ownLegalEntityId: null, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 10, notes: null, isActive: true });
    const eligible = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partner.id, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    expect(eligible).toHaveLength(1);
    expect(eligible[0].appliedRateValueCents).toBe(500);
    expect(eligible[0].serviceAmountCents).toBe(155000);
    const summary = repo.getBillingSummary(villaId);
    expect(summary.openCents).toBe(155000);
    expect(summary.unbilledOperations).toBe(1);
    expect(summary.unbilledSacks).toBe("310");
    db.close();
  });

  it("releases reserved operations when draft is cancelled", () => {
    const { repo, db, partnerId, productId } = setup();
    createConfirmedOperation(repo, partnerId, productId, "8001", "2");
    const eligible = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    const draft = repo.createClientChargeDraft({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, billingProfileId: null, periodicity: "CUSTOM", periodStart: "2026-07-01", periodEnd: "2026-07-31", dueDate: null, notes: null, internalNotes: null, operationIds: [eligible[0].id] });
    repo.cancelClientCharge(draft.charge.id, "Rascunho incorreto");
    expect(repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" })).toHaveLength(1);
    db.close();
  });
});

function createConfirmedOperation(repo: AppRepository, partnerId: string, productId: string, documentNumber: string, sacks: string, operationScope: "INTERNAL" | "EXTERNAL" = "EXTERNAL", targetOwnLegalEntityId = ownLegalEntityId, organizationId = villaId): void {
  const doc = repo.createFiscalDocument({ organizationId, ownLegalEntityId: targetOwnLegalEntityId, responsiblePartnerId: partnerId, partnerLegalEntityId: null, accessKey: null, documentNumber, series: "1", issueDate: "2026-07-16", totalAmountCents: 100000, hasPendingIssues: false, pendingNotes: null, notes: null });
  const item = repo.addFiscalDocumentItem({ fiscalDocumentId: doc.document.id, productId, description: "Cafe", quantity: sacks, unit: "SACK", unitPriceDecimal: "1000.000", totalAmountCents: 100000, sacksQuantity: sacks });
  repo.addOperation({ fiscalDocumentId: doc.document.id, fiscalDocumentItemId: item.id, ownLegalEntityId: targetOwnLegalEntityId, responsiblePartnerId: partnerId, productId, operationType: "SALE", operationScope, operationDate: "2026-07-16", quantitySacks: sacks, manualRateValueCents: null, manualOverrideReason: null, notes: null });
  repo.confirmFiscalDocument(doc.document.id);
}
