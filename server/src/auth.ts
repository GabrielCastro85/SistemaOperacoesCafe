import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type pg from "pg";
import { z } from "zod";
import type { ServerConfig } from "./config.js";

type SessionUser = { sessionId: string; userId: string; username: string; displayName: string; deviceId: string | null };

const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
  device: z.object({ installationId: z.string().min(1).max(200), displayName: z.string().min(1).max(200), platform: z.string().max(100).optional(), appVersion: z.string().max(40).optional() })
});

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const normalizeUsername = (value: string) => value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export async function resolveSession(pool: pg.Pool, request: FastifyRequest): Promise<SessionUser | null> {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return null;
  const result = await pool.query<SessionUser>(`
    SELECT s.id AS "sessionId", u.id AS "userId", u.username, u.display_name AS "displayName", s.device_id AS "deviceId"
    FROM api_sessions s JOIN app_users u ON u.id = s.user_id
    WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.status = 'ACTIVE'
  `, [hashToken(authorization.slice(7))]);
  const session = result.rows[0] ?? null;
  if (session) await pool.query("UPDATE api_sessions SET last_seen_at = now() WHERE id = $1", [session.sessionId]);
  return session;
}

export function registerAuthRoutes(app: FastifyInstance, pool: pg.Pool, config: ServerConfig): void {
  app.post("/v1/session/login", async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const users = await pool.query<{ id: string; username: string; display_name: string; password_hash: string; status: string }>(`
      SELECT u.id, u.username, u.display_name, c.password_hash, u.status
      FROM app_users u JOIN user_credentials c ON c.user_id = u.id
      WHERE u.normalized_username = $1
    `, [normalizeUsername(input.username)]);
    const user = users.rows[0];
    if (!user || user.status !== "ACTIVE" || !(await bcrypt.compare(input.password, user.password_hash))) {
      await pool.query("INSERT INTO server_audit_events(id, action, result, metadata) VALUES ($1, 'SESSION_LOGIN', 'DENIED', $2::jsonb)", [randomUUID(), JSON.stringify({ username: input.username })]);
      return reply.code(401).send({ error: "INVALID_CREDENTIALS", message: "Usuario ou senha invalidos." });
    }
    const deviceId = randomUUID();
    const device = await pool.query<{ id: string }>(`
      INSERT INTO registered_devices(id, installation_id, display_name, platform, app_version)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (installation_id) DO UPDATE SET display_name = excluded.display_name, platform = excluded.platform, app_version = excluded.app_version, last_seen_at = now()
      RETURNING id
    `, [deviceId, input.device.installationId, input.device.displayName, input.device.platform ?? null, input.device.appVersion ?? null]);
    const token = randomBytes(32).toString("base64url");
    const sessionId = randomUUID();
    await pool.query("INSERT INTO api_sessions(id, user_id, device_id, token_hash, expires_at) VALUES ($1, $2, $3, $4, now() + ($5 || ' hours')::interval)", [sessionId, user.id, device.rows[0]?.id, hashToken(token), String(config.SESSION_TTL_HOURS)]);
    await pool.query("UPDATE app_users SET failed_login_attempts = 0, last_login_at = now(), updated_at = now() WHERE id = $1", [user.id]);
    await pool.query("INSERT INTO server_audit_events(id, actor_user_id, device_id, action, result) VALUES ($1, $2, $3, 'SESSION_LOGIN', 'SUCCESS')", [randomUUID(), user.id, device.rows[0]?.id]);
    return { token, expiresInSeconds: config.SESSION_TTL_HOURS * 3600, user: { id: user.id, username: user.username, displayName: user.display_name } };
  });

  app.get("/v1/session/me", async (request, reply) => {
    const session = await resolveSession(pool, request);
    if (!session) return reply.code(401).send({ error: "UNAUTHORIZED" });
    return { user: { id: session.userId, username: session.username, displayName: session.displayName }, deviceId: session.deviceId };
  });

  app.post("/v1/session/logout", async (request, reply) => {
    const session = await resolveSession(pool, request);
    if (!session) return reply.code(401).send({ error: "UNAUTHORIZED" });
    await pool.query("UPDATE api_sessions SET revoked_at = now() WHERE id = $1", [session.sessionId]);
    return reply.code(204).send();
  });
}

