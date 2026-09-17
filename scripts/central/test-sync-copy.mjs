import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import process from "node:process";
import Database from "better-sqlite3";
import { runMigrations } from "../../dist-electron/electron/main/database/database.js";
import { CentralSyncService } from "../../dist-electron/electron/main/services/centralSyncService.js";

const databasePath = process.env.SQLITE_DATABASE_PATH;
const password = process.env.CENTRAL_PASSWORD;
if (!databasePath || !password) throw new Error("SQLITE_DATABASE_PATH e CENTRAL_PASSWORD sao obrigatorios.");

const copyPath = join(dirname(databasePath), `central-sync-test-${Date.now()}.sqlite`);
await mkdir(dirname(copyPath), { recursive: true });
const source = new Database(databasePath, { readonly: true, fileMustExist: true });
await source.backup(copyPath);
source.close();

const db = new Database(copyPath, { fileMustExist: true });
try {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  const sync = new CentralSyncService(db, "1.0.81-test");
  await sync.login("Gabriel", password);
  sync.stop();
  const state = db.prepare(`
    SELECT server_revision AS serverRevision, source_installation_id AS sourceInstallationId,
           last_success_at AS lastSuccessAt, last_error AS lastError
    FROM central_sync_state WHERE singleton = 1
  `).get();
  const violations = db.pragma("foreign_key_check");
  const baseline = db.prepare("SELECT COUNT(*) AS total FROM central_sync_baseline").get();
  console.log(JSON.stringify({ state, foreignKeyViolations: violations.length, baselineRecords: baseline.total }, null, 2));
  if (state.lastError) throw new Error(state.lastError);
  if (violations.length) throw new Error(`Foram encontradas ${violations.length} violacoes de relacionamento.`);
} finally {
  db.close();
  await rm(copyPath, { force: true });
  await rm(`${copyPath}-wal`, { force: true });
  await rm(`${copyPath}-shm`, { force: true });
}
