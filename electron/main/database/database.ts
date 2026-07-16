import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { AppDirectories } from "../../../src/shared/types/domain.js";
import { migrations } from "./migrations.js";

export function openDatabase(databasePath: string): Database.Database {
  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migration_history (
      id TEXT PRIMARY KEY,
      migration_name TEXT NOT NULL UNIQUE,
      executed_at TEXT NOT NULL,
      checksum TEXT
    );
  `);
  const hasMigration = db.prepare("SELECT 1 FROM migration_history WHERE migration_name = ? LIMIT 1");
  const recordMigration = db.prepare(`
    INSERT INTO migration_history (id, migration_name, executed_at, checksum)
    VALUES (?, ?, ?, ?)
  `);
  migrations.forEach((migration) => {
    if (hasMigration.get(migration.name)) {
      return;
    }
    const transaction = db.transaction(() => {
      migration.up(db);
      recordMigration.run(randomUUID(), migration.name, new Date().toISOString(), null);
    });
    transaction();
  });
}

export function initializeDatabase(directories: AppDirectories): Database.Database {
  const db = openDatabase(directories.databasePath);
  runMigrations(db);
  return db;
}

export function getCurrentMigration(db: Database.Database): string {
  const row = db
    .prepare("SELECT migration_name AS migrationName FROM migration_history ORDER BY executed_at DESC LIMIT 1")
    .get() as { migrationName: string } | undefined;
  return row?.migrationName ?? "none";
}
