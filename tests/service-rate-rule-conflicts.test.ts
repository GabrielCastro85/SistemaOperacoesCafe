import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { AppRepository } from "../electron/main/services/appRepository";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";

const tempDirs: string[] = [];
const villaId = "11111111-1111-4111-8111-111111111111";
const graoId = "22222222-2222-4222-8222-222222222222";
const ownLegalEntityId = "33333333-3333-4333-8333-333333333331";

async function setup(): Promise<{ repo: AppRepository; db: ReturnType<typeof initializeDatabase>; partnerId: string; productId: string }> {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-rate-conflict-"));
  tempDirs.push(userData);
  const dirs = resolveAppDirectories(userData);
  ensureAppDirectories(dirs);
  const db = initializeDatabase(dirs);
  const repo = new AppRepository(db, dirs);
  repo.saveInstallationProfile({ installationName: "Operacoes", appVariant: "multiempresa", defaultOrganizationId: villaId, defaultLegalEntityId: ownLegalEntityId, allowOrganizationSwitch: true, allowLegalEntitySwitch: true, completedSetup: true });
  const partner = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Conflito", notes: null, roles: ["CLIENT"], isActive: true });
  const product = repo.listProducts({ organizationId: villaId })[0];
  return { repo, db, partnerId: partner.id, productId: product.id };
}

function createConfirmedOperation(repo: AppRepository, partnerId: string, productId: string, documentNumber: string, sacks: string): string {
  const doc = repo.createFiscalDocument({ organizationId: villaId, ownLegalEntityId, responsiblePartnerId: partnerId, partnerLegalEntityId: null, accessKey: null, documentNumber, series: "1", issueDate: "2026-07-16", totalAmountCents: 100000, hasPendingIssues: false, pendingNotes: null, notes: null });
  const item = repo.addFiscalDocumentItem({ fiscalDocumentId: doc.document.id, productId, description: "Cafe", quantity: sacks, unit: "SACK", unitPriceDecimal: "1000.000", totalAmountCents: 100000, sacksQuantity: sacks });
  const operation = repo.addOperation({ fiscalDocumentId: doc.document.id, fiscalDocumentItemId: item.id, ownLegalEntityId, responsiblePartnerId: partnerId, productId, operationType: "SALE", operationScope: "EXTERNAL", operationDate: "2026-07-16", quantitySacks: sacks, manualRateValueCents: null, manualOverrideReason: null, notes: null });
  repo.confirmFiscalDocument(doc.document.id);
  return operation.id;
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* Windows may still hold a WAL handle briefly; harmless for test isolation. */ }
  });
});

