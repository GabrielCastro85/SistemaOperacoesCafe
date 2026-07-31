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
  const userData = mkdtempSync(join(tmpdir(), "operacoes-legacy-cleanup-"));
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

function runCleanupMigration(db: ReturnType<typeof initializeDatabase>): void {
  const migration = migrations.find((item) => item.name === "032_delete_legacy_import_client_shells");
  if (!migration) throw new Error("Migration 032_delete_legacy_import_client_shells nao encontrada.");
  migration.up(db);
}

describe("legacy import cleanup migration (032_delete_legacy_import_client_shells)", () => {
  it("apaga os clientes-descarte da importacao legada sem nenhum registro vinculado, desvinculando a empresa em vez de apaga-la", async () => {
    const { repo, db } = setup();
    const unused = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Empresa Sem Uso Ltda", notes: "Importado do sistema legado (MG, cadastro 42).", roles: ["CLIENT"], isActive: true });
    const entity = await repo.createPartnerLegalEntity({ organizationId: villaId, businessPartnerId: unused.id, legalName: "Empresa Sem Uso Ltda", tradeName: "Empresa Sem Uso", cnpj: "11222333000181", stateRegistration: null, municipalRegistration: null, email: null, phone: null, addressLine: null, addressNumber: null, addressComplement: null, district: null, city: null, state: null, postalCode: null, isPrimary: true, isActive: true, isDraft: false });

    runCleanupMigration(db);

    expect(db.prepare("SELECT COUNT(*) c FROM business_partners WHERE id = ?").get(unused.id)).toMatchObject({ c: 0 });
    expect(db.prepare("SELECT COUNT(*) c FROM business_partner_roles WHERE business_partner_id = ?").get(unused.id)).toMatchObject({ c: 0 });
    const remainingEntity = db.prepare("SELECT business_partner_id, is_primary FROM partner_legal_entities WHERE id = ?").get(entity.id) as { business_partner_id: string | null; is_primary: number };
    expect(remainingEntity.business_partner_id).toBeNull();
    expect(remainingEntity.is_primary).toBe(0);
    db.close();
  });

  it("preserva um cadastro da importacao legada que ja tem nota fiscal lancada", async () => {
    const { repo, db } = setup();
    const usedPartner = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Empresa Ja Usada Ltda", notes: "Importado do sistema legado (ES, cadastro 7).", roles: ["CLIENT"], isActive: true });
    const doc = repo.createFiscalDocument({ organizationId: villaId, ownLegalEntityId, responsiblePartnerId: usedPartner.id, partnerLegalEntityId: null, accessKey: null, documentNumber: "9001", series: "1", issueDate: "2026-07-16", totalAmountCents: 100000, hasPendingIssues: false, pendingNotes: null, notes: null });
    expect(doc.document.id).toBeTruthy();

    runCleanupMigration(db);

    expect(db.prepare("SELECT COUNT(*) c FROM business_partners WHERE id = ?").get(usedPartner.id)).toMatchObject({ c: 1 });
    db.close();
  });

  it("nao mexe em cadastros normais (sem a marca de importacao legada)", async () => {
    const { repo, db } = setup();
    const normalPartner = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Leo ES", notes: null, roles: ["SUPPLIER"], isActive: true });

    runCleanupMigration(db);

    expect(db.prepare("SELECT COUNT(*) c FROM business_partners WHERE id = ?").get(normalPartner.id)).toMatchObject({ c: 1 });
    db.close();
  });
});

describe("034_delete_legacy_import_client_shells_again (re-limpeza depois que a 032 ja rodou)", () => {
  it("apaga um fantasma que so' apareceu DEPOIS que a 032 ja tinha rodado nesse PC (ex: baixado do Supabase por sync)", async () => {
    // Reproduz o bug real: a 032 e' one-shot (ja marcada como executada), mas
    // o seed estatico legado (desativado na mesma versao que essa migration)
    // continuava recriando fantasmas e empurrando pro Supabase -- qualquer PC
    // que sincronizasse depois da 032 ja ter rodado baixava esses fantasmas de
    // volta e ficava com eles presos pra sempre, ja que sync nunca propaga
    // delete.
    const { repo, db } = setup();
    const migration032 = migrations.find((item) => item.name === "032_delete_legacy_import_client_shells");
    if (!migration032) throw new Error("Migration 032 nao encontrada.");
    migration032.up(db); // simula a 032 ja ter rodado antes, sem nada pra limpar ainda

    const lateGhost = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Fantasma Tardio Ltda", notes: "Importado do sistema legado (MG, cadastro 999).", roles: ["CLIENT"], isActive: true });

    const migration034 = migrations.find((item) => item.name === "034_delete_legacy_import_client_shells_again");
    if (!migration034) throw new Error("Migration 034 nao encontrada.");
    migration034.up(db);

    expect(db.prepare("SELECT COUNT(*) c FROM business_partners WHERE id = ?").get(lateGhost.id)).toMatchObject({ c: 0 });
    db.close();
  });
});
