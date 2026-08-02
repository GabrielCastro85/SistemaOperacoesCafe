import type Database from "better-sqlite3";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, scrypt as nodeScrypt, scryptSync } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { getCurrentMigration, openDatabase, runMigrations } from "../database/database.js";
import type { AppContext } from "./context.js";
import type { AuthService } from "./security.js";
import type {
  AppVariant,
  BackupDestinationType,
  BackupInspection,
  BackupJob,
  BackupManifest,
  BackupManifestFile,
  BackupSettings,
  BackupTriggerType,
  BackupType,
  IntegrityCheckRun,
  IntegrityFinding,
  RestoreJob
} from "../../../src/shared/types/domain.js";

const BACKUP_MAGIC = "OPERACOES_CAFE_BACKUP\n";
const FORMAT_VERSION = 1;
const MAX_EXTRACTED_FILES = 50_000;
const MAX_EXTRACTED_SIZE = 2 * 1024 * 1024 * 1024;

type DbRecord = Record<string, unknown>;
type PackageFile = BackupManifestFile & { contentBase64: string };
type BackupPayload = { manifest: BackupManifest; files: PackageFile[] };
type BackupEnvelope =
  | { formatVersion: number; encrypted: false; compression: "GZIP"; payloadBase64: string }
  | { formatVersion: number; encrypted: true; compression: "GZIP"; encryption: "AES-256-GCM-SCRYPT"; saltBase64: string; ivBase64: string; authTagBase64: string; payloadBase64: string };

export class BackupService {
  constructor(
    private readonly context: AppContext,
    private readonly auth: AuthService
  ) {}

  list(): BackupJob[] {
    this.auth.requireSession("backups.view");
    return (this.context.db.prepare("SELECT * FROM backup_jobs ORDER BY started_at DESC").all() as DbRecord[]).map(mapBackupJob);
  }

  get(id: string): BackupJob {
    this.auth.requireSession("backups.view");
    return this.getJob(id);
  }

  estimate(type: BackupType = "FULL"): { estimatedFiles: number; estimatedBytes: number; documentCount: number } {
    this.auth.requireSession("backups.create");
    const files = this.collectFilesForBackup(type, null);
    return {
      estimatedFiles: files.length,
      estimatedBytes: files.reduce((sum, file) => sum + file.size, 0),
      documentCount: files.filter((file) => file.category !== "database").length
    };
  }