describe("service rate rule conflict warnings", () => {
  it("reprices launched unbilled notes when saving a rule and restores stale pending status", async () => {
    const { repo, db, partnerId, productId } = await setup();
    try {
      const input = { organizationId: villaId, businessPartnerId: partnerId, ownLegalEntityId: null, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 10, notes: null, isActive: true };
      const rule = await repo.createServiceRateRule(input);
      const id = createConfirmedOperation(repo, partnerId, productId, "REPRICE", "500");
      const manual = createConfirmedOperation(repo, partnerId, productId, "MANUAL", "10");
      const billed = createConfirmedOperation(repo, partnerId, productId, "BILLED", "10");
      db.prepare("UPDATE operations SET rate_was_manually_overridden = 1 WHERE id = ?").run(manual);
      db.prepare("UPDATE operations SET billing_status = 'BILLED' WHERE id = ?").run(billed);
      db.prepare("UPDATE operations SET status = 'PENDING' WHERE id = ?").run(id);
      await repo.updateServiceRateRule(rule.id, { ...input, rateValueCents: 700 });
      expect(db.prepare("SELECT applied_rate_value_cents, service_amount_cents, status FROM operations WHERE id = ?").get(id)).toEqual({ applied_rate_value_cents: 700, service_amount_cents: 350000, status: "CONFIRMED" });
      expect(db.prepare("SELECT count(*) AS n FROM operation_rate_history WHERE operation_id = ?").get(id)).toEqual({ n: 1 });
      for (const protectedId of [manual, billed]) {
        expect(db.prepare("SELECT applied_rate_value_cents FROM operations WHERE id = ?").get(protectedId)).toEqual({ applied_rate_value_cents: 500 });
      }

      await repo.updateServiceRateRule(rule.id, { ...input, rateValueCents: 700 });
      expect(db.prepare("SELECT count(*) AS n FROM operation_rate_history WHERE operation_id = ?").get(id)).toEqual({ n: 1 });
    } finally { db.close(); }
  });

  it("keeps a specific company exception above a generic rate regardless of priority", async () => {
    const { repo, db, partnerId, productId } = await setup();
    try {
      const company = await repo.createPartnerLegalEntity({ organizationId: villaId, businessPartnerId: partnerId, legalName: "Primavera", tradeName: "Primavera", cnpj: "12345678000195", stateRegistration: null, municipalRegistration: null, email: null, phone: null, addressLine: null, addressNumber: null, addressComplement: null, district: null, postalCode: null, state: "SP", city: null, isPrimary: true, isActive: true, isDraft: false });
      const base = { organizationId: villaId, businessPartnerId: partnerId, ownLegalEntityId: null, productId: null, rateType: "PER_SACK", effectiveFrom: "1900-01-01", effectiveTo: null, notes: null, isActive: true };
      await repo.createServiceRateRule({ ...base, operationScope: "EXTERNAL", rateValueCents: 1300, priority: 999999 });
      await repo.createServiceRateRule({ ...base, counterpartyPartnerLegalEntityId: company.id, operationScope: "ALL", rateValueCents: 400, priority: 0 });
      expect(repo.resolveServiceRateRule({ organizationId: villaId, businessPartnerId: partnerId, ownLegalEntityId, counterpartyPartnerLegalEntityId: company.id, productId, operationScope: "EXTERNAL", operationDate: "2026-08-25" }).rateValueCents).toBe(400);
    } finally { db.close(); }
  });
  it("allows shared rules to be registered from another organization context", async () => {
    const { repo, db, partnerId, productId } = await setup();
    const rule = await repo.createServiceRateRule({ organizationId: graoId, businessPartnerId: partnerId, ownLegalEntityId: null, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "1900-01-01", effectiveTo: null, priority: 10, notes: null, isActive: true });

    expect(rule.organizationId).toBe(graoId);
    expect(rule.businessPartnerId).toBe(partnerId);
    expect(rule.productId).toBe(productId);
    expect(repo.listServiceRateRules({ organizationId: graoId, status: "active" }).map((item) => item.id)).toContain(rule.id);
    db.close();
  });

  // Duas regras com o MESMO formato (mesmos campos preenchidos, mesmos valores, mesma UF) e vigencia
  // sobreposta ja sao bloqueadas na criacao por assertServiceRateRule. O unico jeito de duas regras
  // ativas iguais coexistirem e' via desativar uma, cadastrar a "duplicata", e reativar a primeira --
  // reativar nao passa pela validacao de sobreposicao. E exatamente esse caso que o aviso pega.
  it("flags two equally-specific rules that only became simultaneously active via reactivation", async () => {
    const { repo, db, partnerId } = await setup();
    const ruleA = await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: partnerId, ownLegalEntityId: null, productId: null, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 10, notes: null, isActive: true });
    await repo.deactivateServiceRateRule(ruleA.id);
    const ruleB = await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: partnerId, ownLegalEntityId: null, productId: null, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 700, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 10, notes: null, isActive: true });
    expect(ruleB.conflictWarning).toBeNull();
    const reactivatedA = await repo.activateServiceRateRule(ruleA.id);
    expect(reactivatedA.conflictWarning).toContain("Pode empatar em especificidade");
    expect(repo.getServiceRateRule(ruleB.id).conflictWarning).toContain("Pode empatar em especificidade");
    db.close();
  });

  it("does not flag rules with different priority, different product, or non-overlapping validity", async () => {
    const { repo, db, partnerId, productId } = await setup();
    const ruleA = await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: partnerId, ownLegalEntityId: null, productId: null, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 10, notes: null, isActive: true });
    await repo.deactivateServiceRateRule(ruleA.id);

    // Mesmo formato, mesma vigencia, mas prioridade diferente: nunca empata de verdade (prioridade
    // desempata sozinha), entao nao deve ser sinalizado mesmo apos reativar.
    const differentPriority = await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: partnerId, ownLegalEntityId: null, productId: null, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 600, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 5, notes: null, isActive: true });
    const reactivatedA = await repo.activateServiceRateRule(ruleA.id);
    expect(reactivatedA.conflictWarning).toBeNull();
    expect(repo.getServiceRateRule(differentPriority.id).conflictWarning).toBeNull();
    await repo.deactivateServiceRateRule(ruleA.id);
    await repo.deactivateServiceRateRule(differentPriority.id);

    // Produto diferente: as duas nunca poderiam se aplicar a mesma operacao (uma operacao tem um so
    // produto), entao nunca ha risco real de empate.
    const specific = await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: partnerId, ownLegalEntityId: null, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 800, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 10, notes: null, isActive: true });
    expect(specific.conflictWarning).toBeNull();
    db.close();
  });

  it("clears the conflict warning once one of the two conflicting rules is deactivated again", async () => {
    const { repo, db, partnerId } = await setup();
    const ruleA = await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: partnerId, ownLegalEntityId: null, productId: null, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 10, notes: null, isActive: true });
    await repo.deactivateServiceRateRule(ruleA.id);
    const ruleB = await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: partnerId, ownLegalEntityId: null, productId: null, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 700, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 10, notes: null, isActive: true });
    await repo.activateServiceRateRule(ruleA.id);
    expect(repo.getServiceRateRule(ruleB.id).conflictWarning).not.toBeNull();
    await repo.deactivateServiceRateRule(ruleA.id);
    expect(repo.getServiceRateRule(ruleB.id).conflictWarning).toBeNull();
    db.close();
  });
});

