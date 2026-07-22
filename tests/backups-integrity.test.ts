import type Database from "better-sqlite3";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { BackupService } from "../electron/main/services/backupService";
import { AuthService } from "../electron/main/services/security";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";
import type { AppContext } from "../electron/main/services/context";

const tempDirs: string[] = [];
const databases: Database.Database[] = [];

async function createServices(): Promise<{ context: AppContext; auth: AuthService; backups: BackupService; externalDir: string }> {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-cafe-backups-"));
  const externalDir = mkdtempSync(join(tmpdir(), "operacoes-cafe-backups-ext-"));
  tempDirs.push(userData, externalDir);
  const directories = resolveAppDirectories(userData);
  ensureAppDirectories(directories);
  mkdirSync(join(directories.documentsDir, "charges"), { recursive: true });
  writeFileSync(join(directories.documentsDir, "charges", "charge.pdf"), "documento emitido");
  writeFileSync(join(directories.settingsDir, "branding.txt"), "marca");
  const db = initializeDatabase(directories);
  databases.push(db);
  const context = { version: "0.1.0", directories, db };
  const auth = new AuthService(db);
  await auth.bootstrapAdministrator({ displayName: "Admin", username: "admin", password: "Senha@12345" });
  return { context, auth, backups: new BackupService(context, auth), externalDir };
}

afterEach(() => {
  databases.splice(0).forEach((db) => db.open ? db.close() : undefined);
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe("backups, restore preparation and integrity", () => {
  it("creates a full backup with a consistent SQLite snapshot and manifest", async () => {
    const { backups } = await createServices();
    const job = await backups.create({ backupType: "FULL", destinationType: "INTERNAL", encrypted: false });
    expect(job.status).toBe("COMPLETED");
    expect(job.fileName).toMatch(/\.cafebackup$/);
    expect(job.databaseHash).toMatch(/^[a-f0-9]{64}$/);
    expect(job.documentCount).toBeGreaterThan(0);
    const inspection = backups.verify({ path: job.storedFilePath });
    expect(inspection.valid).toBe(true);
    expect(inspection.manifest?.databaseMigrationVersion).toBe("018_legal_entity_confirmation_defaults");
    expect(inspection.manifest?.totalFileCount).toBe(job.fileCount);
  });

  it("creates a database-only backup in an external destination without overwriting", async () => {
    const { backups, externalDir } = await createServices();
    const first = await backups.create({ backupType: "DATABASE_ONLY", destinationType: "EXTERNAL", destinationPath: externalDir, encrypted: false });
    const second = await backups.create({ backupType: "DATABASE_ONLY", destinationType: "EXTERNAL", destinationPath: externalDir, encrypted: false });
    expect(first.fileName).not.toBe(second.fileName);
    expect(existsSync(first.storedFilePath ?? "")).toBe(true);
    expect(backups.verify({ path: second.storedFilePath }).manifest?.documentCount).toBe(0);
  });

  it("encrypts packages with AES-GCM and rejects a wrong password", async () => {
    const { backups } = await createServices();
    const job = await backups.create({ backupType: "FULL", destinationType: "INTERNAL", encrypted: true, password: "Backup@12345" });
    const invalid = backups.verify({ path: job.storedFilePath, password: "errada" });
    expect(invalid.valid).toBe(false);
    const valid = backups.verify({ path: job.storedFilePath, password: "Backup@12345" });
    expect(valid.valid).toBe(true);
    expect(valid.manifest?.encryption.algorithm).toBe("AES-256-GCM-SCRYPT");
  });

  it("runs database/document integrity and finds orphan files", async () => {
    const { context, backups } = await createServices();
    writeFileSync(join(context.directories.documentsDir, "tmp.preview"), "temporario");
    expect(backups.runQuickDatabaseCheck().run.status).toBe("OK");
    expect(backups.checkDocumentFiles().run.status).toMatch(/OK|WARNING/);
    const orphans = backups.findOrphans();
    expect(orphans.findings.some((finding) => finding.findingType === "TEMPORARY_FILE")).toBe(true);
    expect(backups.generateIntegrityReport().reportPath).toContain("integrity");
  });

  it("applies retention without deleting protected backups", async () => {
    const { backups } = await createServices();
    backups.updateSettings({ frequency: "DISABLED", automaticBackupEnabled: false, retentionMaxCount: 1 });
    const protectedJob = await backups.create({ backupType: "DATABASE_ONLY", destinationType: "INTERNAL", encrypted: false, protect: true });
    await backups.create({ backupType: "DATABASE_ONLY", destinationType: "INTERNAL", encrypted: false });
    await backups.create({ backupType: "DATABASE_ONLY", destinationType: "INTERNAL", encrypted: false });
    backups.applyRetention();
    expect(backups.get(protectedJob.id).status).toBe("COMPLETED");
    expect(backups.get(protectedJob.id).isProtected).toBe(true);
  });
});
