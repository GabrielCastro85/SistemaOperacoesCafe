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

function setup(): { repo: AppRepository; db: ReturnType<typeof initializeDatabase>; partnerId: string; productId: string } {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-charge-"));
  tempDirs.push(userData);
  const dirs = resolveAppDirectories(userData);
  ensureAppDirectories(dirs);
  const db = initializeDatabase(dirs);
  const repo = new AppRepository(db, dirs);
  repo.saveInstallationProfile({ installationName: "Villa", appVariant: "villa", defaultOrganizationId: villaId, defaultLegalEntityId: ownLegalEntityId, allowOrganizationSwitch: false, allowLegalEntitySwitch: true, completedSetup: true });
  const partner = repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Cobranca", notes: null, roles: ["CLIENT"], isActive: true });
  const product = repo.listProducts({ organizationId: villaId })[0];
  repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: partner.id, ownLegalEntityId: null, productId: product.id, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 10, notes: null, isActive: true });
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

function createConfirmedOperation(repo: AppRepository, partnerId: string, productId: string, documentNumber: string, sacks: string): void {
  const doc = repo.createFiscalDocument({ organizationId: villaId, ownLegalEntityId, responsiblePartnerId: partnerId, partnerLegalEntityId: null, accessKey: null, documentNumber, series: "1", issueDate: "2026-07-16", totalAmountCents: 100000, hasPendingIssues: false, pendingNotes: null, notes: null });
  const item = repo.addFiscalDocumentItem({ fiscalDocumentId: doc.document.id, productId, description: "Cafe", quantity: sacks, unit: "SACK", unitPriceDecimal: "1000.000", totalAmountCents: 100000, sacksQuantity: sacks });
  repo.addOperation({ fiscalDocumentId: doc.document.id, fiscalDocumentItemId: item.id, ownLegalEntityId, responsiblePartnerId: partnerId, productId, operationType: "SALE", operationScope: "EXTERNAL", operationDate: "2026-07-16", quantitySacks: sacks, manualRateValueCents: null, manualOverrideReason: null, notes: null });
  repo.confirmFiscalDocument(doc.document.id);
}