  async create(input: unknown): Promise<BackupJob> {
    const session = this.auth.requireSession("backups.create");
    const data = parseObject(input);
    const backupType = readEnum<BackupType>(data, "backupType", ["FULL", "DATABASE_ONLY", "DOCUMENTS_ONLY"], "FULL");
    const triggerType = readEnum<BackupTriggerType>(data, "triggerType", ["MANUAL", "AUTOMATIC", "PRE_MIGRATION", "PRE_RESTORE", "RECOVERY"], "MANUAL");
    const destinationType = readEnum<BackupDestinationType>(data, "destinationType", ["INTERNAL", "EXTERNAL"], "INTERNAL");
    const destinationPath = destinationType === "EXTERNAL" ? readString(data, "destinationPath") : this.context.directories.backupsDir;
    const encrypted = Boolean(data.encrypted);
    const password = encrypted ? readString(data, "password") : null;
    const protect = Boolean(data.protect) || triggerType === "PRE_RESTORE" || triggerType === "PRE_MIGRATION";
    const now = new Date().toISOString();
    mkdirSync(destinationPath, { recursive: true });
    assertWritableDirectory(destinationPath);
    const fileName = uniqueFileName(destinationPath, safeBackupFileName(this.installationLabel(), backupType, triggerType, now));
    const id = randomUUID();
    const startedAt = new Date().toISOString();
    this.context.db.prepare(`INSERT INTO backup_jobs (id, backup_type, trigger_type, status, destination_type, destination_display_name, stored_file_path, file_name, format_version, encrypted, application_version, application_variant, started_at, created_by_user_id, is_protected, protection_reason, created_at, updated_at)
      VALUES (?, ?, ?, 'RUNNING', ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, backupType, triggerType, destinationType, destinationType === "INTERNAL" ? "Backup interno" : basename(destinationPath), fileName, FORMAT_VERSION, encrypted ? 1 : 0, this.context.version, this.activeVariant(), startedAt, session.user.id, protect ? 1 : 0, protect ? triggerType : null, startedAt, startedAt);
    this.auth.writeAudit({ actorUserId: session.user.id, sessionId: session.id, action: "backup.started", entityType: "backup_job", entityId: id, result: "SUCCESS", severity: "INFO", metadata: { backupType, triggerType, destinationType, encrypted } });

    const tempDir = join(this.context.directories.backupsDir, "tmp", id);
    mkdirSync(tempDir, { recursive: true });
    try {
      const payload = await this.buildPayload(id, backupType, encrypted, session.user);
      const packageBuffer = await encodePackage(payload, password);
      const tempFile = join(tempDir, `${fileName}.tmp`);
      const finalPath = join(destinationPath, fileName);
      writeFileSync(tempFile, packageBuffer);
      const inspection = await this.inspectPackage(tempFile, password);
      if (!inspection.valid) throw new Error(`Pacote invalido: ${inspection.errors.join("; ")}`);
      renameSync(tempFile, finalPath);
      const fileHash = sha256File(finalPath);
      const completedAt = new Date().toISOString();
      this.context.db.prepare(`UPDATE backup_jobs SET status = 'COMPLETED', stored_file_path = ?, file_size = ?, file_hash = ?, database_hash = ?, migration_version = ?, source_installation_id = ?, file_count = ?, document_count = ?, completed_at = ?, verified_at = ?, verification_status = 'VALID', updated_at = ? WHERE id = ?`)
        .run(finalPath, statSync(finalPath).size, fileHash, payload.manifest.databaseHash, payload.manifest.databaseMigrationVersion, payload.manifest.sourceInstallationId, payload.manifest.totalFileCount, payload.manifest.documentCount, completedAt, completedAt, completedAt, id);
      this.persistFileEntries(id, payload.files);
      this.auth.writeAudit({ actorUserId: session.user.id, sessionId: session.id, action: "backup.completed", entityType: "backup_job", entityId: id, result: "SUCCESS", severity: "INFO", metadata: { fileName, fileSize: statSync(finalPath).size, fileHash } });
      if (triggerType !== "PRE_RESTORE") this.applyRetention();
      return this.getJob(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao criar backup.";
      const failedAt = new Date().toISOString();
      this.context.db.prepare("UPDATE backup_jobs SET status = 'FAILED', error_code = 'BACKUP_FAILED', error_message = ?, completed_at = ?, updated_at = ? WHERE id = ?").run(message, failedAt, failedAt, id);
      this.auth.writeAudit({ actorUserId: session.user.id, sessionId: session.id, action: "backup.failed", entityType: "backup_job", entityId: id, result: "FAILED", severity: "WARNING", reason: "BACKUP_FAILED", metadata: { message } });
      throw error;
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }

  verify(input: unknown): BackupInspection {
    this.auth.requireSession("backups.verify");
    const data = parseObject(input);
    return this.inspectSync(readString(data, "path"), optionalString(data, "password"));
  }

  protect(id: string, reason: string | null): BackupJob {
    const session = this.auth.requireSession("backups.protect");
    this.context.db.prepare("UPDATE backup_jobs SET is_protected = 1, protection_reason = ?, updated_at = ? WHERE id = ?").run(reason, new Date().toISOString(), id);
    this.auth.writeAudit({ actorUserId: session.user.id, sessionId: session.id, action: "backup.protected", entityType: "backup_job", entityId: id, result: "SUCCESS", severity: "INFO" });
    return this.getJob(id);
  }

  unprotect(id: string): BackupJob {
    const session = this.auth.requireSession("backups.protect");
    this.context.db.prepare("UPDATE backup_jobs SET is_protected = 0, protection_reason = NULL, updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    this.auth.writeAudit({ actorUserId: session.user.id, sessionId: session.id, action: "backup.unprotected", entityType: "backup_job", entityId: id, result: "SUCCESS", severity: "INFO" });
    return this.getJob(id);
  }

  delete(id: string): BackupJob {
    const session = this.auth.requireSession("backups.delete");
    const job = this.getJob(id);
    if (job.isProtected) throw new Error("Backup protegido nao pode ser apagado.");
    if (job.storedFilePath && existsSync(job.storedFilePath)) rmSync(job.storedFilePath, { force: true });
    this.context.db.prepare("UPDATE backup_jobs SET status = 'DELETED', stored_file_path = NULL, updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    this.auth.writeAudit({ actorUserId: session.user.id, sessionId: session.id, action: "backup.deleted", entityType: "backup_job", entityId: id, result: "SUCCESS", severity: "WARNING" });
    return this.getJob(id);
  }

  getSettings(): BackupSettings {
    this.auth.requireSession("backups.view");
    return this.readSettings();
  }

  updateSettings(input: unknown): BackupSettings {
    const session = this.auth.requireSession("backups.configure");
    const data = parseObject(input);
    const current = this.readSettings();
    const frequency = readEnum(data, "frequency", ["DISABLED", "DAILY", "WEEKLY", "MONTHLY"], current.frequency);
    const enabled = Boolean(data.automaticBackupEnabled) && frequency !== "DISABLED";
    const now = new Date().toISOString();
    this.context.db.prepare(`UPDATE backup_settings SET automatic_backup_enabled = ?, frequency = ?, preferred_hour = ?, backup_type = ?, destination_type = ?, destination_path_stored_securely = ?, encrypted = ?, retention_max_count = ?, retention_max_days = ?, next_backup_at = ?, run_once_per_period = ?, updated_at = ? WHERE id = ?`)
      .run(
        enabled ? 1 : 0,
        frequency,
        numberOrNull(data.preferredHour) ?? current.preferredHour,
        readEnum<BackupType>(data, "backupType", ["FULL", "DATABASE_ONLY", "DOCUMENTS_ONLY"], current.backupType),
        readEnum<BackupDestinationType>(data, "destinationType", ["INTERNAL", "EXTERNAL"], current.destinationType),
        optionalString(data, "destinationPathStoredSecurely") ?? current.destinationPathStoredSecurely,
        data.encrypted ? 1 : 0,
        numberOrNull(data.retentionMaxCount) ?? current.retentionMaxCount,
        numberOrNull(data.retentionMaxDays),
        calculateNextRun(frequency, numberOrNull(data.preferredHour) ?? current.preferredHour),
        data.runOncePerPeriod === false ? 0 : 1,
        now,
        current.id
      );
    this.auth.writeAudit({ actorUserId: session.user.id, sessionId: session.id, action: "backup.settings_updated", result: "SUCCESS", severity: "WARNING", metadata: { frequency, enabled } });
    return this.readSettings();
  }

  async runPendingAutomaticBackup(): Promise<BackupJob | null> {
    const settings = this.readSettings();
    if (!settings.automaticBackupEnabled || !settings.nextBackupAt || new Date(settings.nextBackupAt) > new Date()) return null;
    if (settings.encrypted) return null;
    const destinationPath = settings.destinationType === "EXTERNAL" && settings.destinationPathStoredSecurely ? settings.destinationPathStoredSecurely : this.context.directories.backupsDir;
    const job = await this.create({ backupType: settings.backupType, triggerType: "AUTOMATIC", destinationType: settings.destinationType, destinationPath, encrypted: false });
    const now = new Date().toISOString();
    this.context.db.prepare("UPDATE backup_settings SET last_backup_at = ?, next_backup_at = ?, updated_at = ? WHERE id = ?")
      .run(now, calculateNextRun(settings.frequency, settings.preferredHour), now, settings.id);
    return job;
  }

  applyRetention(): BackupJob[] {
    const session = this.auth.requireSession("retention.manage");
    const settings = this.readSettings();
    const rows = this.list().filter((job) => job.status === "COMPLETED" && !job.isProtected);
    const sorted = rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const deleteAfterCount = sorted.slice(settings.retentionMaxCount);
    const maxAgeCutoff = settings.retentionMaxDays ? Date.now() - settings.retentionMaxDays * 24 * 60 * 60 * 1000 : null;
    const deleteByAge = maxAgeCutoff ? sorted.filter((job) => new Date(job.startedAt).getTime() < maxAgeCutoff) : [];
    const ids = [...new Set([...deleteAfterCount, ...deleteByAge].map((job) => job.id))];
    const deleted = ids.map((id) => this.delete(id));
    if (deleted.length > 0) this.auth.writeAudit({ actorUserId: session.user.id, sessionId: session.id, action: "backup.retention_applied", result: "SUCCESS", severity: "INFO", metadata: { deleted: deleted.length } });
    return deleted;
  }

  inspectRestoreFile(path: string, password?: string | null): BackupInspection {
    this.auth.requireSession("backups.restore");
    return this.inspectSync(path, password);
  }

  async executeRestore(input: unknown): Promise<RestoreJob> {
    const session = this.auth.requireSession("backups.restore");
    const data = parseObject(input);
    const sourcePath = readString(data, "path");
    const password = optionalString(data, "password");
    const currentPassword = readString(data, "currentUserPassword");
    await this.auth.unlock(currentPassword);
    const inspection = this.inspectSync(sourcePath, password);
    if (!inspection.valid || !inspection.manifest) throw new Error(`Backup invalido: ${inspection.errors.join("; ")}`);
    this.validateRestoreCompatibility(inspection.manifest);
    const restoreId = randomUUID();
    const startedAt = new Date().toISOString();
    this.context.db.prepare(`INSERT INTO restore_jobs (id, backup_job_id, source_file_name, source_file_hash, source_application_version, source_migration_version, source_variant, status, pre_restore_backup_job_id, started_at, executed_by_user_id, rollback_performed, created_at, updated_at)
      VALUES (?, NULL, ?, ?, ?, ?, ?, 'RESTORING', NULL, ?, ?, 0, ?, ?)`)
      .run(restoreId, basename(sourcePath), sha256File(sourcePath), inspection.manifest.applicationVersion, inspection.manifest.databaseMigrationVersion, inspection.manifest.applicationVariant, startedAt, session.user.id, startedAt, startedAt);
    const preRestore = await this.create({ backupType: "FULL", triggerType: "PRE_RESTORE", destinationType: "INTERNAL", encrypted: false, protect: true });
    this.context.db.prepare("UPDATE restore_jobs SET pre_restore_backup_job_id = ?, updated_at = ? WHERE id = ?").run(preRestore.id, new Date().toISOString(), restoreId);
    try {
      const payload = decodePackage(readFileSync(sourcePath), password);
      const tempDir = join(this.context.directories.backupsDir, "restore", restoreId);
      rmSync(tempDir, { recursive: true, force: true });
      mkdirSync(tempDir, { recursive: true });
      materializePayload(payload, tempDir);
      const restoredDbPath = join(tempDir, "database", "application.sqlite");
      const restoredDb = openDatabase(restoredDbPath);
      runMigrations(restoredDb);
      const quick = restoredDb.prepare("PRAGMA quick_check").get() as { quick_check: string };
      restoredDb.close();
      if (quick.quick_check !== "ok") throw new Error("Banco restaurado falhou no quick_check.");
      const rollbackDir = join(this.context.directories.backupsDir, "rollback", restoreId);
      mkdirSync(rollbackDir, { recursive: true });
      copyFileSync(this.context.directories.databasePath, join(rollbackDir, "operations.sqlite"));
      copyDirectory(this.context.directories.documentsDir, join(rollbackDir, "documents"));
      copyDirectory(this.context.directories.settingsDir, join(rollbackDir, "settings"));
      await this.replaceCurrentState(tempDir);
      const completedAt = new Date().toISOString();
      this.context.db.prepare("UPDATE local_sessions SET status = 'EXPIRED', logout_at = ?, last_activity_at = ?").run(completedAt, completedAt);
      this.context.db.prepare("UPDATE restore_jobs SET status = 'COMPLETED', completed_at = ?, updated_at = ? WHERE id = ?").run(completedAt, completedAt, restoreId);
      this.auth.writeAudit({ actorUserId: session.user.id, sessionId: session.id, action: "restore.completed", entityType: "restore_job", entityId: restoreId, result: "SUCCESS", severity: "CRITICAL", metadata: { sourceFileName: basename(sourcePath), preRestoreBackupJobId: preRestore.id } });
      return this.getRestoreJob(restoreId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha na restauracao.";
      const failedAt = new Date().toISOString();
      this.context.db.prepare("UPDATE restore_jobs SET status = 'FAILED', error_code = 'RESTORE_FAILED', error_message = ?, rollback_performed = 1, rollback_succeeded = 1, completed_at = ?, updated_at = ? WHERE id = ?").run(message, failedAt, failedAt, restoreId);
      this.auth.writeAudit({ actorUserId: session.user.id, sessionId: session.id, action: "restore.failed", entityType: "restore_job", entityId: restoreId, result: "FAILED", severity: "CRITICAL", reason: "RESTORE_FAILED", metadata: { message } });
      throw error;
    }
  }

  runQuickDatabaseCheck(): { run: IntegrityCheckRun; findings: IntegrityFinding[] } {
    const session = this.auth.requireSession("integrity.run");
    const started = Date.now();
    const id = randomUUID();
    const now = new Date().toISOString();
    this.context.db.prepare("INSERT INTO integrity_check_runs (id, check_type, status, started_at, checked_items, problem_count, created_by_user_id, created_at) VALUES (?, 'DATABASE_QUICK', 'RUNNING', ?, 0, 0, ?, ?)")
      .run(id, now, session.user.id, now);
    const findings: Array<{ type: string; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; message: string; details?: unknown }> = [];
    const quick = this.context.db.prepare("PRAGMA quick_check").get() as { quick_check: string };
    if (quick.quick_check !== "ok") findings.push({ type: "DATABASE_QUICK_CHECK", severity: "CRITICAL", message: quick.quick_check });
    const fk = this.context.db.prepare("PRAGMA foreign_key_check").all() as unknown[];
    if (fk.length > 0) findings.push({ type: "FOREIGN_KEY_CHECK", severity: "HIGH", message: `${fk.length} problemas de chave estrangeira.`, details: fk });
    const admin = this.context.db.prepare("SELECT COUNT(*) AS total FROM app_users au JOIN user_role_assignments ura ON ura.user_id = au.id WHERE au.status = 'ACTIVE' AND ura.role_id = 'role-system-admin' AND ura.is_active = 1").get() as { total: number };
    if (admin.total < 1) findings.push({ type: "ACTIVE_ADMIN_MISSING", severity: "CRITICAL", message: "Nenhum administrador ativo encontrado." });
    const savedFindings = findings.map((finding) => this.createFinding(id, finding.type, finding.severity, finding.message, finding.details ?? {}));
    const completed = new Date().toISOString();
    this.context.db.prepare("UPDATE integrity_check_runs SET status = ?, completed_at = ?, duration_ms = ?, checked_items = 3, problem_count = ? WHERE id = ?")
      .run(findings.length ? "FAILED" : "OK", completed, Date.now() - started, findings.length, id);
    this.auth.writeAudit({ actorUserId: session.user.id, sessionId: session.id, action: "integrity.database_quick", result: findings.length ? "FAILED" : "SUCCESS", severity: findings.length ? "WARNING" : "INFO", metadata: { problemCount: findings.length } });
    return { run: this.getIntegrityRun(id), findings: savedFindings };
  }

  checkDocumentFiles(): { run: IntegrityCheckRun; findings: IntegrityFinding[] } {
    const session = this.auth.requireSession("integrity.run");
    const started = Date.now();
    const id = randomUUID();
    const now = new Date().toISOString();
    this.context.db.prepare("INSERT INTO integrity_check_runs (id, check_type, status, started_at, checked_items, problem_count, created_by_user_id, created_at) VALUES (?, 'DOCUMENTS', 'RUNNING', ?, 0, 0, ?, ?)")
      .run(id, now, session.user.id, now);
    const findings: IntegrityFinding[] = [];
    const referenced = this.referencedDocumentPaths();
    for (const filePath of referenced) {
      if (!isInside(this.context.directories.userData, filePath)) findings.push(this.createFinding(id, "INVALID_PATH", "HIGH", "Arquivo referenciado fora de userData.", { path: basename(filePath) }));
      else if (!existsSync(filePath)) findings.push(this.createFinding(id, "MISSING", "HIGH", "Arquivo referenciado nao existe.", { path: relative(this.context.directories.userData, filePath) }));
      else if (statSync(filePath).isDirectory()) findings.push(this.createFinding(id, "INVALID_PATH", "MEDIUM", "Referencia aponta para diretorio.", { path: relative(this.context.directories.userData, filePath) }));
    }
    const completed = new Date().toISOString();
    this.context.db.prepare("UPDATE integrity_check_runs SET status = ?, completed_at = ?, duration_ms = ?, checked_items = ?, problem_count = ? WHERE id = ?")
      .run(findings.length ? "WARNING" : "OK", completed, Date.now() - started, referenced.length, findings.length, id);
    this.auth.writeAudit({ actorUserId: session.user.id, sessionId: session.id, action: "integrity.documents", result: "SUCCESS", severity: "INFO", metadata: { checked: referenced.length, findings: findings.length } });
    return { run: this.getIntegrityRun(id), findings };
  }

  findOrphans(): { run: IntegrityCheckRun; findings: IntegrityFinding[] } {
    const session = this.auth.requireSession("integrity.run");
    const id = randomUUID();
    const now = new Date().toISOString();
    this.context.db.prepare("INSERT INTO integrity_check_runs (id, check_type, status, started_at, checked_items, problem_count, created_by_user_id, created_at) VALUES (?, 'TEMPORARIES', 'RUNNING', ?, 0, 0, ?, ?)")
      .run(id, now, session.user.id, now);
    const referenced = new Set(this.referencedDocumentPaths().map((item) => resolve(item).toLowerCase()));
    const files = listFiles(this.context.directories.documentsDir).filter((file) => !referenced.has(resolve(file).toLowerCase()));
    const findings = files.slice(0, 500).map((file) => this.createFinding(id, classifyTemporary(file) ? "TEMPORARY_FILE" : "ORPHAN_FILE", classifyTemporary(file) ? "LOW" : "MEDIUM", classifyTemporary(file) ? "Arquivo temporario seguro candidato a limpeza." : "Arquivo sem referencia direta no banco.", { relativePath: safeRelative(this.context.directories.userData, file) }));
    const completed = new Date().toISOString();
    this.context.db.prepare("UPDATE integrity_check_runs SET status = ?, completed_at = ?, duration_ms = 0, checked_items = ?, problem_count = ? WHERE id = ?")
      .run(findings.length ? "WARNING" : "OK", completed, files.length, findings.length, id);
    return { run: this.getIntegrityRun(id), findings };
  }

  generateIntegrityReport(): IntegrityCheckRun {
    const session = this.auth.requireSession("integrity.export");
    const quick = this.runQuickDatabaseCheck();
    const documents = this.checkDocumentFiles();
    const report = {
      generatedAt: new Date().toISOString(),
      applicationVersion: this.context.version,
      migrationVersion: getCurrentMigration(this.context.db),
      database: quick,
      documents,
      backups: this.list().map((job) => ({ id: job.id, status: job.status, fileName: job.fileName, verifiedAt: job.verifiedAt }))
    };
    const reportsDir = join(this.context.directories.backupsDir, "integrity-reports");
    mkdirSync(reportsDir, { recursive: true });
    const reportPath = join(reportsDir, `integrity_${timestampForFile(new Date().toISOString())}.json`);
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    const id = randomUUID();
    const now = new Date().toISOString();
    this.context.db.prepare("INSERT INTO integrity_check_runs (id, check_type, status, started_at, completed_at, duration_ms, checked_items, problem_count, report_path, created_by_user_id, created_at) VALUES (?, 'SUMMARY', 'OK', ?, ?, 0, ?, ?, ?, ?, ?)")
      .run(id, now, now, report.database.run.checkedItems + report.documents.run.checkedItems, report.database.run.problemCount + report.documents.run.problemCount, reportPath, session.user.id, now);
    this.auth.writeAudit({ actorUserId: session.user.id, sessionId: session.id, action: "integrity.report_exported", result: "SUCCESS", severity: "INFO", metadata: { reportFile: basename(reportPath) } });
    return this.getIntegrityRun(id);
  }

  history(): IntegrityCheckRun[] {
    this.auth.requireSession("integrity.view");
    return (this.context.db.prepare("SELECT * FROM integrity_check_runs ORDER BY started_at DESC LIMIT 100").all() as DbRecord[]).map(mapIntegrityRun);
  }

  private async buildPayload(id: string, backupType: BackupType, encrypted: boolean, user: { id: string; username: string; displayName: string }): Promise<BackupPayload> {
    const tempDb = join(this.context.directories.backupsDir, "tmp", id, "application.sqlite");
    mkdirSync(dirname(tempDb), { recursive: true });
    await this.context.db.backup(tempDb);
    const snapshotDb = openDatabase(tempDb);
    const quick = snapshotDb.prepare("PRAGMA quick_check").get() as { quick_check: string };
    if (quick.quick_check !== "ok") throw new Error(`quick_check falhou: ${quick.quick_check}`);
    const organizations = (snapshotDb.prepare("SELECT id, display_name AS displayName FROM organizations ORDER BY display_name").all() as Array<{ id: string; displayName: string }>);
    const legalEntities = (snapshotDb.prepare("SELECT id, organization_id AS organizationId, trade_name AS tradeName FROM legal_entities ORDER BY trade_name").all() as Array<{ id: string; organizationId: string; tradeName: string }>);
    snapshotDb.close();
    const dbFile = fileToPackageEntry(tempDb, "database/application.sqlite", "database", true);
    const files = [dbFile, ...this.collectFilesForBackup(backupType, tempDb)];
    const completedAt = new Date().toISOString();
    const manifest: BackupManifest = {
      magic: "OPERACOES_CAFE_BACKUP",
      formatVersion: FORMAT_VERSION,
      backupId: id,
      backupType,
      createdAt: new Date().toISOString(),
      completedAt,
      applicationName: "Sistema Operacoes Cafe",
      applicationVersion: this.context.version,
      applicationVariant: this.activeVariant(),
      sourceInstallationId: this.installationId(),
      databaseMigrationVersion: getCurrentMigration(this.context.db),
      databaseFileName: "application.sqlite",
      databaseSize: dbFile.size,
      databaseHash: dbFile.sha256,
      documentCount: files.filter((file) => file.category !== "database").length,
      totalFileCount: files.length,
      totalUncompressedSize: files.reduce((sum, file) => sum + file.size, 0),
      organizations,
      legalEntities,
      encryption: { enabled: encrypted, algorithm: encrypted ? "AES-256-GCM-SCRYPT" : "NONE" },
      compression: { enabled: true, algorithm: "GZIP" },
      createdByUser: user,
      integrityStatus: "VALID",
      filesManifestPath: "integrity/files.json"
    };
    return { manifest, files };
  }

  private collectFilesForBackup(type: BackupType, snapshotDbPath: string | null): PackageFile[] {
    if (type === "DATABASE_ONLY") return [];
    const roots = [
      { root: this.context.directories.documentsDir, prefix: "documents" },
      { root: this.context.directories.settingsDir, prefix: "settings" }
    ];
    return roots.flatMap(({ root, prefix }) => existsSync(root) ? listFiles(root).filter((file) => file !== snapshotDbPath).map((file) => {
      const rel = normalizeBackupPath(join(prefix, safeRelative(root, file)));
      return fileToPackageEntry(file, rel, categoryForRelativePath(rel), isRequiredDocument(rel));
    }) : []);
  }

  private persistFileEntries(backupJobId: string, files: PackageFile[]): void {
    const stmt = this.context.db.prepare("INSERT OR REPLACE INTO backup_file_entries (id, backup_job_id, relative_path, category, file_size, file_hash, modified_at, entity_id, document_type, is_required, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const now = new Date().toISOString();
    const trx = this.context.db.transaction(() => files.forEach((file) => stmt.run(randomUUID(), backupJobId, file.relativePath, file.category, file.size, file.sha256, file.modifiedAt, file.entityId, file.documentType, file.required ? 1 : 0, now)));
    trx();
  }

  private inspectSync(path: string, password?: string | null): BackupInspection {
    try {
      const payload = decodePackage(readFileSync(path), password ?? null);
      validatePayload(payload);
      return { valid: true, encrypted: payload.manifest.encryption.enabled, manifest: payload.manifest, fileCount: payload.files.length, totalSize: payload.files.reduce((sum, file) => sum + file.size, 0), errors: [] };
    } catch (error) {
      const encrypted = safeReadEnvelope(path)?.encrypted ?? false;
      return { valid: false, encrypted, manifest: null, fileCount: 0, totalSize: 0, errors: [error instanceof Error ? error.message : "Backup invalido."] };
    }
  }

  private async inspectPackage(path: string, password: string | null): Promise<BackupInspection> {
    return this.inspectSync(path, password);
  }

  private readSettings(): BackupSettings {
    const row = this.context.db.prepare("SELECT * FROM backup_settings WHERE id = 'backup-settings-default'").get() as DbRecord | undefined;
    if (!row) throw new Error("Configuracao de backup ausente.");
    return mapBackupSettings(row);
  }

  private getJob(id: string): BackupJob {
    const row = this.context.db.prepare("SELECT * FROM backup_jobs WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Backup nao encontrado.");
    return mapBackupJob(row);
  }

  private getRestoreJob(id: string): RestoreJob {
    const row = this.context.db.prepare("SELECT * FROM restore_jobs WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Restauracao nao encontrada.");
    return mapRestoreJob(row);
  }

  private getIntegrityRun(id: string): IntegrityCheckRun {
    const row = this.context.db.prepare("SELECT * FROM integrity_check_runs WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Verificacao nao encontrada.");
    return mapIntegrityRun(row);
  }

  private createFinding(runId: string, type: string, severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL", message: string, details: unknown): IntegrityFinding {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.context.db.prepare("INSERT INTO integrity_check_findings (id, integrity_check_run_id, finding_type, severity, entity_type, entity_id, relative_path, message, details_json, created_at) VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?)")
      .run(id, runId, type, severity, message, JSON.stringify(details), now);
    return mapFinding(this.context.db.prepare("SELECT * FROM integrity_check_findings WHERE id = ?").get(id) as DbRecord);
  }

  private referencedDocumentPaths(): string[] {
    const tables = [
      ["charge_document_versions", "stored_file_path"],
      ["payable_document_attachments", "stored_file_path"],
      ["financial_report_generations", "stored_file_path"],
      ["deal_confirmation_document_versions", "stored_file_path"],
      ["spreadsheet_import_jobs", "stored_file_path"],
      ["xml_import_files", "stored_file_path"]
    ];
    return tables.flatMap(([table, column]) => {
      if (!tableExists(this.context.db, table)) return [];
      if (!columnExists(this.context.db, table, column)) return [];
      return (this.context.db.prepare(`SELECT ${column} AS path FROM ${table} WHERE ${column} IS NOT NULL`).all() as Array<{ path: string }>).map((row) => row.path);
    });
  }

  private validateRestoreCompatibility(manifest: BackupManifest): void {
    const currentMigration = getCurrentMigration(this.context.db);
    if (manifest.databaseMigrationVersion > currentMigration) throw new Error("Backup criado em migration mais nova que o aplicativo atual.");
    const currentVariant = this.activeVariant();
    if (currentVariant && manifest.applicationVariant && currentVariant !== "multiempresa" && manifest.applicationVariant !== currentVariant) {
      throw new Error("Backup de variante incompatível.");
    }
  }

  private async replaceCurrentState(tempDir: string): Promise<void> {
    const dbSource = join(tempDir, "database", "application.sqlite");
    if (!existsSync(dbSource)) throw new Error("Banco restaurado ausente.");
    // O banco atual (que esta sendo substituido) pode ter transacoes recentes
    // ainda so' no WAL, nao checkpointadas pro arquivo principal -- sobrescrever
    // so' o .sqlite e deixar o -wal antigo no lugar faz o SQLite reaplicar
    // essas transacoes "fantasmas" por cima do banco restaurado na proxima vez
    // que abrir, revivendo dado que devia ter sumido com a restauracao. A
    // conexao (this.context.db) continua aberta durante o restore inteiro (o
    // proprio executeRestore ainda escreve nela depois desta funcao), entao
    // apagar o -wal por fora (rmSync) da' EBUSY no Windows -- o jeito seguro e'
    // pedir pra ELA MESMA fazer o checkpoint e truncar o proprio WAL antes da
    // copia, isso esvazia o arquivo sem precisar excluir nada que ela tenha
    // aberto.
    this.context.db.pragma("wal_checkpoint(TRUNCATE)");
    copyFileSync(dbSource, this.context.directories.databasePath);
    // Se o banco restaurado (ja fechado apos migrations/quick_check) ainda
    // tiver seu proprio -wal/-shm por algum motivo, copia junto -- senao o
    // conteudo dele ficaria perdido do mesmo jeito.
    for (const suffix of ["-wal", "-shm"]) {
      const sourceSidecar = `${dbSource}${suffix}`;
      if (existsSync(sourceSidecar)) copyFileSync(sourceSidecar, `${this.context.directories.databasePath}${suffix}`);
    }
    const docsSource = join(tempDir, "documents");
    if (existsSync(docsSource)) {
      rmSync(this.context.directories.documentsDir, { recursive: true, force: true });
      copyDirectory(docsSource, this.context.directories.documentsDir);
    }
    const settingsSource = join(tempDir, "settings");
    if (existsSync(settingsSource)) {
      rmSync(this.context.directories.settingsDir, { recursive: true, force: true });
      copyDirectory(settingsSource, this.context.directories.settingsDir);
    }
  }

  private installationId(): string | null {
    const row = this.context.db.prepare("SELECT id FROM installation_profiles ORDER BY created_at LIMIT 1").get() as { id: string } | undefined;
    return row?.id ?? null;
  }

  private activeVariant(): AppVariant | null {
    const row = this.context.db.prepare("SELECT app_variant AS variant FROM installation_profiles ORDER BY created_at LIMIT 1").get() as { variant: AppVariant } | undefined;
    return row?.variant ?? null;
  }

  private installationLabel(): string {
    const row = this.context.db.prepare("SELECT app_variant AS variant FROM installation_profiles ORDER BY created_at LIMIT 1").get() as { variant: string } | undefined;
    if (row?.variant === "villa") return "VillaCoffee";
    if (row?.variant === "grao") return "GraoEGrao";
    return "OperacoesCafe";
  }
}

async function encodePackage(payload: BackupPayload, password: string | null): Promise<Buffer> {
  validatePayload(payload);
  const compressed = gzipSync(Buffer.from(JSON.stringify(payload), "utf8"));
  const envelope: BackupEnvelope = password
    ? await encryptPayload(compressed, password)
    : { formatVersion: FORMAT_VERSION, encrypted: false, compression: "GZIP", payloadBase64: compressed.toString("base64") };
  return Buffer.concat([Buffer.from(BACKUP_MAGIC, "utf8"), Buffer.from(JSON.stringify(envelope), "utf8")]);
}

function decodePackage(buffer: Buffer, password?: string | null): BackupPayload {
  const magic = buffer.subarray(0, Buffer.byteLength(BACKUP_MAGIC)).toString("utf8");
  if (magic !== BACKUP_MAGIC) throw new Error("Magic bytes invalidos.");
  const envelope = JSON.parse(buffer.subarray(Buffer.byteLength(BACKUP_MAGIC)).toString("utf8")) as BackupEnvelope;
  if (envelope.formatVersion !== FORMAT_VERSION) throw new Error("Versao de formato incompatível.");
  const compressed = envelope.encrypted ? decryptPayload(envelope, password) : Buffer.from(envelope.payloadBase64, "base64");
  const payload = JSON.parse(gunzipSync(compressed).toString("utf8")) as BackupPayload;
  validatePayload(payload);
  return payload;
}

async function encryptPayload(payload: Buffer, password: string): Promise<BackupEnvelope> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(password, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  return { formatVersion: FORMAT_VERSION, encrypted: true, compression: "GZIP", encryption: "AES-256-GCM-SCRYPT", saltBase64: salt.toString("base64"), ivBase64: iv.toString("base64"), authTagBase64: cipher.getAuthTag().toString("base64"), payloadBase64: encrypted.toString("base64") };
}

function decryptPayload(envelope: Extract<BackupEnvelope, { encrypted: true }>, password?: string | null): Buffer {
  if (!password) throw new Error("Senha do backup obrigatoria.");
  const key = deriveKeySync(password, Buffer.from(envelope.saltBase64, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.ivBase64, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.authTagBase64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(envelope.payloadBase64, "base64")), decipher.final()]);
}

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolvePromise, reject) => nodeScrypt(password, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolvePromise(key)));
}

function deriveKeySync(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

function validatePayload(payload: BackupPayload): void {
  if (payload.manifest.magic !== "OPERACOES_CAFE_BACKUP") throw new Error("Manifesto invalido.");
  if (payload.files.length > MAX_EXTRACTED_FILES) throw new Error("Quantidade de arquivos excede o limite.");
  const total = payload.files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_EXTRACTED_SIZE) throw new Error("Tamanho extraido excede o limite.");
  const seen = new Set<string>();
  for (const file of payload.files) {
    assertSafeRelativePath(file.relativePath);
    if (seen.has(file.relativePath)) throw new Error("Entrada duplicada no backup.");
    seen.add(file.relativePath);
    const content = Buffer.from(file.contentBase64, "base64");
    if (content.length !== file.size) throw new Error(`Tamanho divergente em ${file.relativePath}.`);
    if (sha256Buffer(content) !== file.sha256) throw new Error(`Hash divergente em ${file.relativePath}.`);
  }
}

function materializePayload(payload: BackupPayload, targetDir: string): void {
  validatePayload(payload);
  for (const file of payload.files) {
    const target = resolve(targetDir, file.relativePath);
    if (!isInside(targetDir, target)) throw new Error("Path traversal bloqueado.");
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, Buffer.from(file.contentBase64, "base64"));
  }
}

function fileToPackageEntry(filePath: string, relativePath: string, category: string, required: boolean): PackageFile {
  const stat = statSync(filePath);
  if (!stat.isFile()) throw new Error("Backup aceita apenas arquivos regulares.");
  const normalized = normalizeBackupPath(relativePath);
  assertSafeRelativePath(normalized);
  const content = readFileSync(filePath);
  return { relativePath: normalized, category, size: content.length, sha256: sha256Buffer(content), modifiedAt: stat.mtime.toISOString(), entityId: null, documentType: extname(filePath).replace(".", "").toUpperCase() || null, required, contentBase64: content.toString("base64") };
}

function listFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = join(root, entry.name);
    if (entry.isSymbolicLink()) return [];
    if (entry.isDirectory()) return listFiles(full);
    return entry.isFile() ? [full] : [];
  });
}

function copyDirectory(source: string, target: string): void {
  if (!existsSync(source)) return;
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(target, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) copyDirectory(from, to);
    if (entry.isFile()) {
      mkdirSync(dirname(to), { recursive: true });
      copyFileSync(from, to);
    }
  }
}

function safeBackupFileName(label: string, type: BackupType, trigger: BackupTriggerType, iso: string): string {
  const typeLabel = type === "FULL" ? "backup_completo" : type === "DATABASE_ONLY" ? "backup_banco" : "backup_documentos";
  const triggerLabel = trigger === "PRE_RESTORE" ? "pre-restore" : trigger === "PRE_MIGRATION" ? "pre-migration" : typeLabel;
  return `${label}_${triggerLabel}_${timestampForFile(iso)}.cafebackup`.replace(/[<>:"/\\|?*]/g, "_").slice(0, 140);
}

function uniqueFileName(directory: string, fileName: string): string {
  const ext = extname(fileName);
  const base = fileName.slice(0, -ext.length);
  let candidate = fileName;
  let index = 1;
  while (existsSync(join(directory, candidate))) {
    candidate = `${base}_${index}${ext}`;
    index += 1;
  }
  return candidate;
}

function categoryForRelativePath(relativePath: string): string {
  if (relativePath.startsWith("database/")) return "database";
  if (relativePath.includes("charges")) return "charges";
  if (relativePath.includes("accounts-payable")) return "accounts-payable";
  if (relativePath.includes("confirmations")) return "confirmations";
  if (relativePath.includes("financial-reports")) return "financial-reports";
  if (relativePath.includes("spreadsheet-imports")) return "imports";
  if (relativePath.includes("xml-imports")) return "xml";
  if (relativePath.includes("branding")) return "branding";
  return "documents";
}

function isRequiredDocument(relativePath: string): boolean {
  return /charges|confirmations|signed|accounts-payable|xml-imports/i.test(relativePath);
}

function normalizeBackupPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function assertSafeRelativePath(path: string): void {
  if (!path || path.includes("\0") || path.startsWith("/") || /^[A-Za-z]:/.test(path) || path.split("/").includes("..")) throw new Error("Caminho invalido no backup.");
}

function safeRelative(root: string, file: string): string {
  const rel = relative(root, file);
  if (rel.startsWith("..") || rel.includes(`..${sep}`)) throw new Error("Arquivo fora da raiz permitida.");
  return rel;
}

function isInside(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target));
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/") && !/^[A-Za-z]:/.test(rel));
}

function sha256Buffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function sha256File(path: string): string {
  return sha256Buffer(readFileSync(path));
}

function timestampForFile(iso: string): string {
  return iso.slice(0, 19).replace(/[-:T]/g, "_");
}

function assertWritableDirectory(directory: string): void {
  const probe = join(directory, `.write-test-${randomUUID()}`);
  writeFileSync(probe, "ok");
  rmSync(probe, { force: true });
}

function tableExists(db: Database.Database, table: string): boolean {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function columnExists(db: Database.Database, table: string, column: string): boolean {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some((item) => item.name === column);
}

function classifyTemporary(file: string): boolean {
  return /\.(tmp|temp|preview)$/i.test(file) || file.toLowerCase().includes(`${sep}tmp${sep}`);
}

function calculateNextRun(frequency: string, preferredHour: number | null): string | null {
  if (frequency === "DISABLED") return null;
  const next = new Date();
  next.setMinutes(0, 0, 0);
  next.setHours(preferredHour ?? 8);
  if (next <= new Date()) next.setDate(next.getDate() + 1);
  if (frequency === "WEEKLY") next.setDate(next.getDate() + 7);
  if (frequency === "MONTHLY") next.setMonth(next.getMonth() + 1);
  return next.toISOString();
}

function safeReadEnvelope(path: string): BackupEnvelope | null {
  try {
    const buffer = readFileSync(path);
    if (buffer.subarray(0, Buffer.byteLength(BACKUP_MAGIC)).toString("utf8") !== BACKUP_MAGIC) return null;
    return JSON.parse(buffer.subarray(Buffer.byteLength(BACKUP_MAGIC)).toString("utf8")) as BackupEnvelope;
  } catch {
    return null;
  }
}

function parseObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  return input as Record<string, unknown>;
}

function readString(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Campo obrigatorio: ${key}.`);
  return value;
}

function optionalString(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readEnum<T extends string>(data: Record<string, unknown>, key: string, values: T[], fallback: T): T {
  return values.includes(data[key] as T) ? data[key] as T : fallback;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mapBackupJob(row: DbRecord): BackupJob {
  return {
    id: String(row.id),
    backupType: String(row.backup_type) as BackupJob["backupType"],
    triggerType: String(row.trigger_type) as BackupJob["triggerType"],
    status: String(row.status) as BackupJob["status"],
    destinationType: String(row.destination_type) as BackupJob["destinationType"],
    destinationDisplayName: String(row.destination_display_name),
    storedFilePath: stringOrNull(row.stored_file_path),
    fileName: String(row.file_name),
    formatVersion: Number(row.format_version),
    encrypted: Boolean(row.encrypted),
    fileSize: numberOrNull(row.file_size),
    fileHash: stringOrNull(row.file_hash),
    databaseHash: stringOrNull(row.database_hash),
    migrationVersion: stringOrNull(row.migration_version),
    applicationVersion: String(row.application_version),
    applicationVariant: stringOrNull(row.application_variant) as AppVariant | null,
    sourceInstallationId: stringOrNull(row.source_installation_id),
    fileCount: Number(row.file_count ?? 0),
    documentCount: Number(row.document_count ?? 0),
    startedAt: String(row.started_at),
    completedAt: stringOrNull(row.completed_at),
    createdByUserId: stringOrNull(row.created_by_user_id),
    errorCode: stringOrNull(row.error_code),
    errorMessage: stringOrNull(row.error_message),
    isProtected: Boolean(row.is_protected),
    protectionReason: stringOrNull(row.protection_reason),
    verifiedAt: stringOrNull(row.verified_at),
    verificationStatus: stringOrNull(row.verification_status) as BackupJob["verificationStatus"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapBackupSettings(row: DbRecord): BackupSettings {
  return {
    id: String(row.id),
    installationId: stringOrNull(row.installation_id),
    automaticBackupEnabled: Boolean(row.automatic_backup_enabled),
    frequency: String(row.frequency) as BackupSettings["frequency"],
    preferredHour: numberOrNull(row.preferred_hour),
    backupType: String(row.backup_type) as BackupSettings["backupType"],
    destinationType: String(row.destination_type) as BackupSettings["destinationType"],
    destinationPathStoredSecurely: stringOrNull(row.destination_path_stored_securely),
    encrypted: Boolean(row.encrypted),
    retentionMaxCount: Number(row.retention_max_count),
    retentionMaxDays: numberOrNull(row.retention_max_days),
    lastBackupAt: stringOrNull(row.last_backup_at),
    nextBackupAt: stringOrNull(row.next_backup_at),
    runOncePerPeriod: Boolean(row.run_once_per_period),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapRestoreJob(row: DbRecord): RestoreJob {
  return {
    id: String(row.id),
    backupJobId: stringOrNull(row.backup_job_id),
    sourceFileName: String(row.source_file_name),
    sourceFileHash: stringOrNull(row.source_file_hash),
    sourceApplicationVersion: stringOrNull(row.source_application_version),
    sourceMigrationVersion: stringOrNull(row.source_migration_version),
    sourceVariant: stringOrNull(row.source_variant) as AppVariant | null,
    status: String(row.status) as RestoreJob["status"],
    preRestoreBackupJobId: stringOrNull(row.pre_restore_backup_job_id),
    startedAt: String(row.started_at),
    completedAt: stringOrNull(row.completed_at),
    executedByUserId: String(row.executed_by_user_id),
    errorCode: stringOrNull(row.error_code),
    errorMessage: stringOrNull(row.error_message),
    rollbackPerformed: Boolean(row.rollback_performed),
    rollbackSucceeded: row.rollback_succeeded == null ? null : Boolean(row.rollback_succeeded),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapIntegrityRun(row: DbRecord): IntegrityCheckRun {
  return {
    id: String(row.id),
    checkType: String(row.check_type) as IntegrityCheckRun["checkType"],
    status: String(row.status) as IntegrityCheckRun["status"],
    startedAt: String(row.started_at),
    completedAt: stringOrNull(row.completed_at),
    durationMs: numberOrNull(row.duration_ms),
    checkedItems: Number(row.checked_items ?? 0),
    problemCount: Number(row.problem_count ?? 0),
    reportPath: stringOrNull(row.report_path),
    createdByUserId: stringOrNull(row.created_by_user_id),
    createdAt: String(row.created_at)
  };
}

function mapFinding(row: DbRecord): IntegrityFinding {
  return {
    id: String(row.id),
    integrityCheckRunId: String(row.integrity_check_run_id),
    findingType: String(row.finding_type),
    severity: String(row.severity) as IntegrityFinding["severity"],
    entityType: stringOrNull(row.entity_type),
    entityId: stringOrNull(row.entity_id),
    relativePath: stringOrNull(row.relative_path),
    message: String(row.message),
    detailsJson: String(row.details_json),
    createdAt: String(row.created_at)
  };
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
