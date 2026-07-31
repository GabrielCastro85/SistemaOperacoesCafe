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

async function setup(): Promise<{ repo: AppRepository; db: ReturnType<typeof initializeDatabase>; productId: string; partnerAId: string; partnerBId: string }> {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-dashboard-periodo-"));
  tempDirs.push(userData);
  const dirs = resolveAppDirectories(userData);
  ensureAppDirectories(dirs);
  const db = initializeDatabase(dirs);
  const repo = new AppRepository(db);
  repo.saveInstallationProfile({
    installationName: "Villa",
    appVariant: "villa",
    defaultOrganizationId: villaId,
    defaultLegalEntityId: ownLegalEntityId,
    allowOrganizationSwitch: false,
    allowLegalEntitySwitch: true,
    completedSetup: true
  });
  const partnerA = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Corretor Periodo A", notes: null, roles: ["CLIENT"], isActive: true });
  const partnerB = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Corretor Periodo B", notes: null, roles: ["CLIENT"], isActive: true });
  const product = repo.listProducts({ organizationId: villaId })[0];
  for (const partnerId of [partnerA.id, partnerB.id]) {
    await repo.createServiceRateRule({
      organizationId: villaId,
      businessPartnerId: partnerId,
      ownLegalEntityId: null,
      productId: product.id,
      operationScope: "EXTERNAL",
      rateType: "PER_SACK",
      rateValueCents: 500,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      priority: 10,
      notes: null,
      isActive: true
    });
  }
  return { repo, db, productId: product.id, partnerAId: partnerA.id, partnerBId: partnerB.id };
}

