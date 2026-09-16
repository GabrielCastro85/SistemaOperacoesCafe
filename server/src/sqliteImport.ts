import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type pg from "pg";
import { z } from "zod";
import { resolveSession } from "./auth.js";

const tableNameSchema = z.string().regex(/^[a-z][a-z0-9_]{0,62}$/);
const countsSchema = z.record(tableNameSchema, z.number().int().min(0));
const beginSchema = z.object({
  sourceInstallationId: z.string().min(1).max(200),
  sourceDatabaseSha256: z.string().regex(/^[a-f0-9]{64}$/),
  sourceDatabaseBytes: z.number().int().min(0),
  sourceMigration: z.string().max(200).nullable(),
  tableCounts: countsSchema
});
const rowsSchema = z.object({
  rows: z.array(z.object({ key: z.string().min(1).max(500), data: z.record(z.string(), z.unknown()) })).min(1).max(250)
});

async function authenticated(pool: pg.Pool, request: FastifyRequest) {
  return resolveSession(pool, request);
}

const stableJson = (value: Record<string, unknown>) => JSON.stringify(value, Object.keys(value).sort());
const hashRow = (value: Record<string, unknown>) => createHash("sha256").update(stableJson(value)).digest("hex");

export function registerSqliteImportRoutes(app: FastifyInstance, pool: pg.Pool): void {
  app.post("/v1/sqlite-imports", async (request, reply) => {
    const session = await authenticated(pool, request);
    if (!session) return reply.code(401).send({ error: "UNAUTHORIZED" });
    const input = beginSchema.parse(request.body);
    const existing = await pool.query<{ id: string; status: string }>(`
      SELECT id, status FROM sqlite_import_runs
      WHERE source_installation_id = $1 AND source_database_sha256 = $2
    `, [input.sourceInstallationId, input.sourceDatabaseSha256]);
    if (existing.rows[0]) return reply.code(200).send({ runId: existing.rows[0].id, status: existing.rows[0].status, reused: true });
    const runId = randomUUID();
    await pool.query(`
      INSERT INTO sqlite_import_runs(
        id, source_installation_id, source_database_sha256, source_database_bytes,
        source_migration, expected_table_counts, status, created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'IMPORTING', $7)
    `, [runId, input.sourceInstallationId, input.sourceDatabaseSha256, input.sourceDatabaseBytes, input.sourceMigration, JSON.stringify(input.tableCounts), session.userId]);
    return reply.code(201).send({ runId, status: "IMPORTING", reused: false });
  });

  app.put("/v1/sqlite-imports/:runId/tables/:tableName", async (request, reply) => {
    const session = await authenticated(pool, request);
    if (!session) return reply.code(401).send({ error: "UNAUTHORIZED" });
    const params = z.object({ runId: z.string().uuid(), tableName: tableNameSchema }).parse(request.params);
    const input = rowsSchema.parse(request.body);
    const run = await pool.query<{ status: string }>("SELECT status FROM sqlite_import_runs WHERE id = $1", [params.runId]);
    if (!run.rows[0]) return reply.code(404).send({ error: "IMPORT_NOT_FOUND" });
    if (run.rows[0].status !== "IMPORTING") return reply.code(409).send({ error: "IMPORT_NOT_OPEN" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const row of input.rows) {
        await client.query(`
          INSERT INTO sqlite_import_rows(run_id, table_name, row_key, row_data, row_sha256)
          VALUES ($1, $2, $3, $4::jsonb, $5)
          ON CONFLICT (run_id, table_name, row_key)
          DO UPDATE SET row_data = excluded.row_data, row_sha256 = excluded.row_sha256, imported_at = now()
        `, [params.runId, params.tableName, row.key, JSON.stringify(row.data), hashRow(row.data)]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return { accepted: input.rows.length };
  });

  app.post("/v1/sqlite-imports/:runId/verify", async (request, reply) => {
    const session = await authenticated(pool, request);
    if (!session) return reply.code(401).send({ error: "UNAUTHORIZED" });
    const { runId } = z.object({ runId: z.string().uuid() }).parse(request.params);
    try {
      const run = await pool.query<{ expected_table_counts: Record<string, number> | string }>("SELECT expected_table_counts FROM sqlite_import_runs WHERE id = $1::uuid", [runId]);
      if (!run.rows[0]) return reply.code(404).send({ error: "IMPORT_NOT_FOUND" });
      const rows = await pool.query<{ table_name: string; total: string }>(`
        SELECT table_name, COUNT(*)::text AS total FROM sqlite_import_rows WHERE run_id = $1::uuid GROUP BY table_name
      `, [runId]);
      const actual: Record<string, number> = Object.fromEntries(rows.rows.map((row) => [row.table_name, Number(row.total)]));
      const rawExpected = run.rows[0].expected_table_counts;
      const expected: Record<string, number> = typeof rawExpected === "string" ? JSON.parse(rawExpected) as Record<string, number> : rawExpected;
      const discrepancies = Object.entries(expected)
        .filter(([table, count]) => (actual[table] ?? 0) !== Number(count))
        .map(([table, count]) => ({ table, expected: Number(count), actual: actual[table] ?? 0 }));
      const status = discrepancies.length === 0 ? "VERIFIED" : "FAILED";
      await pool.query(`
        UPDATE sqlite_import_runs
        SET imported_table_counts = $2::jsonb, status = $3::text, completed_at = now()
        WHERE id = $1::uuid
      `, [runId, JSON.stringify(actual), status]);
      return reply.code(discrepancies.length ? 409 : 200).send({ runId, status, expected, actual, discrepancies });
    } catch (error) {
      request.log.error({ err: error, runId }, "sqlite import verification failed");
      const databaseError = error as { code?: string; constraint?: string; message?: string };
      return reply.code(500).send({
        error: "IMPORT_VERIFICATION_FAILED",
        databaseCode: databaseError.code ?? null,
        constraint: databaseError.constraint ?? null,
        message: databaseError.message ?? "Falha ao conferir a importacao."
      });
    }
  });

  app.get("/v1/sqlite-imports/:runId", async (request, reply) => {
    const session = await authenticated(pool, request);
    if (!session) return reply.code(401).send({ error: "UNAUTHORIZED" });
    const { runId } = z.object({ runId: z.string().uuid() }).parse(request.params);
    const result = await pool.query(`
      SELECT id, source_installation_id AS "sourceInstallationId", source_database_sha256 AS "sourceDatabaseSha256",
             source_database_bytes AS "sourceDatabaseBytes", source_migration AS "sourceMigration",
             expected_table_counts AS "expectedTableCounts", imported_table_counts AS "importedTableCounts",
             status, created_at AS "createdAt", completed_at AS "completedAt"
      FROM sqlite_import_runs WHERE id = $1
    `, [runId]);
    if (!result.rows[0]) return reply.code(404).send({ error: "IMPORT_NOT_FOUND" });
    return result.rows[0];
  });
}
