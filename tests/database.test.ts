import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getCurrentMigration, initializeDatabase } from "../electron/main/database/database";
import { AppRepository } from "../electron/main/services/appRepository";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";

const tempDirs: string[] = [];

function makeTempUserData(): string {
  const dir = mkdtempSync(join(tmpdir(), "operacoes-cafe-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe("database foundation", () => {
  it("creates safe local directories outside the install folder", () => {
    const userData = makeTempUserData();
    const directories = resolveAppDirectories(userData);
    ensureAppDirectories(directories);
    expect(directories.databasePath).toContain(join(userData, "database"));
    expect(directories.documentsDir).toBe(join(userData, "documents"));
  });

  it("opens SQLite and runs migrations", () => {
    const directories = resolveAppDirectories(makeTempUserData());
    ensureAppDirectories(directories);
    const db = initializeDatabase(directories);
    expect(getCurrentMigration(db)).toBe("040_sync_tombstones");
    expect(db.prepare("SELECT COUNT(*) AS total FROM organizations").get()).toMatchObject({ total: 2 });
    expect(db.prepare("PRAGMA table_info(legal_entities)").all()).toEqual(expect.arrayContaining([expect.objectContaining({ name: "is_draft" })]));
    expect(db.prepare("SELECT COUNT(*) AS total FROM products").get()).toMatchObject({ total: 4 });
    expect(db.prepare("PRAGMA table_info(fiscal_documents)").all()).toEqual(expect.arrayContaining([expect.objectContaining({ name: "source" })]));
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'spreadsheet_import_jobs'").get()).toMatchObject({ name: "spreadsheet_import_jobs" });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'xml_import_jobs'").get()).toMatchObject({ name: "xml_import_jobs" });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'client_charges'").get()).toMatchObject({ name: "client_charges" });
    expect(db.prepare("PRAGMA table_info(client_charge_operations)").all()).toEqual(expect.arrayContaining([expect.objectContaining({ name: "own_legal_entity_name_snapshot" })]));
    expect(db.prepare("PRAGMA table_info(business_partners)").all()).toEqual(expect.arrayContaining([expect.objectContaining({ name: "document_number" }), expect.objectContaining({ name: "mobile" })]));
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'accounts_payable'").get()).toMatchObject({ name: "accounts_payable" });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'financial_report_generations'").get()).toMatchObject({ name: "financial_report_generations" });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'deal_confirmations'").get()).toMatchObject({ name: "deal_confirmations" });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'deal_confirmation_document_versions'").get()).toMatchObject({ name: "deal_confirmation_document_versions" });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_users'").get()).toMatchObject({ name: "app_users" });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'audit_events'").get()).toMatchObject({ name: "audit_events" });
    expect(db.prepare("SELECT COUNT(*) AS total FROM permissions").get()).toMatchObject({ total: 29 });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'backup_jobs'").get()).toMatchObject({ name: "backup_jobs" });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'restore_jobs'").get()).toMatchObject({ name: "restore_jobs" });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'integrity_check_runs'").get()).toMatchObject({ name: "integrity_check_runs" });
    expect(db.prepare("SELECT COUNT(*) AS total FROM permissions WHERE code LIKE 'backups.%' OR code LIKE 'integrity.%' OR code IN ('retention.manage','temporary_files.cleanup')").get()).toMatchObject({ total: 12 });
    expect(db.prepare("SELECT COUNT(*) AS total FROM legal_entities WHERE cnpj IN ('44963370000523','44963370000280','16594876000224','16594876000496') AND is_active = 1").get()).toMatchObject({ total: 4 });
    expect(db.prepare("SELECT city, state, state_registration, default_bank_name, default_bank_code, default_bank_agency, default_bank_account, default_pix_key FROM legal_entities WHERE cnpj = '44963370000523'").get()).toMatchObject({ city: "MONTE SANTO DE MINAS", state: "MG", state_registration: "0053761240090", default_bank_name: "Santander", default_bank_code: "033", default_bank_agency: "3318", default_bank_account: "13.0021347", default_pix_key: "44.963.370/0005-23" });
    expect(db.prepare("SELECT state_registration, default_pix_key FROM legal_entities WHERE cnpj = '16594876000224'").get()).toMatchObject({ state_registration: "46505230009", default_pix_key: "16.594.876/0002-24" });
    expect(db.prepare("SELECT city, state FROM legal_entities WHERE cnpj = '16594876000496'").get()).toMatchObject({ city: "SANTO ANTONIO DO JARDIM", state: "SP" });
    db.close();
  });

  it("creates and reads InstallationProfile", () => {
    const directories = resolveAppDirectories(makeTempUserData());
    ensureAppDirectories(directories);
    const db = initializeDatabase(directories);
    const repo = new AppRepository(db);
    const profile = repo.saveInstallationProfile({
      installationName: "Teste",
      appVariant: "multiempresa",
      defaultOrganizationId: "11111111-1111-4111-8111-111111111111",
      defaultLegalEntityId: "33333333-3333-4333-8333-333333333331",
      allowOrganizationSwitch: true,
      allowLegalEntitySwitch: true,
      completedSetup: true
    });
    expect(repo.getInstallationProfile()?.id).toBe(profile.id);
    db.close();
  });
});
