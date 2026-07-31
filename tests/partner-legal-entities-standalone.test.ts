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
const cnpjA = "11222333000181";
const cnpjB = "11444777000161";

function setup(): { repo: AppRepository; db: ReturnType<typeof initializeDatabase> } {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-standalone-companies-"));
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
    allowOrganizationSwitch: true,
    allowLegalEntitySwitch: true,
    completedSetup: true
  });
  return { repo, db };
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

function sampleCompany(organizationId: string, cnpj: string, businessPartnerId: string | null = null) {
  return {
    organizationId,
    businessPartnerId,
    legalName: "Futura Comercio Atacadista Ltda",
    tradeName: "Futura Comercio Atacadista",
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
    isPrimary: false,
    isActive: true,
    isDraft: false
  };
}

describe("standalone empresas/CNPJs (sem cliente/corretor dono)", () => {
  it("cadastra uma empresa sem cliente/corretor dono, e depois vincula a um -- fluxo pedido pelo dono", async () => {
    const { repo, db } = setup();
    const company = await repo.createPartnerLegalEntity(sampleCompany(villaId, cnpjA));
    expect(company.businessPartnerId).toBeNull();
    expect(company.isPrimary).toBe(false);

    const unlinked = repo.listUnlinkedPartnerLegalEntities(villaId);
    expect(unlinked.map((item) => item.id)).toContain(company.id);

    const leo = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Leo ES", notes: null, roles: ["SUPPLIER"], isActive: true });
    const linked = await repo.linkPartnerLegalEntityToPartner(company.id, leo.id);
    expect(linked.businessPartnerId).toBe(leo.id);
    expect(linked.isPrimary).toBe(true);
    expect(repo.listUnlinkedPartnerLegalEntities(villaId).map((item) => item.id)).not.toContain(company.id);
    expect(repo.listPartnerLegalEntities(leo.id).map((item) => item.id)).toContain(company.id);
    db.close();
  });

  it("mantem a unicidade de CNPJ mesmo entre empresas soltas (sem dono)", async () => {
    const { repo, db } = setup();
    await repo.createPartnerLegalEntity(sampleCompany(villaId, cnpjA));
    await expect(repo.createPartnerLegalEntity(sampleCompany(villaId, cnpjA))).rejects.toThrow(/CNPJ ja cadastrado/);
    db.close();
  });

  it("desvincula uma empresa, devolvendo-a pro estado solto", async () => {
    const { repo, db } = setup();
    const partner = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Leo ES", notes: null, roles: ["SUPPLIER"], isActive: true });
    const company = await repo.createPartnerLegalEntity(sampleCompany(villaId, cnpjA, partner.id));
    expect(company.businessPartnerId).toBe(partner.id);

    const unlinked = await repo.unlinkPartnerLegalEntityFromPartner(company.id);
    expect(unlinked.businessPartnerId).toBeNull();
    expect(unlinked.isPrimary).toBe(false);
    expect(repo.listUnlinkedPartnerLegalEntities(villaId).map((item) => item.id)).toContain(company.id);
    db.close();
  });

  it("bloqueia vincular uma empresa a um cliente/corretor de outra organizacao", async () => {
    const { repo, db } = setup();
    const company = await repo.createPartnerLegalEntity(sampleCompany(villaId, cnpjA));
    const graoPartner = await repo.createBusinessPartner({ organizationId: graoId, displayName: "Fornecedor Grao", notes: null, roles: ["SUPPLIER"], isActive: true });
    await expect(repo.linkPartnerLegalEntityToPartner(company.id, graoPartner.id)).rejects.toThrow(/mesma organizacao/);
    db.close();
  });

  it("busca empresas soltas por nome ou CNPJ, ignorando as ja vinculadas", async () => {
    const { repo, db } = setup();
    const partner = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Vinculado", notes: null, roles: ["CLIENT"], isActive: true });
    const linkedCompany = await repo.createPartnerLegalEntity(sampleCompany(villaId, cnpjA, partner.id));
    const looseCompany = await repo.createPartnerLegalEntity(sampleCompany(villaId, cnpjB));

    const bySearchTerm = repo.listUnlinkedPartnerLegalEntities(villaId, "Futura");
    expect(bySearchTerm.map((item) => item.id)).toContain(looseCompany.id);
    expect(bySearchTerm.map((item) => item.id)).not.toContain(linkedCompany.id);

    const byCnpj = repo.listUnlinkedPartnerLegalEntities(villaId, cnpjB);
    expect(byCnpj.map((item) => item.id)).toEqual([looseCompany.id]);
    db.close();
  });

  it("rejeita marcar uma empresa como principal sem cliente/corretor dono", async () => {
    const { repo, db } = setup();
    await expect(repo.createPartnerLegalEntity({ ...sampleCompany(villaId, cnpjA), isPrimary: true })).rejects.toThrow();
    db.close();
  });
});
