import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";

/* global console */

const dir = mkdtempSync(join(tmpdir(), "operacoes-cafe-perf-"));
const dbPath = join(dir, "baseline.sqlite");
const db = new Database(dbPath);

try {
  const start = performance.now();
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE operations_perf (
      id INTEGER PRIMARY KEY,
      partner TEXT NOT NULL,
      document_number TEXT NOT NULL,
      operation_date TEXT NOT NULL,
      sacks_decimal TEXT NOT NULL,
      service_amount_cents INTEGER NOT NULL
    );
    CREATE INDEX idx_operations_perf_partner ON operations_perf(partner);
    CREATE INDEX idx_operations_perf_date ON operations_perf(operation_date);
  `);
  const insert = db.prepare("INSERT INTO operations_perf (partner, document_number, operation_date, sacks_decimal, service_amount_cents) VALUES (?, ?, ?, ?, ?)");
  const write = db.transaction((count) => {
    for (let index = 0; index < count; index += 1) {
      insert.run(`Cliente ${index % 5000}`, `NF-${index}`, `2026-07-${String((index % 28) + 1).padStart(2, "0")}`, `${(index % 100) + 1}.000000`, (index % 3000) + 500);
    }
  });
  write(20000);
  const insertedAt = performance.now();
  const rows = db.prepare("SELECT partner, COUNT(*) AS total, SUM(service_amount_cents) AS amount FROM operations_perf WHERE operation_date BETWEEN ? AND ? GROUP BY partner ORDER BY total DESC LIMIT 20")
    .all("2026-07-01", "2026-07-28");
  const queriedAt = performance.now();
  const integrity = db.prepare("PRAGMA quick_check").pluck().get();
  const finishedAt = performance.now();
  console.log(JSON.stringify({
    insertedRows: 20000,
    groupedRows: rows.length,
    insertMs: Math.round(insertedAt - start),
    queryMs: Math.round(queriedAt - insertedAt),
    quickCheckMs: Math.round(finishedAt - queriedAt),
    integrity
  }, null, 2));
  if (integrity !== "ok") process.exit(1);
} finally {
  db.close();
  rmSync(dir, { recursive: true, force: true });
}
