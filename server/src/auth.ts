import { createHash, randomBytes, randomUUID, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type pg from "pg";
import { z } from "zod";
import type { ServerConfig } from "./config.js";

type SessionUser = { sessionId: string; userId: string; username: string; displayName: string; deviceId: string | null };

const desktopProfileSchema = z.object({
  localUserId: z.string().uuid(),
  displayName: z.string().min(1).max(200),
  username: z.string().min(1).max(100),
  email: z.string().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "LOCKED"]),
  mustChangePassword: z.boolean(),
  roleAssignments: z.array(z.object({
    roleId: z.string().min(1), organizationId: z.string().nullable(), legalEntityId: z.string().nullable(),
    assignedAt: z.string(), expiresAt: z.string().nullable(), isActive: z.boolean()
  })),
  legalEntityAccess: z.array(z.object({
    organizationId: z.string(), legalEntityId: z.string().nullable(), accessMode: z.enum(["ALL", "SPECIFIC"])
  }))
});
const synchronizedUserSchema = desktopProfileSchema.extend({
  credential: z.object({ format: z.string().max(100), passwordHash: z.string().min(1).max(1000), passwordChangedAt: z.string() })
});

const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
  device: z.object({ installationId: z.string().min(1).max(200), displayName: z.string().min(1).max(200), platform: z.string().max(100).optional(), appVersion: z.string().max(40).optional() })
});
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200)
});

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const normalizeUsername = (value: string) => value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

async function verifyCredential(password: string, format: string, encoded: string): Promise<boolean> {
  if (format === "bcrypt") return bcrypt.compare(password, encoded);
  const parts = encoded.split("$");
  if (!format.startsWith("scrypt$v1$") || parts.length !== 5 || parts[0] !== "scrypt" || parts[1] !== "v1") return false;
  const salt = Buffer.from(parts[3], "base64");
  const expected = Buffer.from(parts[4], "base64");
  const actual = await new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(password, salt, expected.length, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key));
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

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
    const users = await pool.query<{ id: string; username: string; display_name: string; password_hash: string; credential_format: string; status: string; desktop_profile: unknown }>(`
      SELECT u.id, u.username, u.display_name, c.password_hash, c.credential_format, u.status, u.desktop_profile
      FROM app_users u JOIN user_credentials c ON c.user_id = u.id
      WHERE u.normalized_username = $1
    `, [normalizeUsername(input.username)]);
    const user = users.rows[0];
    if (!user || user.status !== "ACTIVE" || !(await verifyCredential(input.password, user.credential_format, user.password_hash))) {
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
    return { token, expiresInSeconds: config.SESSION_TTL_HOURS * 3600, user: { id: user.id, username: user.username, displayName: user.display_name, desktopProfile: user.desktop_profile } };
  });

  app.post("/v1/users/synchronize", async (request, reply) => {
    const session = await resolveSession(pool, request);
    if (!session) return reply.code(401).send({ error: "UNAUTHORIZED" });
    const administrator = await pool.query<{ allowed: boolean }>("SELECT is_central_admin AS allowed FROM app_users WHERE id = $1", [session.userId]);
    if (!administrator.rows[0]?.allowed) return reply.code(403).send({ error: "ACCESS_DENIED" });
    const input = z.object({ users: z.array(synchronizedUserSchema).max(100) }).parse(request.body);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const user of input.users) {
        const { credential, ...desktopProfile } = user;
        const normalized = normalizeUsername(user.username);
        const existing = await client.query<{ id: string }>("SELECT id FROM app_users WHERE normalized_username = $1", [normalized]);
        const serverUserId = existing.rows[0]?.id ?? user.localUserId;
        await client.query(`
          INSERT INTO app_users(id, display_name, username, normalized_username, email, status, must_change_password, desktop_profile)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
          ON CONFLICT (normalized_username) DO UPDATE SET
            display_name = excluded.display_name, username = excluded.username, email = excluded.email,
            status = excluded.status, must_change_password = excluded.must_change_password,
            desktop_profile = excluded.desktop_profile, updated_at = now()
        `, [serverUserId, user.displayName, user.username, normalized, user.email, user.status, user.mustChangePassword, JSON.stringify(desktopProfile)]);
        await client.query(`
          INSERT INTO user_credentials(id, user_id, credential_format, password_hash, password_changed_at)
          VALUES ($1, $2, $3, $4, $5::timestamptz)
          ON CONFLICT (user_id) DO UPDATE SET credential_format = excluded.credential_format,
            password_hash = excluded.password_hash, password_changed_at = excluded.password_changed_at
        `, [randomUUID(), serverUserId, credential.format, credential.passwordHash, credential.passwordChangedAt]);
      }
      await client.query("INSERT INTO server_audit_events(id, actor_user_id, device_id, action, result, metadata) VALUES ($1, $2, $3, 'DESKTOP_USERS_SYNCHRONIZED', 'SUCCESS', $4::jsonb)", [randomUUID(), session.userId, session.deviceId, JSON.stringify({ count: input.users.length })]);
      await client.query("COMMIT");
      return { synchronized: input.users.length };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.get("/v1/session/me", async (request, reply) => {
    const session = await resolveSession(pool, request);
    if (!session) return reply.code(401).send({ error: "UNAUTHORIZED" });
    return { user: { id: session.userId, username: session.username, displayName: session.displayName }, deviceId: session.deviceId };
  });

  app.post("/v1/session/change-password", async (request, reply) => {
    const session = await resolveSession(pool, request);
    if (!session) return reply.code(401).send({ error: "UNAUTHORIZED" });
    const input = changePasswordSchema.parse(request.body);
    const credential = await pool.query<{ password_hash: string }>("SELECT password_hash FROM user_credentials WHERE user_id = $1", [session.userId]);
    if (!credential.rows[0] || !(await bcrypt.compare(input.currentPassword, credential.rows[0].password_hash))) {
      return reply.code(401).send({ error: "INVALID_CREDENTIALS", message: "Senha atual invalida." });
    }
    await pool.query("UPDATE user_credentials SET password_hash = $1, password_changed_at = now() WHERE user_id = $2", [await bcrypt.hash(input.newPassword, 12), session.userId]);
    await pool.query("INSERT INTO server_audit_events(id, actor_user_id, device_id, action, result) VALUES ($1, $2, $3, 'PASSWORD_CHANGED', 'SUCCESS')", [randomUUID(), session.userId, session.deviceId]);
    return reply.code(204).send();
  });

  app.post("/v1/session/logout", async (request, reply) => {
    const session = await resolveSession(pool, request);
    if (!session) return reply.code(401).send({ error: "UNAUTHORIZED" });
    await pool.query("UPDATE api_sessions SET revoked_at = now() WHERE id = $1", [session.sessionId]);
    return reply.code(204).send();
  });
}
