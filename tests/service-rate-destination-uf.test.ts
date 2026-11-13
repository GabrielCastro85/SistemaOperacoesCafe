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

async function setup(): Promise<{ repo: AppRepository; db: ReturnType<typeof initializeDatabase>; partnerId: string; productId: string }> {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-uf-rate-"));
  tempDirs.push(userData);
  const dirs = resolveAppDirectories(userData);
  ensureAppDirectories(dirs);
  const db = initializeDatabase(dirs);
  const repo = new AppRepository(db, dirs);
  repo.saveInstallationProfile({ installationName: "Operacoes", appVariant: "multiempresa", defaultOrganizationId: villaId, defaultLegalEntityId: ownLegalEntityId, allowOrganizationSwitch: true, allowLegalEntitySwitch: true, completedSetup: true });
  const partner = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Artur Cafes", notes: null, roles: ["CLIENT"], isActive: true });
  const product = repo.listProducts({ organizationId: villaId })[0];
  return { repo, db, partnerId: partner.id, productId: product.id };
}

// Venda confirmada cujo destinatario esta na UF informada (snapshot fiscal, como na importacao de XML).
function createSale(repo: AppRepository, db: ReturnType<typeof initializeDatabase>, partnerId: string, productId: string, documentNumber: string, recipientState: string | null): void {
  const sacks = "10";
  const doc = repo.createFiscalDocument({ organizationId: villaId, ownLegalEntityId, responsiblePartnerId: partnerId, partnerLegalEntityId: null, accessKey: null, documentNumber, series: "1", issueDate: "2026-07-16", totalAmountCents: 100000, hasPendingIssues: false, pendingNotes: null, notes: null });
  db.prepare("UPDATE fiscal_documents SET direction = 'OUTBOUND', fiscal_snapshot_json = ? WHERE id = ?").run(JSON.stringify({
    issuer: { legalName: "VILLA COFFEE COMERCIO LTDA", cnpjCpf: "44963370000523", state: "MG" },
    recipient: { legalName: `ARTUR CAFES ${recipientState ?? "SEM UF"}`, cnpjCpf: "11222333000144", state: recipientState }
  }), doc.document.id);
  const item = repo.addFiscalDocumentItem({ fiscalDocumentId: doc.document.id, productId, description: "Cafe", quantity: sacks, unit: "SACK", unitPriceDecimal: "1000.000", totalAmountCents: 100000, sacksQuantity: sacks });
  repo.addOperation({ fiscalDocumentId: doc.document.id, fiscalDocumentItemId: item.id, ownLegalEntityId, responsiblePartnerId: partnerId, productId, operationType: "SALE", operationScope: "EXTERNAL", operationDate: "2026-07-16", quantitySacks: sacks, manualRateValueCents: null, manualOverrideReason: null, notes: null });
  repo.confirmFiscalDocument(doc.document.id);
}

function rule(partnerId: string, productId: string, destinationStateUf: string | null, rateValueCents: number, priority = 1): Parameters<AppRepository["createServiceRateRule"]>[0] {
  return { organizationId: villaId, businessPartnerId: partnerId, ownLegalEntityId: null, counterpartyPartnerLegalEntityId: null, productId: null, operationScope: "ALL", rateType: "PER_SACK", rateValueCents, effectiveFrom: "2026-07-01", effectiveTo: null, priority, notes: null, isActive: true, destinationStateUf } as Parameters<AppRepository["createServiceRateRule"]>[0];
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe("taxa por UF de destino", () => {
  it("aplica a taxa da UF do destinatario e usa a regra geral para os demais estados", async () => {
    const { repo, db, partnerId, productId } = await setup();
    try {
      await repo.createServiceRateRule(rule(partnerId, productId, null, 600));
      await repo.createServiceRateRule(rule(partnerId, productId, "ES", 700));
      await repo.createServiceRateRule(rule(partnerId, productId, "MG", 500));
      createSale(repo, db, partnerId, productId, "ES-1", "ES");
      createSale(repo, db, partnerId, productId, "MG-1", "MG");
      createSale(repo, db, partnerId, productId, "SP-1", "SP");
      createSale(repo, db, partnerId, productId, "SEM-UF", null);

      const filters = { organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" };
      const operations = repo.findEligibleOperations(filters);
      const rateByNote = Object.fromEntries(operations.map((operation) => [repo.getFiscalDocument(operation.fiscalDocumentId).document.documentNumber, operation.appliedRateValueCents]));
      expect(rateByNote).toEqual({ "ES-1": 700, "MG-1": 500, "SP-1": 600, "SEM-UF": 600 });

      const draft = repo.createClientChargeDraft({ ...filters, billingProfileId: null, periodicity: "MONTHLY", dueDate: "2026-08-05", notes: null, internalNotes: null, operationIds: operations.map((operation) => operation.id) });
      const rateInCharge = Object.fromEntries(repo.getClientCharge(draft.charge.id).operations.map((item) => [item.fiscalDocumentNumberSnapshot, item.serviceRateCentsSnapshot]));
      expect(rateInCharge).toEqual({ "ES-1": 700, "MG-1": 500, "SP-1": 600, "SEM-UF": 600 });
    } finally { db.close(); }
  });

  it("aceita uma regra por UF ao lado da geral, mas bloqueia duas regras da mesma UF no mesmo periodo", async () => {
    const { repo, db, partnerId, productId } = await setup();
    try {
      await repo.createServiceRateRule(rule(partnerId, productId, null, 600));
      await repo.createServiceRateRule(rule(partnerId, productId, "ES", 700));
      await repo.createServiceRateRule(rule(partnerId, productId, "MG", 500));
      await expect(repo.createServiceRateRule(rule(partnerId, productId, "ES", 800))).rejects.toThrow(/conflitante/);
    } finally { db.close(); }
  });
});
