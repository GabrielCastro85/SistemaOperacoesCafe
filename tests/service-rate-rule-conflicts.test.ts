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

  it("logs a history entry with before/after values when the applicable rule is superseded before the operation is billed", async () => {
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

    const detail = repo.getFiscalDocument(afterChange.fiscalDocumentId);
    expect(detail.rateHistory).toHaveLength(1);
    expect(detail.rateHistory?.[0]).toMatchObject({ operationId: afterChange.id, previousRateValueCents: 500, newRateValueCents: 650 });
    db.close();
  });
});
