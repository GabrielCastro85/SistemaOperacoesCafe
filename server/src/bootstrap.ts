import { randomUUID, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { z } from "zod";
import type { ServerConfig } from "./config.js";

const setupSchema = z.object({
  username: z.string().trim().min(3).max(100),
  displayName: z.string().trim().min(2).max(200),
  password: z.string().min(8).max(200),
  email: z.string().trim().email().optional()
});

const resetPasswordSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200)
});

const normalizeUsername = (value: string) => value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function secretsMatch(received: string | undefined, expected: string | undefined): boolean {
  if (!received || !expected) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function registerBootstrapRoutes(app: FastifyInstance, pool: pg.Pool, config: ServerConfig): void {
  app.get("/v1/bootstrap/status", async () => {
    const result = await pool.query<{ total: string }>("SELECT COUNT(*)::text AS total FROM app_users");
    return { needsSetup: Number(result.rows[0]?.total ?? 0) === 0 };
  });

  app.post("/v1/bootstrap/admin", async (request, reply) => {
    if (!secretsMatch(request.headers["x-bootstrap-secret"] as string | undefined, config.BOOTSTRAP_SECRET)) {
      return reply.code(404).send({ error: "NOT_FOUND" });
    }
    const input = setupSchema.parse(request.body);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("LOCK TABLE app_users IN EXCLUSIVE MODE");
      const existing = await client.query("SELECT 1 FROM app_users LIMIT 1");
      if (existing.rowCount) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ error: "ALREADY_CONFIGURED", message: "O administrador inicial ja foi criado." });
      }
      const userId = randomUUID();
      await client.query(`
        INSERT INTO app_users(id, display_name, username, normalized_username, email, status)
        VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
      `, [userId, input.displayName, input.username, normalizeUsername(input.username), input.email ?? null]);
      await client.query(`
        INSERT INTO user_credentials(id, user_id, password_hash)
        VALUES ($1, $2, $3)
      `, [randomUUID(), userId, await bcrypt.hash(input.password, 12)]);
      await client.query(`
        INSERT INTO server_audit_events(id, actor_user_id, action, entity_type, entity_id, result)
        VALUES ($1, $2, 'BOOTSTRAP_ADMIN', 'app_user', $3, 'SUCCESS')
      `, [randomUUID(), userId, userId]);
      await client.query("COMMIT");
      return reply.code(201).send({ user: { id: userId, username: input.username, displayName: input.displayName } });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.post("/v1/bootstrap/reset-password", async (request, reply) => {
    if (!secretsMatch(request.headers["x-bootstrap-secret"] as string | undefined, config.BOOTSTRAP_SECRET)) {
      return reply.code(404).send({ error: "NOT_FOUND" });
    }

    const input = resetPasswordSchema.parse(request.body);
    const normalizedUsername = normalizeUsername(input.username);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const user = await client.query<{ id: string }>(
        "SELECT id FROM app_users WHERE normalized_username = $1 FOR UPDATE",
        [normalizedUsername]
      );
      const userId = user.rows[0]?.id;
      if (!userId) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ error: "USER_NOT_FOUND", message: "Usuario nao encontrado." });
      }

      await client.query(`
        INSERT INTO user_credentials(id, user_id, credential_format, password_hash, password_changed_at)
        VALUES ($1, $2, 'bcrypt', $3, now())
        ON CONFLICT (user_id) DO UPDATE
        SET credential_format = 'bcrypt', password_hash = excluded.password_hash, password_changed_at = now()
      `, [randomUUID(), userId, await bcrypt.hash(input.password, 12)]);
      await client.query("UPDATE app_users SET status = 'ACTIVE', failed_login_attempts = 0, locked_at = NULL, updated_at = now() WHERE id = $1", [userId]);
      await client.query("UPDATE api_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
      await client.query(`
        INSERT INTO server_audit_events(id, actor_user_id, action, entity_type, entity_id, result)
        VALUES ($1, $2, 'BOOTSTRAP_PASSWORD_RESET', 'app_user', $3, 'SUCCESS')
      `, [randomUUID(), userId, userId]);
      await client.query("COMMIT");
      return { success: true };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
}
