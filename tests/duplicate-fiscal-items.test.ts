import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { AppRepository } from "../electron/main/services/appRepository";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";

const tempDirs: string[] = [];
const organizationId = "11111111-1111-4111-8111-111111111111";
const ownLegalEntityId = "33333333-3333-4333-8333-333333333331";

afterEach(() => { tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })); });

async function setup() {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-dup-items-"));
  tempDirs.push(userData);
  const dirs = resolveAppDirectories(userData);
  ensureAppDirectories(dirs);
  const db = initializeDatabase(dirs);
  const repo = new AppRepository(db, dirs);
  repo.saveInstallationProfile({ installationName: "Operacoes", appVariant: "multiempresa", defaultOrganizationId: organizationId, defaultLegalEntityId: ownLegalEntityId, allowOrganizationSwitch: true, allowLegalEntitySwitch: true, completedSetup: true });
  const partner = await repo.createBusinessPartner({ organizationId, displayName: "Correios Teste", notes: null, roles: ["CLIENT"], isActive: true });
  const product = repo.listProducts({ organizationId })[0];
  await repo.createServiceRateRule({ organizationId, businessPartnerId: partner.id, ownLegalEntityId: null, productId: product.id, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 1300, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 10, notes: null, isActive: true });
  // Nota de 650 sc / R$ 702.000 com o mesmo item gravado `copies` vezes.
  const note = (number: string, copies: number, itemTotalCents = 70_200_000, sacks = "650") => {
    const doc = repo.createFiscalDocument({ organizationId, ownLegalEntityId, responsiblePartnerId: partner.id, partnerLegalEntityId: null, accessKey: null, documentNumber: number, series: "1", issueDate: "2026-08-04", totalAmountCents: 70_200_000, hasPendingIssues: false, pendingNotes: null, notes: null });
    for (let index = 0; index < copies; index++) {
      const item = repo.addFiscalDocumentItem({ fiscalDocumentId: doc.document.id, productId: product.id, description: "CAFE EM GRAOS CRU ARABICA", quantity: sacks, unit: "SACK", unitPriceDecimal: "1080.00", totalAmountCents: itemTotalCents, sacksQuantity: sacks });
      repo.addOperation({ fiscalDocumentId: doc.document.id, fiscalDocumentItemId: item.id, ownLegalEntityId, responsiblePartnerId: partner.id, productId: product.id, operationType: "SALE", operationScope: "EXTERNAL", operationDate: "2026-08-04", quantitySacks: sacks, manualRateValueCents: null, manualOverrideReason: null, notes: null });
    }
    repo.confirmFiscalDocument(doc.document.id);
    return doc.document.id;
  };
  return { repo, db, partner, note };
}

