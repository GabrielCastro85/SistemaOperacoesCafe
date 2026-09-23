import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type pg from "pg";
import { z } from "zod";
import { resolveSession } from "./auth.js";

const SYNCED_TABLES = [
  "organizations", "legal_entities", "locations", "document_sequences",
  "business_partners", "business_partner_roles", "business_partner_merges", "partner_legal_entities",
  "partner_company_links", "partner_contacts", "partner_aliases", "client_billing_profiles",
  "products", "product_aliases", "service_rate_rules", "purchase_rate_rules", "operation_rate_history",
  "operation_classification_rules", "fiscal_documents", "fiscal_document_items", "fiscal_document_events",
  "fiscal_document_returns", "fiscal_document_merge_history", "operations", "third_party_operations",
  "client_charges", "client_charge_operations", "client_charge_adjustments", "charge_status_history",
  "client_ledger_entries", "client_credit_allocations", "client_payments", "client_payment_allocations",
  "transfer_reconciliations", "transfer_reconciliation_invoices", "transfer_reconciliation_payments",
  "expense_categories", "cost_centers", "financial_accounts", "accounts_payable", "account_payable_operations",
  "account_payable_allocations", "payable_recurring_templates", "payable_installment_groups", "payable_payments",
  "payable_payment_allocations", "payable_status_history", "deal_clause_templates", "deal_confirmation_templates",
  "deal_confirmations", "deal_confirmation_parties", "deal_confirmation_signers", "deal_confirmation_items",
  "deal_confirmation_clauses", "deal_confirmation_operations", "deal_confirmation_fiscal_documents",
  "deal_confirmation_status_history", "deal_payment_terms", "spreadsheet_mapping_templates"
] as const;
const syncedTableSet = new Set<string>(SYNCED_TABLES);
// Compatibilidade com desktops 1.1.16 e anteriores. Esses registros descrevem
// uma execucao local (incluindo caminhos de arquivo do PC), portanto o servidor
// aceita o lote antigo, mas descarta essas alteracoes sem gerar conflito.
const legacyLocalOnlyTableSet = new Set(["xml_import_jobs", "xml_import_files"]);
const acceptedTableSet = new Set([...syncedTableSet, ...legacyLocalOnlyTableSet]);
export const isCentralSynchronizedTable = (table: string): boolean => syncedTableSet.has(table);
export const isAcceptedSyncTable = (table: string): boolean => acceptedTableSet.has(table);
const tableNameSchema = z.string().regex(/^[a-z][a-z0-9_]{0,62}$/);
const rowKeySchema = z.string().min(1).max(500);
const changeSchema = z.object({
  table: tableNameSchema,
  key: rowKeySchema,
  operation: z.enum(["UPSERT", "DELETE"]),
  data: z.record(z.string(), z.unknown()).nullable().optional()
}).superRefine((change, context) => {
  if (!isAcceptedSyncTable(change.table)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: `Tabela nao sincronizavel: ${change.table}` });
  }
  if (change.operation === "UPSERT" && !change.data) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "UPSERT exige data." });
  }
});
const pushSchema = z.object({
  idempotencyKey: z.string().uuid(),
  baseRevision: z.number().int().min(0),
  changes: z.array(changeSchema).min(1).max(1000)
});

const stableJson = (value: Record<string, unknown>) => JSON.stringify(value, Object.keys(value).sort());
const rowHash = (value: Record<string, unknown>) => createHash("sha256").update(stableJson(value)).digest("hex");

async function requireSession(pool: pg.Pool, request: FastifyRequest) {
  return resolveSession(pool, request);
}

