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
    expect(getCurrentMigration(db)).toBe("002_seed_demo_data");
    expect(db.prepare("SELECT COUNT(*) AS total FROM organizations").get()).toMatchObject({ total: 2 });
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