describe("notas com itens duplicados", () => {
  it("simula, corrige e deixa um item e uma operacao; nao mexe em nota que confere", async () => {
    const { repo, db, note } = await setup();
    try {
      const duplicated = note("5712", 4);
      const legit = note("2974", 2, 35_100_000, "325");
      expect(repo.removeDuplicateFiscalDocumentItems(duplicated, true)).toMatchObject({ status: "WOULD_FIX", removedItems: 3, removedOperations: 3 });
      expect(repo.getFiscalDocument(duplicated).items).toHaveLength(4);
      expect(repo.removeDuplicateFiscalDocumentItems(duplicated, false)).toMatchObject({ status: "FIXED", removedItems: 3, removedOperations: 3 });
      const fixed = repo.getFiscalDocument(duplicated);
      expect(fixed.items).toHaveLength(1);
      expect(fixed.operations.map((operation) => [operation.quantitySacks, operation.serviceAmountCents])).toEqual([["650", 845_000]]);
      expect(repo.removeDuplicateFiscalDocumentItems(duplicated, false).status).toBe("NOTHING");
      expect(repo.removeDuplicateFiscalDocumentItems(legit, false).status).toBe("NOTHING");
      expect(repo.getFiscalDocument(legit).items).toHaveLength(2);
    } finally { db.close(); }
  });

  it("nota triangulada: fica uma compra e uma venda no item que sobra", async () => {
    const { repo, db, partner } = await setup();
    try {
      const supplier = await repo.createBusinessPartner({ organizationId, displayName: "Cereais Teste", notes: null, roles: ["SUPPLIER"], isActive: true });
      const product = repo.listProducts({ organizationId })[0];
      const doc = repo.createFiscalDocument({ organizationId, ownLegalEntityId, responsiblePartnerId: partner.id, partnerLegalEntityId: null, accessKey: null, documentNumber: "238", series: "1", issueDate: "2026-08-05", totalAmountCents: 11_611_000, hasPendingIssues: false, pendingNotes: null, notes: null });
      const item = () => repo.addFiscalDocumentItem({ fiscalDocumentId: doc.document.id, productId: product.id, description: "CAFE", quantity: "683", unit: "SACK", unitPriceDecimal: "170.00", totalAmountCents: 11_611_000, sacksQuantity: "683" });
      const op = (itemId: string, type: "SALE" | "PURCHASE", partnerId: string) => repo.addOperation({ fiscalDocumentId: doc.document.id, fiscalDocumentItemId: itemId, ownLegalEntityId, responsiblePartnerId: partnerId, productId: product.id, operationType: type, operationScope: "EXTERNAL", operationDate: "2026-08-05", quantitySacks: "683", manualRateValueCents: 100, manualOverrideReason: "teste", notes: null });
      const first = item();
      const second = item();
      op(first.id, "PURCHASE", supplier.id);
      op(second.id, "SALE", partner.id);
      op(second.id, "PURCHASE", supplier.id);
      expect(repo.removeDuplicateFiscalDocumentItems(doc.document.id, false)).toMatchObject({ status: "FIXED", removedItems: 1, removedOperations: 1 });
      const fixed = repo.getFiscalDocument(doc.document.id);
      expect(fixed.items).toHaveLength(1);
      expect(fixed.operations.map((operation) => operation.operationType).sort()).toEqual(["PURCHASE", "SALE"]);
      expect(new Set(fixed.operations.map((operation) => operation.fiscalDocumentItemId))).toEqual(new Set([fixed.items[0].id]));
    } finally { db.close(); }
  });

  it("troca de cliente: fica a venda do cliente atual da nota, a do antigo sai", async () => {
    const { repo, db, partner } = await setup();
    try {
      const old = await repo.createBusinessPartner({ organizationId, displayName: "Matheus Teste", notes: null, roles: ["CLIENT"], isActive: true });
      const product = repo.listProducts({ organizationId })[0];
      const doc = repo.createFiscalDocument({ organizationId, ownLegalEntityId, responsiblePartnerId: partner.id, partnerLegalEntityId: null, accessKey: null, documentNumber: "5714", series: "1", issueDate: "2026-08-04", totalAmountCents: 50_000_000, hasPendingIssues: false, pendingNotes: null, notes: null });
      const item = () => repo.addFiscalDocumentItem({ fiscalDocumentId: doc.document.id, productId: product.id, description: "CAFE", quantity: "500", unit: "SACK", unitPriceDecimal: "1000.00", totalAmountCents: 50_000_000, sacksQuantity: "500" });
      const op = (itemId: string, partnerId: string) => repo.addOperation({ fiscalDocumentId: doc.document.id, fiscalDocumentItemId: itemId, ownLegalEntityId, responsiblePartnerId: partnerId, productId: product.id, operationType: "SALE", operationScope: "EXTERNAL", operationDate: "2026-08-04", quantitySacks: "500", manualRateValueCents: 1300, manualOverrideReason: "teste", notes: null });
      const first = item();
      op(first.id, old.id);
      const second = item();
      op(second.id, partner.id);
      expect(repo.removeDuplicateFiscalDocumentItems(doc.document.id, false)).toMatchObject({ status: "FIXED", removedItems: 1, removedOperations: 1 });
      const fixed = repo.getFiscalDocument(doc.document.id);
      expect(fixed.operations.map((operation) => operation.responsiblePartnerId)).toEqual([partner.id]);
      expect(fixed.operations[0].fiscalDocumentItemId).toBe(fixed.items[0].id);
    } finally { db.close(); }
  });

  it("bloqueia quando um item repetido ja esta numa cobranca", async () => {
    const { repo, db, partner, note } = await setup();
    try {
      const duplicated = note("391", 2);
      const operations = repo.getFiscalDocument(duplicated).operations;
      repo.createClientChargeDraft({ organizationId, ownLegalEntityId, clientPartnerId: partner.id, billingProfileId: null, periodicity: "MONTHLY", periodStart: "2026-08-01", periodEnd: "2026-08-31", dueDate: "2026-09-05", notes: null, internalNotes: null, operationIds: operations.map((operation) => operation.id) });
      expect(repo.removeDuplicateFiscalDocumentItems(duplicated, false)).toMatchObject({ status: "BLOCKED" });
      expect(repo.getFiscalDocument(duplicated).items).toHaveLength(2);
    } finally { db.close(); }
  });
});
