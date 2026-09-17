import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import process from "node:process";
import Database from "better-sqlite3";
import { runMigrations } from "../../dist-electron/electron/main/database/database.js";
import { CentralSyncService } from "../../dist-electron/electron/main/services/centralSyncService.js";

const databasePath = process.env.SQLITE_DATABASE_PATH;
const password = process.env.CENTRAL_PASSWORD;
if (!databasePath || !password) throw new Error("SQLITE_DATABASE_PATH e CENTRAL_PASSWORD sao obrigatorios.");

const suffix = Date.now();
const pathA = join(dirname(databasePath), `central-client-a-${suffix}.sqlite`);
const pathB = join(dirname(databasePath), `central-client-b-${suffix}.sqlite`);
const productId = randomUUID();
let dbA;
let dbB;
let syncA;
let syncB;

async function clone(target) {
  const source = new Database(databasePath, { readonly: true, fileMustExist: true });
  await source.backup(target);
  source.close();
}

try {
  await clone(pathA);
  await clone(pathB);
  dbA = new Database(pathA);
  dbB = new Database(pathB);
  for (const db of [dbA, dbB]) {
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    runMigrations(db);
  }
  dbB.prepare("UPDATE installation_profiles SET id = ?").run(`secondary-test-${suffix}`);

  syncA = new CentralSyncService(dbA, "1.0.81-test-a");
  syncB = new CentralSyncService(dbB, "1.0.81-test-b");
  await syncA.login("Gabriel", password);
  await syncB.login("Gabriel", password);

  const organization = dbA.prepare("SELECT id FROM organizations ORDER BY created_at LIMIT 1").get();
  if (!organization?.id) throw new Error("Organizacao de teste nao encontrada.");
  const now = new Date().toISOString();
  dbA.prepare(`
    INSERT INTO products(id, organization_id, name, code, category, default_unit, default_sack_weight_kg, description, is_active, created_at, updated_at)
    VALUES (?, ?, 'TESTE SINCRONIZACAO TEMPORARIO', ?, 'COFFEE_OTHER', 'SACK', 60, 'Registro automatico; deve ser removido ao final.', 1, ?, ?)
  `).run(productId, organization.id, `SYNC-${suffix}`, now, now);
  await syncA.synchronize();
  await syncB.synchronize();
  const received = dbB.prepare("SELECT id, name FROM products WHERE id = ?").get(productId);
  if (!received) throw new Error("A copia B nao recebeu o registro criado na copia A.");

  dbA.prepare("DELETE FROM products WHERE id = ?").run(productId);
  await syncA.synchronize();
  await syncB.synchronize();
  const removed = !dbB.prepare("SELECT 1 FROM products WHERE id = ?").get(productId);
  if (!removed) throw new Error("A copia B nao recebeu a remocao feita na copia A.");

  const stateA = dbA.prepare("SELECT server_revision AS revision, last_error AS error FROM central_sync_state WHERE singleton = 1").get();
  const stateB = dbB.prepare("SELECT server_revision AS revision, last_error AS error FROM central_sync_state WHERE singleton = 1").get();
  const violationsA = dbA.pragma("foreign_key_check").length;
  const violationsB = dbB.pragma("foreign_key_check").length;
  console.log(JSON.stringify({ createdOnA: true, receivedOnB: true, deletedOnA: true, removedOnB: true, stateA, stateB, violationsA, violationsB }, null, 2));
  if (violationsA || violationsB) throw new Error("O teste terminou com violacoes de relacionamento.");
} finally {
  try {
    if (dbA?.open && dbA.prepare("SELECT 1 FROM products WHERE id = ?").get(productId)) {
      dbA.prepare("DELETE FROM products WHERE id = ?").run(productId);
      if (syncA) await syncA.synchronize();
    }
  } catch {}
  syncA?.stop();
  syncB?.stop();
  if (dbA?.open) dbA.close();
  if (dbB?.open) dbB.close();
  for (const path of [pathA, pathB]) {
    await rm(path, { force: true });
    await rm(`${path}-wal`, { force: true });
    await rm(`${path}-shm`, { force: true });
  }
}