function sampleDocument(partnerId: string, documentNumber: string, issueDate: string) {
  return {
    organizationId: villaId,
    ownLegalEntityId,
    responsiblePartnerId: partnerId,
    partnerLegalEntityId: null,
    accessKey: null,
    documentNumber,
    series: "1",
    issueDate,
    totalAmountCents: 100000,
    hasPendingIssues: false,
    pendingNotes: null,
    notes: null
  };
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe("filtros de periodo e cliente do Dashboard", () => {
  it("getOperationalIndicators so' soma operacoes dentro do periodo informado", async () => {
    const { repo, db, productId, partnerAId } = await setup();

    const insideDoc = repo.createFiscalDocument(sampleDocument(partnerAId, "500", "2026-06-15"));
    const insideItem = repo.addFiscalDocumentItem({ fiscalDocumentId: insideDoc.document.id, productId, description: "Cafe", quantity: "100", unit: "SACK", unitPriceDecimal: "100", totalAmountCents: 100000, sacksQuantity: "100" });
    repo.addOperation({ fiscalDocumentId: insideDoc.document.id, fiscalDocumentItemId: insideItem.id, ownLegalEntityId, responsiblePartnerId: partnerAId, productId, operationType: "SALE", operationScope: "EXTERNAL", operationDate: "2026-06-15", quantitySacks: "100", manualRateValueCents: null, manualOverrideReason: null, notes: null });
    repo.confirmFiscalDocument(insideDoc.document.id);

    const outsideDoc = repo.createFiscalDocument(sampleDocument(partnerAId, "501", "2026-08-15"));
    const outsideItem = repo.addFiscalDocumentItem({ fiscalDocumentId: outsideDoc.document.id, productId, description: "Cafe", quantity: "40", unit: "SACK", unitPriceDecimal: "100", totalAmountCents: 100000, sacksQuantity: "40" });
    repo.addOperation({ fiscalDocumentId: outsideDoc.document.id, fiscalDocumentItemId: outsideItem.id, ownLegalEntityId, responsiblePartnerId: partnerAId, productId, operationType: "SALE", operationScope: "EXTERNAL", operationDate: "2026-08-15", quantitySacks: "40", manualRateValueCents: null, manualOverrideReason: null, notes: null });
    repo.confirmFiscalDocument(outsideDoc.document.id);

    const noFilter = repo.getOperationalIndicators({ organizationId: villaId, ownLegalEntityId });
    expect(noFilter.sacksDecimal).toBe("140");

    const filtered = repo.getOperationalIndicators({ organizationId: villaId, ownLegalEntityId, periodStart: "2026-06-01", periodEnd: "2026-06-30" });
    expect(filtered.sacksDecimal).toBe("100");
    expect(filtered.documents).toBe(1);

    db.close();
  });

  it("getPartnerPeriodSackSummary isola sacas por cliente/corretor e por periodo", async () => {
    const { repo, db, productId, partnerAId, partnerBId } = await setup();

    const docA = repo.createFiscalDocument(sampleDocument(partnerAId, "600", "2026-07-10"));
    const itemA = repo.addFiscalDocumentItem({ fiscalDocumentId: docA.document.id, productId, description: "Cafe", quantity: "60", unit: "SACK", unitPriceDecimal: "100", totalAmountCents: 100000, sacksQuantity: "60" });
    repo.addOperation({ fiscalDocumentId: docA.document.id, fiscalDocumentItemId: itemA.id, ownLegalEntityId, responsiblePartnerId: partnerAId, productId, operationType: "SALE", operationScope: "EXTERNAL", operationDate: "2026-07-10", quantitySacks: "60", manualRateValueCents: null, manualOverrideReason: null, notes: null });
    repo.confirmFiscalDocument(docA.document.id);

    const docAOutside = repo.createFiscalDocument(sampleDocument(partnerAId, "601", "2026-09-10"));
    const itemAOutside = repo.addFiscalDocumentItem({ fiscalDocumentId: docAOutside.document.id, productId, description: "Cafe", quantity: "15", unit: "SACK", unitPriceDecimal: "100", totalAmountCents: 100000, sacksQuantity: "15" });
    repo.addOperation({ fiscalDocumentId: docAOutside.document.id, fiscalDocumentItemId: itemAOutside.id, ownLegalEntityId, responsiblePartnerId: partnerAId, productId, operationType: "SALE", operationScope: "EXTERNAL", operationDate: "2026-09-10", quantitySacks: "15", manualRateValueCents: null, manualOverrideReason: null, notes: null });
    repo.confirmFiscalDocument(docAOutside.document.id);

    const docB = repo.createFiscalDocument(sampleDocument(partnerBId, "602", "2026-07-12"));
    const itemB = repo.addFiscalDocumentItem({ fiscalDocumentId: docB.document.id, productId, description: "Cafe", quantity: "25", unit: "SACK", unitPriceDecimal: "100", totalAmountCents: 100000, sacksQuantity: "25" });
    repo.addOperation({ fiscalDocumentId: docB.document.id, fiscalDocumentItemId: itemB.id, ownLegalEntityId, responsiblePartnerId: partnerBId, productId, operationType: "SALE", operationScope: "EXTERNAL", operationDate: "2026-07-12", quantitySacks: "25", manualRateValueCents: null, manualOverrideReason: null, notes: null });
    repo.confirmFiscalDocument(docB.document.id);

    const summaryA = repo.getPartnerPeriodSackSummary({ organizationId: villaId, ownLegalEntityId, businessPartnerId: partnerAId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    expect(summaryA.sacksDecimal).toBe("60");
    expect(summaryA.operationCount).toBe(1);
    expect(summaryA.documentCount).toBe(1);

    const summaryB = repo.getPartnerPeriodSackSummary({ organizationId: villaId, ownLegalEntityId, businessPartnerId: partnerBId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    expect(summaryB.sacksDecimal).toBe("25");

    const summaryAAllTime = repo.getPartnerPeriodSackSummary({ organizationId: villaId, ownLegalEntityId, businessPartnerId: partnerAId });
    expect(summaryAAllTime.sacksDecimal).toBe("75");

    db.close();
  });
});
