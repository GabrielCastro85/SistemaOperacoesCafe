import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { migrations } from "../electron/main/database/migrations";
import { AppRepository } from "../electron/main/services/appRepository";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";

const tempDirs: string[] = [];
const villaId = "11111111-1111-4111-8111-111111111111";
const ownLegalEntityId = "33333333-3333-4333-8333-333333333331";

function setup(): { repo: AppRepository; db: ReturnType<typeof initializeDatabase> } {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-reset-"));
  tempDirs.push(userData);
  const dirs = resolveAppDirectories(userData);
  ensureAppDirectories(dirs);
  const db = initializeDatabase(dirs);
  const repo = new AppRepository(db, dirs);
  repo.saveInstallationProfile({
    installationName: "Villa",
    appVariant: "villa",
    defaultOrganizationId: villaId,
    defaultLegalEntityId: ownLegalEntityId,
    allowOrganizationSwitch: false,
    allowLegalEntitySwitch: true,
    completedSetup: true
  });
  return { repo, db };
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

function runResetMigration(db: ReturnType<typeof initializeDatabase>): void {
  const migration = migrations.find((item) => item.name === "030_reset_partners_and_documents");
  if (!migration) throw new Error("Migration 030_reset_partners_and_documents nao encontrada.");
  migration.up(db);
}

describe("factory reset migration (030_reset_partners_and_documents)", () => {
  it("wipes clients/suppliers/notes/operations/charges/payables/deals, keeps companies, users, products and categories", async () => {
    const { repo, db } = setup();
    const product = repo.listProducts({ organizationId: villaId })[0];
    const category = (await repo.listExpenseCategories(villaId))[0];

    const partner = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Para Zerar", notes: null, roles: ["CLIENT"], isActive: true });
    await repo.createPartnerLegalEntity({ organizationId: villaId, businessPartnerId: partner.id, legalName: "Cliente Para Zerar Ltda", tradeName: "Cliente Zerar", cnpj: "11222333000181", stateRegistration: null, municipalRegistration: null, email: null, phone: null, addressLine: null, addressNumber: null, addressComplement: null, district: null, city: null, state: null, postalCode: null, isPrimary: true, isActive: true, isDraft: false });
    await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: partner.id, ownLegalEntityId, productId: null, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 1, notes: null, isActive: true });
    const doc = repo.createFiscalDocument({ organizationId: villaId, ownLegalEntityId, responsiblePartnerId: partner.id, partnerLegalEntityId: null, accessKey: null, documentNumber: "500", series: "1", issueDate: "2026-07-16", totalAmountCents: 100000, hasPendingIssues: false, pendingNotes: null, notes: null });
    const item = repo.addFiscalDocumentItem({ fiscalDocumentId: doc.document.id, productId: product.id, description: "Cafe", quantity: "100", unit: "SACK", unitPriceDecimal: "1000", totalAmountCents: 100000, sacksQuantity: "100" });
    repo.addOperation({ fiscalDocumentId: doc.document.id, fiscalDocumentItemId: item.id, ownLegalEntityId, responsiblePartnerId: partner.id, productId: product.id, operationType: "SALE", operationScope: "EXTERNAL", operationDate: "2026-07-16", quantitySacks: "100", manualRateValueCents: null, manualOverrideReason: null, notes: null });
    repo.createAccountPayableDraft({ organizationId: villaId, ownLegalEntityId, supplierPartnerId: null, supplierLegalEntityId: null, payeeNameSnapshot: "Fornecedor generico", payeeTaxIdSnapshot: null, categoryId: category.id, defaultCostCenterId: null, defaultLocationId: null, source: "MANUAL", description: "Conta teste", documentType: null, documentNumber: null, competenceDate: "2026-08-01", issueDate: null, dueDate: "2026-08-10", originalAmountCents: 10000, discountCents: 0, interestCents: 0, penaltyCents: 0, otherAdditionsCents: 0, amountStatus: "CONFIRMED", notes: null, internalNotes: null });

    expect(db.prepare("SELECT COUNT(*) AS c FROM business_partners").get()).toMatchObject({ c: 1 });
    expect(db.prepare("SELECT COUNT(*) AS c FROM fiscal_documents").get()).toMatchObject({ c: 1 });
    expect(db.prepare("SELECT COUNT(*) AS c FROM operations").get()).toMatchObject({ c: 1 });
    expect(db.prepare("SELECT COUNT(*) AS c FROM accounts_payable").get()).toMatchObject({ c: 1 });

    runResetMigration(db);

    // Zerado.
    for (const table of ["business_partners", "business_partner_roles", "partner_legal_entities", "partner_contacts", "service_rate_rules", "fiscal_documents", "fiscal_document_items", "operations", "accounts_payable", "client_charges"]) {
      expect(db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get(), table).toMatchObject({ c: 0 });
    }

    // Preservado.
    expect(db.prepare("SELECT COUNT(*) AS c FROM organizations").get(), "organizations").not.toMatchObject({ c: 0 });
    expect(db.prepare("SELECT COUNT(*) AS c FROM legal_entities").get(), "legal_entities").not.toMatchObject({ c: 0 });
    expect(db.prepare("SELECT COUNT(*) AS c FROM products").get(), "products").not.toMatchObject({ c: 0 });
    expect(db.prepare("SELECT COUNT(*) AS c FROM expense_categories").get(), "expense_categories").not.toMatchObject({ c: 0 });
    expect(repo.getOrganization(villaId).name).toBeTruthy();

    db.close();
  });
});
