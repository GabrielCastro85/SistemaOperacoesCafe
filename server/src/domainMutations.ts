import { createHash, randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type pg from "pg";
import { resolveSession } from "./auth.js";

export type WebSession = NonNullable<Awaited<ReturnType<typeof resolveSession>>>;
export type DomainChange = {
  table: string;
  key: string;
  operation: "UPSERT" | "DELETE";
  data?: Record<string, unknown> | null;
};

const ROLE_PERMISSIONS: Record<string, ReadonlySet<string>> = {
  "role-system-admin": new Set(["*"]),
  "role-ops-manager": new Set(["operations.manage", "imports.manage", "commercial.manage", "billing.manage", "confirmations.manage"]),
  "role-finance-manager": new Set(["billing.manage", "finance.manage"]),
  "role-operator": new Set(["operations.manage"]),
  "role-viewer": new Set()
};

function stableJson(value: Record<string, unknown>): string {
  return JSON.stringify(value, Object.keys(value).sort());
}

function rowHash(value: Record<string, unknown>): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function profileObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function activeAssignments(profile: unknown): Array<Record<string, unknown>> {
  const assignments = profileObject(profile).roleAssignments;
  if (!Array.isArray(assignments)) return [];
  const now = new Date().toISOString();
  return assignments.flatMap((item) => {
    const assignment = profileObject(item);
    if (assignment.isActive === false) return [];
    if (typeof assignment.expiresAt === "string" && assignment.expiresAt && assignment.expiresAt <= now) return [];
    return [assignment];
  });
}

export async function requireWebSession(pool: pg.Pool, request: FastifyRequest, reply: FastifyReply): Promise<WebSession | null> {
  const session = await resolveSession(pool, request);
  if (session) return session;
  await reply.code(401).send({ error: "UNAUTHORIZED", message: "Sessao expirada. Entre novamente." });
  return null;
}

export async function requirePermission(
  pool: pg.Pool,
  session: WebSession,
  reply: FastifyReply,
  permission: string,
  organizationId: string,
  legalEntityId?: string | null
): Promise<boolean> {
  const result = await pool.query<{ is_central_admin: boolean; desktop_profile: unknown }>(
    "SELECT is_central_admin, desktop_profile FROM app_users WHERE id = $1",
    [session.userId]
  );
  const user = result.rows[0];
  if (user?.is_central_admin) return true;
  const allowed = activeAssignments(user?.desktop_profile).some((assignment) => {
    const rolePermissions = ROLE_PERMISSIONS[String(assignment.roleId ?? "")];
    if (!rolePermissions || (!rolePermissions.has("*") && !rolePermissions.has(permission))) return false;
    const assignedOrganization = assignment.organizationId == null ? null : String(assignment.organizationId);
    const assignedEntity = assignment.legalEntityId == null ? null : String(assignment.legalEntityId);
    return (!assignedOrganization || assignedOrganization === organizationId)
      && (!assignedEntity || !legalEntityId || assignedEntity === legalEntityId);
  });
  if (allowed) return true;
  await reply.code(403).send({ error: "ACCESS_DENIED", message: "Seu perfil nao permite realizar esta alteracao." });
  return false;
}

export async function centralRecord(pool: pg.Pool, table: string, key: string): Promise<Record<string, unknown> | null> {
  const result = await pool.query<{ row_data: Record<string, unknown> }>(
    "SELECT row_data FROM central_records WHERE table_name = $1 AND row_key = $2 AND deleted = false",
    [table, key]
  );
  return result.rows[0]?.row_data ?? null;
}

export async function centralRecords(pool: pg.Pool, table: string): Promise<Record<string, unknown>[]> {
  const result = await pool.query<{ row_data: Record<string, unknown> }>(
    "SELECT row_data FROM central_records WHERE table_name = $1 AND deleted = false AND row_data IS NOT NULL",
    [table]
  );
  return result.rows.map((row) => row.row_data);
}

export async function commitDomainChanges(
  pool: pg.Pool,
  session: WebSession,
  action: string,
  entityType: string,
  entityId: string,
  changes: DomainChange[],
  metadata: Record<string, unknown> = {}
): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const state = await client.query<{ revision: string }>(
      "SELECT revision::text FROM central_sync_state WHERE singleton = true FOR UPDATE"
    );
    const revision = Number(state.rows[0]?.revision ?? 0) + 1;
    for (const [index, change] of changes.entries()) {
      const data = change.operation === "UPSERT" ? change.data ?? null : null;
      const hash = data ? rowHash(data) : null;
      await client.query(`
        INSERT INTO central_records(
          table_name, row_key, row_data, row_sha256, revision, deleted,
          updated_by_user_id, updated_by_device_id, updated_at
        ) VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, now())
        ON CONFLICT (table_name, row_key) DO UPDATE SET
          row_data = excluded.row_data, row_sha256 = excluded.row_sha256,
          revision = excluded.revision, deleted = excluded.deleted,
          updated_by_user_id = excluded.updated_by_user_id,
          updated_by_device_id = excluded.updated_by_device_id, updated_at = now()
      `, [change.table, change.key, data ? JSON.stringify(data) : null, hash, revision, change.operation === "DELETE", session.userId, session.deviceId]);
      await client.query(`
        INSERT INTO central_change_log(
          revision, sequence, table_name, row_key, operation, row_data,
          row_sha256, user_id, device_id
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
      `, [revision, index + 1, change.table, change.key, change.operation, data ? JSON.stringify(data) : null, hash, session.userId, session.deviceId]);
    }
    await client.query("UPDATE central_sync_state SET revision = $1, updated_at = now() WHERE singleton = true", [revision]);
    await client.query(`
      INSERT INTO server_audit_events(
        id, actor_user_id, device_id, action, entity_type, entity_id, result, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, 'SUCCESS', $7::jsonb)
    `, [randomUUID(), session.userId, session.deviceId, action, entityType, entityId, JSON.stringify({ ...metadata, revision, changeCount: changes.length })]);
    await client.query("COMMIT");
    return revision;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
