import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { AppRepository } from "../electron/main/services/appRepository";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";
import { multiplyDecimalByCents, normalizeDecimalText } from "../src/shared/utils/decimal";

const tempDirs: string[] = [];
const villaId = "11111111-1111-4111-8111-111111111111";
const ownLegalEntityId = "33333333-3333-4333-8333-333333333331";
const villaEsLegalEntityId = "33333333-3333-4333-8333-333333333332";

function setup(): { repo: AppRepository; db: ReturnType<typeof initializeDatabase>; partnerId: string; productId: string } {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-step4-"));
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
  const partner = repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Manual", notes: null, roles: ["CLIENT"], isActive: true });
  const product = repo.listProducts({ organizationId: villaId })[0];
  repo.createServiceRateRule({
    organizationId: villaId,
    businessPartnerId: partner.id,
    ownLegalEntityId: null,
    productId: product.id,
    operationScope: "EXTERNAL",
    rateType: "PER_SACK",
    rateValueCents: 500,
    effectiveFrom: "2026-07-01",
    effectiveTo: null,
    priority: 10,
    notes: null,
    isActive: true
  });
  return { repo, db, partnerId: partner.id, productId: product.id };
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe("manual invoices and operations", () => {
  it("normalizes decimals and calculates cents exactly", () => {
    expect(normalizeDecimalText("502,300000")).toBe("502.3");
    expect(multiplyDecimalByCents("502.3", 500)).toBe(251150);
  });

  it("creates manual invoice, items and operation with automatic rate", () => {
    const { repo, db, partnerId, productId } = setup();
    const doc = repo.createFiscalDocument(sampleDocument(partnerId, "100", null));
    expect(doc.document.status).toBe("DRAFT");
    const item = repo.addFiscalDocumentItem({ fiscalDocumentId: doc.document.id, productId, description: "Cafe", quantity: "502.3", unit: "SACK", unitPriceDecimal: "1234.5678", totalAmountCents: 100000, sacksQuantity: "502.3" });
    const operation = repo.addOperation({ fiscalDocumentId: doc.document.id, fiscalDocumentItemId: item.id, ownLegalEntityId, responsiblePartnerId: partnerId, productId, operationType: "SALE", operationScope: "EXTERNAL", operationDate: "2026-07-16", quantitySacks: "502.3", manualRateValueCents: null, manualOverrideReason: null, notes: null });
    expect(operation.appliedRateValueCents).toBe(500);
    expect(operation.serviceAmountCents).toBe(251150);
    expect(repo.confirmFiscalDocument(doc.document.id).document.status).toBe("CONFIRMED");
    db.close();
  });

  it("creates invoice and operation with a shared client registered under another organization", () => {
    const { repo, db, productId } = setup();
    const graoId = "22222222-2222-4222-8222-222222222222";
    const sharedPartner = repo.createBusinessPartner({ organizationId: graoId, displayName: "Cliente Global", notes: null, roles: ["CLIENT"], isActive: true });
    repo.createServiceRateRule({
      organizationId: villaId,
      businessPartnerId: sharedPartner.id,
      ownLegalEntityId: null,
      productId,
      operationScope: "EXTERNAL",
      rateType: "PER_SACK",
      rateValueCents: 700,
      effectiveFrom: "2026-07-01",
      effectiveTo: null,
      priority: 10,
      notes: null,
      isActive: true
    });

    const doc = repo.createFiscalDocument(sampleDocument(sharedPartner.id, "101", null));
    const operation = repo.addOperation({
      fiscalDocumentId: doc.document.id,
      fiscalDocumentItemId: null,
      ownLegalEntityId,
      responsiblePartnerId: sharedPartner.id,
      productId,
      operationType: "SALE",
      operationScope: "EXTERNAL",
      operationDate: "2026-07-16",
      quantitySacks: "10",
      manualRateValueCents: null,
      manualOverrideReason: null,
      notes: null
    });
    expect(operation.appliedRateValueCents).toBe(700);
    expect(operation.serviceAmountCents).toBe(7000);
    db.close();
  });

  it("blocks duplicate access key and warns possible duplicate without key", () => {
    const { repo, db, partnerId } = setup();
    repo.createFiscalDocument(sampleDocument(partnerId, "200", "12345678901234567890123456789012345678901234"));
    expect(() => repo.createFiscalDocument(sampleDocument(partnerId, "201", "12345678901234567890123456789012345678901234"))).toThrow(/Chave/);
    repo.createFiscalDocument(sampleDocument(partnerId, "300", null));
    const possible = repo.createFiscalDocument(sampleDocument(partnerId, "300", null));
    expect(possible.document.duplicateWarning).toContain("Possivel duplicidade");
    db.close();
  });

  it("requires reason for manual override and recalculates service amount", () => {
    const { repo, db, partnerId, productId } = setup();
    const doc = repo.createFiscalDocument(sampleDocument(partnerId, "400", null));
    const operation = repo.addOperation({ fiscalDocumentId: doc.document.id, fiscalDocumentItemId: null, ownLegalEntityId, responsiblePartnerId: partnerId, productId, operationType: "SALE", operationScope: "EXTERNAL", operationDate: "2026-07-16", quantitySacks: "10.5", manualRateValueCents: null, manualOverrideReason: null, notes: null });
    expect(() => repo.updateOperationManualRate(operation.id, 750, "")).toThrow(/Motivo/);
    expect(repo.updateOperationManualRate(operation.id, 750, "Acordo comercial").serviceAmountCents).toBe(7875);
    db.close();
  });

  it("handles pending documents and cancellation", () => {
    const { repo, db, partnerId } = setup();
    const doc = repo.createFiscalDocument({ ...sampleDocument(partnerId, "500", null), hasPendingIssues: true, pendingNotes: "Conferir peso" });
    expect(doc.document.status).toBe("PENDING");
    expect(() => repo.confirmFiscalDocument(doc.document.id)).toThrow(/pendencias/);
    expect(repo.cancelFiscalDocument(doc.document.id, "Nota incorreta").document.status).toBe("CANCELED");
    expect(repo.getOperationalIndicators(villaId).pending).toBe(1);
    db.close();
  });

  it("filters invoices by own legal entity and deletes an unbilled wrong invoice completely", () => {
    const { repo, db, partnerId, productId } = setup();
    const mgDoc = repo.createFiscalDocument(sampleDocument(partnerId, "660", null));
    const esDoc = repo.createFiscalDocument({ ...sampleDocument(partnerId, "661", null), ownLegalEntityId: villaEsLegalEntityId });
    const item = repo.addFiscalDocumentItem({ fiscalDocumentId: esDoc.document.id, productId, description: "Cafe", quantity: "475", unit: "SACK", unitPriceDecimal: "1000", totalAmountCents: 47500000, sacksQuantity: "475" });
    repo.addOperation({ fiscalDocumentId: esDoc.document.id, fiscalDocumentItemId: item.id, ownLegalEntityId: villaEsLegalEntityId, responsiblePartnerId: partnerId, productId, operationType: "SALE", operationScope: "EXTERNAL", operationDate: "2026-07-16", quantitySacks: "475", manualRateValueCents: null, manualOverrideReason: null, notes: null });
    expect(repo.listFiscalDocuments({ organizationId: villaId, ownLegalEntityId }).map((doc) => doc.documentNumber)).toEqual(["660"]);
    expect(repo.listFiscalDocuments({ organizationId: villaId, ownLegalEntityId: villaEsLegalEntityId }).map((doc) => doc.documentNumber)).toEqual(["661"]);

    repo.deleteFiscalDocument(esDoc.document.id);
    expect(repo.listFiscalDocuments({ organizationId: villaId, ownLegalEntityId: villaEsLegalEntityId })).toHaveLength(0);
    expect(repo.listOperations({ organizationId: villaId, ownLegalEntityId: villaEsLegalEntityId })).toHaveLength(0);
    expect(repo.getFiscalDocument(mgDoc.document.id).document.documentNumber).toBe("660");
    db.close();
  });
});

function sampleDocument(partnerId: string, documentNumber: string, accessKey: string | null) {
  return {
    organizationId: villaId,
    ownLegalEntityId,
    responsiblePartnerId: partnerId,
    partnerLegalEntityId: null,
    accessKey,
    documentNumber,
    series: "1",
    issueDate: "2026-07-16",
    totalAmountCents: 100000,
    hasPendingIssues: false,
    pendingNotes: null,
    notes: null
  };
}