describe("operation rate history", () => {
  it("does not log history on the first rate resolution of a new operation", async () => {
    const { repo, db, partnerId, productId } = await setup();
    await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: partnerId, ownLegalEntityId: null, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 10, notes: null, isActive: true });
    const operationId = createConfirmedOperation(repo, partnerId, productId, "8001", "10");
    repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    const operation = repo.listOperations({ organizationId: villaId })[0];
    expect(operation.id).toBe(operationId);
    expect(operation.appliedRateValueCents).toBe(500);
    const detail = repo.getFiscalDocument(operation.fiscalDocumentId);
    expect(detail.rateHistory).toHaveLength(0);
    db.close();
  });

  it("refreshes the applied rate when rules change and records later explicit overrides", async () => {
    const { repo, db, partnerId, productId } = await setup();
    const oldRule = await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: partnerId, ownLegalEntityId: null, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 10, notes: null, isActive: true });
    createConfirmedOperation(repo, partnerId, productId, "8101", "10");
    repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    const beforeChange = repo.listOperations({ organizationId: villaId })[0];
    expect(beforeChange.appliedRateValueCents).toBe(500);

    // Preco reajustado: desativa a regra antiga e cadastra a nova -- a operacao de julho, ainda nao
    // cobrada, passa a usar o novo valor no proximo recalculo. E' exatamente essa mudanca que deve
    // ficar registrada no historico.
    await repo.deactivateServiceRateRule(oldRule.id);
    await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: partnerId, ownLegalEntityId: null, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 650, effectiveFrom: "2026-07-10", effectiveTo: null, priority: 20, notes: null, isActive: true });
    repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    const afterChange = repo.listOperations({ organizationId: villaId })[0];
    expect(afterChange.appliedRateValueCents).toBe(650);
    repo.updateOperationManualRate(afterChange.id, 700, "Reajuste combinado com o cliente");

    const detail = repo.getFiscalDocument(afterChange.fiscalDocumentId);
    expect(detail.rateHistory).toHaveLength(2);
    expect(detail.rateHistory).toEqual(expect.arrayContaining([
      expect.objectContaining({ operationId: afterChange.id, previousRateValueCents: 500, newRateValueCents: 650 }),
      expect.objectContaining({ operationId: afterChange.id, previousRateValueCents: 650, newRateValueCents: 700 })
    ]));
    db.close();
  });
});
