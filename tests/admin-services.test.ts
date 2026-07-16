import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { AppRepository } from "../electron/main/services/appRepository";
import { copyBrandingAssetFromPath } from "../electron/main/services/brandingAssets";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";

const tempDirs: string[] = [];
const villaId = "11111111-1111-4111-8111-111111111111";
const graoEntityId = "44444444-4444-4444-8444-444444444441";
const validCnpj = "11222333000181";

function setup(): { repo: AppRepository; db: ReturnType<typeof initializeDatabase>; userData: string; directories: ReturnType<typeof resolveAppDirectories> } {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-admin-"));
  tempDirs.push(userData);
  const directories = resolveAppDirectories(userData);
  ensureAppDirectories(directories);
  const db = initializeDatabase(directories);
  return { repo: new AppRepository(db), db, userData, directories };
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe("admin services", () => {
  it("blocks new organizations outside multiempresa and allows them in multiempresa", () => {
    const { repo, db } = setup();
    repo.saveInstallationProfile({
      installationName: "Villa",
      appVariant: "villa",
      defaultOrganizationId: villaId,
      defaultLegalEntityId: "33333333-3333-4333-8333-333333333331",
      allowOrganizationSwitch: false,
      allowLegalEntitySwitch: true,
      completedSetup: true
    });
    expect(() => repo.createOrganization(sampleOrganization("nova"))).toThrow(/nao permite/);
    repo.updateInstallationProfile({
      installationName: "Multi",
      appVariant: "multiempresa",
      defaultOrganizationId: villaId,
      defaultLegalEntityId: "33333333-3333-4333-8333-333333333331",
      allowOrganizationSwitch: true,
      allowLegalEntitySwitch: true,
      completedSetup: true,
      confirmVariantChange: true
    });
    expect(repo.createOrganization(sampleOrganization("nova")).slug).toBe("nova");
    expect(() => repo.createOrganization(sampleOrganization("nova"))).toThrow(/Slug/);
    db.close();
  });

  it("creates, edits, activates and deactivates LegalEntity with CNPJ validation", () => {
    const { repo, db } = setup();
    repo.saveInstallationProfile(baseProfile());
    expect(() => repo.createLegalEntity({ ...sampleLegalEntity(villaId), cnpj: "11111111111111" })).toThrow(/CNPJ invalido/);
    const created = repo.createLegalEntity(sampleLegalEntity(villaId));
    expect(created.cnpj).toBe(validCnpj);
    expect(() => repo.createLegalEntity({ ...sampleLegalEntity(villaId), tradeName: "Duplicado" })).toThrow(/CNPJ ja cadastrado/);
    const edited = repo.updateLegalEntity(created.id, { ...sampleLegalEntity(villaId), tradeName: "Villa Editada", isDraft: false });
    expect(edited.tradeName).toBe("Villa Editada");
    expect(repo.deactivateLegalEntity(created.id).isActive).toBe(false);
    expect(repo.activateLegalEntity(created.id).isActive).toBe(true);
    db.close();
  });

  it("prevents Location linked to a LegalEntity from another organization", () => {
    const { repo, db } = setup();
    repo.saveInstallationProfile({ ...baseProfile(), appVariant: "multiempresa", allowOrganizationSwitch: true });
    expect(() => repo.createLocation({ ...sampleLocation(villaId), legalEntityId: graoEntityId })).toThrow(/mesma organizacao/);
    const created = repo.createLocation(sampleLocation(villaId));
    expect(created.type).toBe("WAREHOUSE");
    expect(repo.listLocations({ type: "WAREHOUSE" }).some((item) => item.id === created.id)).toBe(true);
    expect(repo.deactivateLocation(created.id).isActive).toBe(false);
    db.close();
  });

  it("copies branding assets into userData and rejects invalid files", () => {
    const { directories, db } = setup();
    const logo = join(directories.userData, "logo.png");
    const text = join(directories.userData, "bad.txt");
    writeFileSync(logo, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    writeFileSync(text, "bad");
    const copied = copyBrandingAssetFromPath(directories, villaId, "logo", logo);
    expect(copied).toContain(join("settings", "branding", villaId, "logo.png"));
    expect(() => copyBrandingAssetFromPath(directories, villaId, "logo", text)).toThrow(/Formato/);
    db.close();
  });

  it("keeps active context consistent across repository reopen", () => {
    const { repo, db, directories } = setup();
    repo.saveInstallationProfile(baseProfile());
    repo.setActiveLegalEntity("33333333-3333-4333-8333-333333333332");
    db.close();
    const reopenedDb = initializeDatabase(directories);
    const reopened = new AppRepository(reopenedDb);
    expect(reopened.getActiveContext().legalEntityId).toBe("33333333-3333-4333-8333-333333333332");
    reopenedDb.close();
  });
});

function baseProfile() {
  return {
    installationName: "Villa",
    appVariant: "villa" as const,
    defaultOrganizationId: villaId,
    defaultLegalEntityId: "33333333-3333-4333-8333-333333333331",
    allowOrganizationSwitch: false,
    allowLegalEntitySwitch: true,
    completedSetup: true
  };
}

function sampleOrganization(slug: string) {
  return {
    name: "Nova Corretora",
    slug,
    displayName: "Nova Corretora",
    appDisplayName: "Nova Corretora Operacoes",
    logoPath: null,
    compactLogoPath: null,
    iconPath: null,
    primaryColor: "#123456",
    secondaryColor: "#F0F0F0",
    accentColor: "#654321",
    themeMode: "light" as const,
    isActive: true
  };
}

function sampleLegalEntity(organizationId: string) {
  return {
    organizationId,
    legalName: "Villa Coffee Teste Ltda",
    tradeName: "Villa Teste",
    cnpj: validCnpj,
    stateRegistration: "ISENTO",
    municipalRegistration: null,
    email: "teste@example.com",
    phone: "31999999999",
    addressLine: "Rua Teste",
    addressNumber: "10",
    addressComplement: null,
    district: "Centro",
    city: "Manhuacu",
    state: "MG",
    postalCode: "36900000",
    documentPrefix: "VC",
    isDraft: false,
    isActive: true
  };
}

function sampleLocation(organizationId: string) {
  return {
    organizationId,
    legalEntityId: "33333333-3333-4333-8333-333333333331",
    name: "Armazem de Teste",
    type: "WAREHOUSE",
    description: "Teste",
    addressLine: null,
    addressNumber: null,
    addressComplement: null,
    district: null,
    city: "Manhuacu",
    state: "MG",
    postalCode: "36900000",
    isActive: true
  };
}