export function registerSyncRoutes(app: FastifyInstance, pool: pg.Pool): void {
  app.get("/v1/sync/status", async (request, reply) => {
    const session = await requireSession(pool, request);
    if (!session) return reply.code(401).send({ error: "UNAUTHORIZED" });
    const state = await pool.query<{ revision: string; promoted_import_run_id: string | null; promoted_at: Date | null; source_installation_id: string | null }>(`
      SELECT state.revision::text, state.promoted_import_run_id, state.promoted_at, run.source_installation_id
      FROM central_sync_state state
      LEFT JOIN sqlite_import_runs run ON run.id = state.promoted_import_run_id
      WHERE state.singleton = true
    `);
    const recordCount = await pool.query<{ total: string }>("SELECT COUNT(*)::text AS total FROM central_records WHERE deleted = false");
    return {
      revision: Number(state.rows[0]?.revision ?? 0),
      promotedImportRunId: state.rows[0]?.promoted_import_run_id ?? null,
      sourceInstallationId: state.rows[0]?.source_installation_id ?? null,
      promotedAt: state.rows[0]?.promoted_at ?? null,
      recordCount: Number(recordCount.rows[0]?.total ?? 0)
    };
  });

  app.post("/v1/sync/promote/:runId", async (request, reply) => {
    const session = await requireSession(pool, request);
    if (!session) return reply.code(401).send({ error: "UNAUTHORIZED" });
    const { runId } = z.object({ runId: z.string().uuid() }).parse(request.params);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT revision FROM central_sync_state WHERE singleton = true FOR UPDATE");
      const run = await client.query<{ status: string }>("SELECT status FROM sqlite_import_runs WHERE id = $1", [runId]);
      if (!run.rows[0]) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ error: "IMPORT_NOT_FOUND" });
      }
      if (run.rows[0].status !== "VERIFIED") {
        await client.query("ROLLBACK");
        return reply.code(409).send({ error: "IMPORT_NOT_VERIFIED" });
      }
      const existing = await client.query<{ total: string }>("SELECT COUNT(*)::text AS total FROM central_records");
      if (Number(existing.rows[0]?.total ?? 0) > 0) {
        const state = await client.query<{ promoted_import_run_id: string | null }>("SELECT promoted_import_run_id FROM central_sync_state WHERE singleton = true");
        if (state.rows[0]?.promoted_import_run_id === runId) {
          await client.query("COMMIT");
          return { status: "READY", runId, reused: true };
        }
        await client.query("ROLLBACK");
        return reply.code(409).send({ error: "CENTRAL_DATABASE_ALREADY_INITIALIZED" });
      }
      await client.query(`
        INSERT INTO central_records(table_name, row_key, row_data, row_sha256, revision, deleted, updated_by_user_id, updated_by_device_id)
        SELECT table_name, row_key, row_data, row_sha256, 1, false, $2, $3
        FROM sqlite_import_rows WHERE run_id = $1 AND table_name = ANY($4::text[])
      `, [runId, session.userId, session.deviceId, [...SYNCED_TABLES]]);
      await client.query(`
        UPDATE central_sync_state
        SET revision = 1, promoted_import_run_id = $1, promoted_at = now(), updated_at = now()
        WHERE singleton = true
      `, [runId]);
      await client.query(`
        INSERT INTO server_audit_events(id, actor_user_id, device_id, action, entity_type, entity_id, result)
        VALUES ($1, $2, $3, 'CENTRAL_DATABASE_PROMOTED', 'sqlite_import_run', $4, 'SUCCESS')
      `, [randomUUID(), session.userId, session.deviceId, runId]);
      const count = await client.query<{ total: string }>("SELECT COUNT(*)::text AS total FROM central_records WHERE deleted = false");
      await client.query("COMMIT");
      return { status: "READY", runId, revision: 1, recordCount: Number(count.rows[0]?.total ?? 0), reused: false };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.get("/v1/sync/bootstrap", async (request, reply) => {
    const session = await requireSession(pool, request);
    if (!session) return reply.code(401).send({ error: "UNAUTHORIZED" });
    const query = z.object({ cursor: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(2000).default(500) }).parse(request.query);
    const rows = await pool.query<{ table_name: string; row_key: string; row_data: Record<string, unknown>; row_sha256: string; revision: string }>(`
      SELECT table_name, row_key, row_data, row_sha256, revision::text
      FROM central_records WHERE deleted = false
      ORDER BY table_name, row_key OFFSET $1 LIMIT $2
    `, [query.cursor, query.limit + 1]);
    const hasMore = rows.rows.length > query.limit;
    const page = rows.rows.slice(0, query.limit);
    const state = await pool.query<{ revision: string }>("SELECT revision::text FROM central_sync_state WHERE singleton = true");
    return {
      revision: Number(state.rows[0]?.revision ?? 0),
      records: page.map((row) => ({ table: row.table_name, key: row.row_key, data: row.row_data, sha256: row.row_sha256, revision: Number(row.revision) })),
      nextCursor: hasMore ? query.cursor + query.limit : null
    };
  });

  app.get("/v1/sync/changes", async (request, reply) => {
    const session = await requireSession(pool, request);
    if (!session) return reply.code(401).send({ error: "UNAUTHORIZED" });
    const query = z.object({
      after: z.coerce.number().int().min(0),
      sequence: z.coerce.number().int().min(0).default(0),
      limit: z.coerce.number().int().min(1).max(2000).default(500)
    }).parse(request.query);
    const rows = await pool.query<{ revision: string; sequence: number; table_name: string; row_key: string; operation: "UPSERT" | "DELETE"; row_data: Record<string, unknown> | null; row_sha256: string | null }>(`
      SELECT revision::text, sequence, table_name, row_key, operation, row_data, row_sha256
      FROM central_change_log
      WHERE revision > $1 OR (revision = $1 AND sequence > $2)
      ORDER BY revision, sequence LIMIT $3
    `, [query.after, query.sequence, query.limit]);
    const state = await pool.query<{ revision: string }>("SELECT revision::text FROM central_sync_state WHERE singleton = true");
    return {
      currentRevision: Number(state.rows[0]?.revision ?? 0),
      changes: rows.rows.map((row) => ({ revision: Number(row.revision), sequence: row.sequence, table: row.table_name, key: row.row_key, operation: row.operation, data: row.row_data, sha256: row.row_sha256 })),
      next: rows.rows.length === query.limit ? {
        revision: Number(rows.rows.at(-1)?.revision ?? query.after),
        sequence: rows.rows.at(-1)?.sequence ?? query.sequence
      } : null
    };
  });

  app.post("/v1/sync/push", async (request, reply) => {
    const session = await requireSession(pool, request);
    if (!session) return reply.code(401).send({ error: "UNAUTHORIZED" });
    const input = pushSchema.parse(request.body);
    const synchronizedChanges = input.changes.filter((change) => isCentralSynchronizedTable(change.table));
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const duplicate = await client.query<{ committed_revision: string }>("SELECT committed_revision::text FROM central_sync_batches WHERE idempotency_key = $1", [input.idempotencyKey]);
      if (duplicate.rows[0]) {
        await client.query("COMMIT");
        return { revision: Number(duplicate.rows[0].committed_revision), reused: true };
      }
      const state = await client.query<{ revision: string }>("SELECT revision::text FROM central_sync_state WHERE singleton = true FOR UPDATE");
      const currentRevision = Number(state.rows[0]?.revision ?? 0);
      if (!synchronizedChanges.length) {
        await client.query(`
          INSERT INTO central_sync_batches(idempotency_key, user_id, device_id, base_revision, committed_revision, change_count)
          VALUES ($1, $2, $3, $4, $5, 0)
        `, [input.idempotencyKey, session.userId, session.deviceId, input.baseRevision, currentRevision]);
        await client.query("COMMIT");
        return { revision: currentRevision, reused: false, ignoredLocalOnlyChanges: input.changes.length };
      }
      const keys = synchronizedChanges.map((change) => ({ table_name: change.table, row_key: change.key }));
      const conflicts = await client.query<{ table_name: string; row_key: string; revision: string }>(`
        SELECT record.table_name, record.row_key, record.revision::text
        FROM central_records record
        JOIN jsonb_to_recordset($1::jsonb) AS key(table_name text, row_key text)
          ON key.table_name = record.table_name AND key.row_key = record.row_key
        WHERE record.revision > $2
      `, [JSON.stringify(keys), input.baseRevision]);
      if (conflicts.rows.length) {
        await client.query("ROLLBACK");
        return reply.code(409).send({
          error: "SYNC_CONFLICT",
          currentRevision,
          conflicts: conflicts.rows.map((row) => ({ table: row.table_name, key: row.row_key, revision: Number(row.revision) }))
        });
      }
      const revision = currentRevision + 1;
      for (const [index, change] of synchronizedChanges.entries()) {
        const data = change.operation === "UPSERT" ? change.data! : null;
        const sha256 = data ? rowHash(data) : null;
        await client.query(`
          INSERT INTO central_records(table_name, row_key, row_data, row_sha256, revision, deleted, updated_by_user_id, updated_by_device_id, updated_at)
          VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, now())
          ON CONFLICT (table_name, row_key) DO UPDATE SET
            row_data = excluded.row_data, row_sha256 = excluded.row_sha256, revision = excluded.revision,
            deleted = excluded.deleted, updated_by_user_id = excluded.updated_by_user_id,
            updated_by_device_id = excluded.updated_by_device_id, updated_at = now()
        `, [change.table, change.key, data ? JSON.stringify(data) : null, sha256, revision, change.operation === "DELETE", session.userId, session.deviceId]);
        await client.query(`
          INSERT INTO central_change_log(revision, sequence, table_name, row_key, operation, row_data, row_sha256, user_id, device_id)
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
        `, [revision, index + 1, change.table, change.key, change.operation, data ? JSON.stringify(data) : null, sha256, session.userId, session.deviceId]);
      }
      await client.query("UPDATE central_sync_state SET revision = $1, updated_at = now() WHERE singleton = true", [revision]);
      await client.query(`
        INSERT INTO central_sync_batches(idempotency_key, user_id, device_id, base_revision, committed_revision, change_count)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [input.idempotencyKey, session.userId, session.deviceId, input.baseRevision, revision, synchronizedChanges.length]);
      await client.query("COMMIT");
      return { revision, reused: false };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
}
