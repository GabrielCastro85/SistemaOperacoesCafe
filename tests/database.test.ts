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
    expect(getCurrentMigration(db)).toBe("011_deal_confirmations");
    expect(db.prepare("SELECT COUNT(*) AS total FROM organizations").get()).toMatchObject({ total: 2 });
    expect(db.prepare("PRAGMA table_info(legal_entities)").all()).toEqual(expect.arrayContaining([expect.objectContaining({ name: "is_draft" })]));
    expect(db.prepare("SELECT COUNT(*) AS total FROM products").get()).toMatchObject({ total: 4 });
    expect(db.prepare("PRAGMA table_info(fiscal_documents)").all()).toEqual(expect.arrayContaining([expect.objectContaining({ name: "source" })]));
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'spreadsheet_import_jobs'").get()).toMatchObject({ name: "spreadsheet_import_jobs" });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'xml_import_jobs'").get()).toMatchObject({ name: "xml_import_jobs" });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'client_charges'").get()).toMatchObject({ name: "client_charges" });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'accounts_payable'").get()).toMatchObject({ name: "accounts_payable" });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'financial_report_generations'").get()).toMatchObject({ name: "financial_report_generations" });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'deal_confirmations'").get()).toMatchObject({ name: "deal_confirmations" });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'deal_confirmation_document_versions'").get()).toMatchObject({ name: "deal_confirmation_document_versions" });
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
