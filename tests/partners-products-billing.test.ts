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
const cnpjA = "11222333000181";
const cnpjB = "11444777000161";

function setup(): { repo: AppRepository; db: ReturnType<typeof initializeDatabase> } {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-step3-"));
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
  return { repo, db };
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe("partners, products and billing", () => {
  it("creates partner with multiple roles and blocks duplicate/empty roles", () => {
    const { repo, db } = setup();
    const partner = repo.createBusinessPartner({ organizationId: villaId, displayName: "Fazenda Boa Vista", notes: null, roles: ["CLIENT", "BUYER"], isActive: true });
    expect(partner.roles).toEqual(["BUYER", "CLIENT"]);
    expect(() => repo.addBusinessPartnerRole(partner.id, "CLIENT")).toThrow(/Papel/);
    expect(() => repo.updateBusinessPartner(partner.id, { organizationId: villaId, displayName: "Sem papel", notes: null, roles: [], isActive: true })).toThrow();
    expect(repo.deactivateBusinessPartner(partner.id).isActive).toBe(false);
    expect(repo.activateBusinessPartner(partner.id).isActive).toBe(true);
    db.close();
  });

  it("handles partner legal entities and primary constraints", () => {
    const { repo, db } = setup();
    const partner = repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente ABC", notes: null, roles: ["CLIENT"], isActive: true });
    expect(() => repo.createPartnerLegalEntity(samplePartnerEntity(partner.id, "11111111111111", true))).toThrow(/CNPJ invalido/);
    const first = repo.createPartnerLegalEntity(samplePartnerEntity(partner.id, cnpjA, true));
    expect(first.cnpj).toBe(cnpjA);
    expect(() => repo.createPartnerLegalEntity(samplePartnerEntity(partner.id, cnpjA, false))).toThrow(/Cliente ABC/);
    const second = repo.createPartnerLegalEntity(samplePartnerEntity(partner.id, cnpjB, true));
    expect(repo.listPartnerLegalEntities(partner.id).filter((item) => item.isPrimary)).toHaveLength(1);
    expect(second.isPrimary).toBe(true);
    db.close();
  });

  it("updates existing partner and legal entity registration data", () => {
    const { repo, db } = setup();
    const partner = repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Antigo", notes: null, roles: ["CLIENT"], isActive: true });
    const legalEntity = repo.createPartnerLegalEntity(samplePartnerEntity(partner.id, cnpjA, true));

    const updatedPartner = repo.updateBusinessPartner(partner.id, { organizationId: villaId, displayName: "Cliente Atualizado", notes: "Cadastro revisado", roles: ["CLIENT", "BUYER"], isActive: true });
    const updatedEntity = repo.updatePartnerLegalEntity(legalEntity.id, { ...samplePartnerEntity(partner.id, cnpjA, true), legalName: "Cliente Atualizado Ltda", tradeName: "Cliente Atualizado", email: "novo@example.com" });

    expect(updatedPartner.displayName).toBe("Cliente Atualizado");
    expect(updatedPartner.roles).toEqual(["BUYER", "CLIENT"]);
    expect(updatedEntity.legalName).toBe("Cliente Atualizado Ltda");
    expect(updatedEntity.email).toBe("novo@example.com");
    db.close();
  });

  it("creates contacts and products with validation", () => {
    const { repo, db } = setup();
    const partner = repo.createBusinessPartner({ organizationId: villaId, displayName: "Contato Cliente", notes: null, roles: ["CLIENT"], isActive: true });
    const contact = repo.createPartnerContact({ businessPartnerId: partner.id, partnerLegalEntityId: null, name: "Maria", department: null, email: "maria@example.com", phone: "31999999999", mobile: null, preferredContactMethod: "EMAIL", isPrimary: true, notes: null, isActive: true });
    expect(contact.isPrimary).toBe(true);
    const product = repo.createProduct({ organizationId: villaId, name: "Cafe Especial", code: "ESP", category: "COFFEE_ARABICA", defaultUnit: "SACK", defaultSackWeightKg: 60.5, description: null, isActive: true });
    expect(product.defaultSackWeightKg).toBe(60.5);
    expect(() => repo.createProduct({ organizationId: villaId, name: "Duplicado", code: "ESP", category: "OTHER", defaultUnit: "UNIT", defaultSackWeightKg: null, description: null, isActive: true })).toThrow(/Codigo/);
    db.close();
  });

  it("permanently deletes partner registration data instead of deactivating it", () => {
    const { repo, db } = setup();
    const partner = repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Removivel", notes: null, roles: ["CLIENT"], isActive: true });
    const legalEntity = repo.createPartnerLegalEntity(samplePartnerEntity(partner.id, cnpjA, true));
    repo.createPartnerContact({ businessPartnerId: partner.id, partnerLegalEntityId: legalEntity.id, name: "Maria", department: null, email: "maria@example.com", phone: "31999999999", mobile: null, preferredContactMethod: "EMAIL", isPrimary: true, notes: null, isActive: true });
    repo.upsertBillingProfile({ organizationId: villaId, businessPartnerId: partner.id, ownLegalEntityId, periodicity: "MONTHLY", closingWeekday: null, closingDayOfMonth: 30, dueDaysAfterClosing: 5, autoIncludeUnbilledOperations: true, notes: null, isActive: true });
    repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: partner.id, ownLegalEntityId, productId: null, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 1, notes: null, isActive: true });

    repo.deleteBusinessPartner(partner.id);

    expect(() => repo.getBusinessPartner(partner.id)).toThrow(/Parceiro nao encontrado/);
    expect(db.prepare("SELECT COUNT(*) AS count FROM partner_legal_entities WHERE business_partner_id = ?").get(partner.id)).toMatchObject({ count: 0 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM partner_contacts WHERE business_partner_id = ?").get(partner.id)).toMatchObject({ count: 0 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM client_billing_profiles WHERE business_partner_id = ?").get(partner.id)).toMatchObject({ count: 0 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM service_rate_rules WHERE business_partner_id = ?").get(partner.id)).toMatchObject({ count: 0 });
    db.close();
  });

  it("creates billing profile and resolves most specific rate rule", () => {
    const { repo, db } = setup();
    const partner = repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Rate", notes: null, roles: ["CLIENT"], isActive: true });
    const product = repo.listProducts({ organizationId: villaId })[0];
    expect(repo.upsertBillingProfile({ organizationId: villaId, businessPartnerId: partner.id, ownLegalEntityId, periodicity: "MONTHLY", closingWeekday: null, closingDayOfMonth: 30, dueDaysAfterClosing: 5, autoIncludeUnbilledOperations: true, notes: null, isActive: true }).periodicity).toBe("MONTHLY");
    repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: partner.id, ownLegalEntityId: null, productId: null, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 1, notes: null, isActive: true });
    const specificRule = repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: partner.id, ownLegalEntityId, productId: product.id, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 850, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 10, notes: null, isActive: true });
    const editedRule = repo.updateServiceRateRule(specificRule.id, { organizationId: villaId, businessPartnerId: partner.id, ownLegalEntityId, productId: product.id, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 875, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 10, notes: "Valor revisado", isActive: true });
    expect(editedRule.rateValueCents).toBe(875);
    const resolved = repo.resolveServiceRateRule({ organizationId: villaId, businessPartnerId: partner.id, ownLegalEntityId, productId: product.id, operationScope: "EXTERNAL", operationDate: "2026-07-16" });
    expect(resolved.status).toBe("found");
    expect(resolved.rateValueCents).toBe(875);
    expect(() => repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: partner.id, ownLegalEntityId, productId: product.id, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 900, effectiveFrom: "2026-07-10", effectiveTo: null, priority: 10, notes: null, isActive: true })).toThrow(/conflitante/);
    repo.deleteServiceRateRule(specificRule.id);
    expect(() => repo.getServiceRateRule(specificRule.id)).toThrow(/Regra nao encontrada/);
    db.close();
  });

  it("returns missing when no rate applies and blocks billing for non-client", () => {
    const { repo, db } = setup();
    const partner = repo.createBusinessPartner({ organizationId: villaId, displayName: "Fornecedor", notes: null, roles: ["SUPPLIER"], isActive: true });
    expect(() => repo.upsertBillingProfile({ organizationId: villaId, businessPartnerId: partner.id, ownLegalEntityId: null, periodicity: "MONTHLY", closingWeekday: null, closingDayOfMonth: 1, dueDaysAfterClosing: 0, autoIncludeUnbilledOperations: false, notes: null, isActive: true })).toThrow(/Cliente/);
    const client = repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Sem Regra", notes: null, roles: ["CLIENT"], isActive: true });
    expect(repo.resolveServiceRateRule({ organizationId: villaId, businessPartnerId: client.id, ownLegalEntityId: null, productId: null, operationScope: "INTERNAL", operationDate: "2026-07-16" }).status).toBe("missing");
    db.close();
  });
});

function samplePartnerEntity(businessPartnerId: string, cnpj: string, isPrimary: boolean) {
  return {
    businessPartnerId,
    legalName: "Cliente ABC Ltda",
    tradeName: "Cliente ABC",
    cnpj,
    stateRegistration: null,
    municipalRegistration: null,
    email: null,
    phone: null,
    addressLine: null,
    addressNumber: null,
    addressComplement: null,
    district: null,
    city: null,
    state: null,
    postalCode: null,
    isPrimary,
    isActive: true,
    isDraft: false
  };
}
