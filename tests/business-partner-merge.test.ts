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

function setup(): { repo: AppRepository; db: ReturnType<typeof initializeDatabase> } {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-partner-merge-"));
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

function sampleDocument(partnerId: string, documentNumber: string) {
  return {
    organizationId: villaId,
    ownLegalEntityId,
    responsiblePartnerId: partnerId,
    partnerLegalEntityId: null,
    accessKey: null,
    documentNumber,
    series: "1",
    issueDate: "2026-07-16",
    totalAmountCents: 100000,
    hasPendingIssues: false,
    pendingNotes: null,
    notes: null
  };
}

describe("business partner duplicate merge", () => {
  it("finds the 'one real CNPJ + empty shell' pattern and merges the shell into the CNPJ holder", async () => {
    const { repo, db } = setup();
    const canonical = await repo.createBusinessPartner({ organizationId: villaId, displayName: "IF Comercio de Cafe Ltda", notes: null, roles: ["CLIENT"], isActive: true });
    await repo.createPartnerLegalEntity({ organizationId: villaId, businessPartnerId: canonical.id, legalName: "IF Comercio Ltda", tradeName: "IF Comercio", cnpj: "47893849000103", stateRegistration: null, municipalRegistration: null, email: null, phone: null, addressLine: null, addressNumber: null, addressComplement: null, district: null, city: null, state: null, postalCode: null, isPrimary: true, isActive: true, isDraft: false });
    const doc = repo.createFiscalDocument(sampleDocument(canonical.id, "100"));
    const item = repo.addFiscalDocumentItem({ fiscalDocumentId: doc.document.id, productId: null, description: "Cafe", quantity: "100", unit: "SACK", unitPriceDecimal: "1000", totalAmountCents: 100000, sacksQuantity: "100" });
    repo.addOperation({ fiscalDocumentId: doc.document.id, fiscalDocumentItemId: item.id, ownLegalEntityId, responsiblePartnerId: canonical.id, productId: null, operationType: "SALE", operationScope: "EXTERNAL", operationDate: "2026-07-16", quantitySacks: "100", manualRateValueCents: null, manualOverrideReason: null, notes: null });

    // Casca vazia: mesmo nome, sem CNPJ, sem nada vinculado -- exatamente o padrao real encontrado em producao.
    const shell = await repo.createBusinessPartner({ organizationId: villaId, displayName: "IF Comercio de Cafe Ltda", notes: null, roles: ["CLIENT"], isActive: true });

    const report = repo.getBusinessPartnerDuplicateReport(villaId);
    const group = report.find((entry) => entry.partners.some((partner) => partner.id === canonical.id));
    expect(group).toBeDefined();
    expect(group?.suggestedCanonicalPartnerId).toBe(canonical.id);
    expect(group?.matchedCnpj).toBe("47893849000103");
    expect(group?.partners.map((partner) => partner.id).sort()).toEqual([canonical.id, shell.id].sort());

    await repo.mergeBusinessPartnerDuplicate({ canonicalPartnerId: canonical.id, duplicatePartnerId: shell.id, matchedCnpj: group?.matchedCnpj ?? null, reason: "teste" });

    const archivedShell = repo.getBusinessPartner(shell.id);
    expect(archivedShell.isActive).toBe(false);
    expect(archivedShell.displayName).toContain("Mesclado em IF Comercio de Cafe Ltda");
    // O historico real (nota, item, operacao) ja estava no canonico -- nada pra redirecionar, e continua la'.
    expect(repo.getFiscalDocument(doc.document.id).operations[0].responsiblePartnerId).toBe(canonical.id);

    const merges = db.prepare("SELECT * FROM business_partner_merges WHERE duplicate_partner_id = ?").all(shell.id);
    expect(merges).toHaveLength(1);

    // Idempotente: rodar de novo nao quebra nem duplica o registro de fusao.
    await repo.mergeBusinessPartnerDuplicate({ canonicalPartnerId: canonical.id, duplicatePartnerId: shell.id, matchedCnpj: group?.matchedCnpj ?? null, reason: "teste de novo" });
    expect(db.prepare("SELECT COUNT(*) AS c FROM business_partner_merges WHERE duplicate_partner_id = ?").get(shell.id)).toMatchObject({ c: 1 });
    db.close();
  });

  it("does NOT group matriz/filial (different real CNPJs under the same trade name) as duplicates", async () => {
    const { repo, db } = setup();
    const matriz = await repo.createBusinessPartner({ organizationId: villaId, displayName: "ANM Comercio Atacadista Ltda", notes: null, roles: ["CLIENT"], isActive: true });
    await repo.createPartnerLegalEntity({ organizationId: villaId, businessPartnerId: matriz.id, legalName: "ANM Matriz", tradeName: "ANM", cnpj: "50378028000135", stateRegistration: null, municipalRegistration: null, email: null, phone: null, addressLine: null, addressNumber: null, addressComplement: null, district: null, city: null, state: null, postalCode: null, isPrimary: true, isActive: true, isDraft: false });
    const filial = await repo.createBusinessPartner({ organizationId: villaId, displayName: "ANM Comercio Atacadista Ltda", notes: null, roles: ["CLIENT"], isActive: true });
    await repo.createPartnerLegalEntity({ organizationId: villaId, businessPartnerId: filial.id, legalName: "ANM Filial", tradeName: "ANM", cnpj: "50378028000216", stateRegistration: null, municipalRegistration: null, email: null, phone: null, addressLine: null, addressNumber: null, addressComplement: null, district: null, city: null, state: null, postalCode: null, isPrimary: true, isActive: true, isDraft: false });

    const report = repo.getBusinessPartnerDuplicateReport(villaId);
    expect(report.some((entry) => entry.partners.some((partner) => partner.id === matriz.id || partner.id === filial.id))).toBe(false);
    db.close();
  });

  it("merges an all-CNPJ-less exact-name duplicate, choosing the copy with linked records as canonical", async () => {
    const { repo, db } = setup();
    const withData = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Leo ES", notes: null, roles: ["SUPPLIER"], isActive: true });
    await repo.createPurchaseRateRule({ organizationId: villaId, businessPartnerId: withData.id, ownLegalEntityId: null, counterpartyPartnerLegalEntityId: null, productId: null, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-01-01", effectiveTo: null, priority: 1, notes: null, isActive: true });
    const doc = repo.createFiscalDocument({ ...sampleDocument(withData.id, "ENT-1"), operationType: "PURCHASE" });
    const item = repo.addFiscalDocumentItem({ fiscalDocumentId: doc.document.id, productId: null, description: "Cafe", quantity: "50", unit: "SACK", unitPriceDecimal: "500", totalAmountCents: 25000, sacksQuantity: "50" });
    repo.addOperation({ fiscalDocumentId: doc.document.id, fiscalDocumentItemId: item.id, ownLegalEntityId, responsiblePartnerId: withData.id, productId: null, operationType: "PURCHASE", operationScope: "EXTERNAL", operationDate: "2026-07-16", quantitySacks: "50", manualRateValueCents: null, manualOverrideReason: null, notes: null });

    const empty1 = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Leo ES", notes: null, roles: ["SUPPLIER"], isActive: true });
    const empty2 = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Leo ES", notes: null, roles: ["SUPPLIER"], isActive: true });

    const report = repo.getBusinessPartnerDuplicateReport(villaId);
    const group = report.find((entry) => entry.partners.some((partner) => partner.id === withData.id));
    expect(group?.suggestedCanonicalPartnerId).toBe(withData.id);
    expect(group?.matchedCnpj).toBeNull();
    expect(group?.partners).toHaveLength(3);

    for (const duplicate of [empty1, empty2]) {
      await repo.mergeBusinessPartnerDuplicate({ canonicalPartnerId: withData.id, duplicatePartnerId: duplicate.id, matchedCnpj: null, reason: "mesmo nome, sem CNPJ, zero vinculos" });
      expect(repo.getBusinessPartner(duplicate.id).isActive).toBe(false);
    }

    // O parceiro que sobrevive continua com a regra de compra e a operacao intactas.
    expect(repo.getFiscalDocument(doc.document.id).operations[0].purchaseSettlementStatus).toBe("UNSETTLED");
    expect(db.prepare("SELECT COUNT(*) AS c FROM purchase_rate_rules WHERE business_partner_id = ?").get(withData.id)).toMatchObject({ c: 1 });
    db.close();
  });

  it("merges distinct roles from both copies and redirects aliases that don't collide", async () => {
    const { repo, db } = setup();
    const canonical = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Fornecedor Alias Ltda", notes: null, roles: ["CLIENT"], isActive: true });
    await repo.createPartnerLegalEntity({ organizationId: villaId, businessPartnerId: canonical.id, legalName: "Fornecedor Alias Ltda", tradeName: "Fornecedor Alias", cnpj: "11222333000181", stateRegistration: null, municipalRegistration: null, email: null, phone: null, addressLine: null, addressNumber: null, addressComplement: null, district: null, city: null, state: null, postalCode: null, isPrimary: true, isActive: true, isDraft: false });

    const duplicate = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Fornecedor Alias Ltda", notes: null, roles: ["SUPPLIER"], isActive: true });
    await repo.createPartnerAlias({ organizationId: villaId, businessPartnerId: duplicate.id, partnerLegalEntityId: null, alias: "APELIDO SO DO DUPLICADO", source: "MANUAL", isActive: true });

    const report = repo.getBusinessPartnerDuplicateReport(villaId);
    const group = report.find((entry) => entry.partners.some((partner) => partner.id === canonical.id));
    expect(group?.suggestedCanonicalPartnerId).toBe(canonical.id);

    await repo.mergeBusinessPartnerDuplicate({ canonicalPartnerId: canonical.id, duplicatePartnerId: duplicate.id, matchedCnpj: group?.matchedCnpj ?? null, reason: "teste alias/roles" });

    // SUPPLIER do duplicado migrou pro canonico (canonico agora atende os dois papeis, nada se perdeu).
    expect(repo.getBusinessPartner(canonical.id).roles.sort()).toEqual(["CLIENT", "SUPPLIER"]);
    // O alias do duplicado (sem colisao com nenhum do canonico) migrou normalmente.
    const canonicalAliases = db.prepare("SELECT alias FROM partner_aliases WHERE business_partner_id = ? AND is_active = 1").all(canonical.id) as Array<{ alias: string }>;
    expect(canonicalAliases.map((a) => a.alias)).toContain("APELIDO SO DO DUPLICADO");
    db.close();
  });
});
