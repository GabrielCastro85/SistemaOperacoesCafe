import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { loadConfig } from "../src/config.js";
import { createPool, runCentralMigrations } from "../src/database.js";

const input = z.object({ ADMIN_USERNAME: z.string().min(1), ADMIN_PASSWORD: z.string().min(10), ADMIN_DISPLAY_NAME: z.string().min(1) }).parse(process.env);
const pool = createPool(loadConfig());
await runCentralMigrations(pool);
const normalized = input.ADMIN_USERNAME.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const userId = randomUUID();
const user = await pool.query<{ id: string }>(`
  INSERT INTO app_users(id, display_name, username, normalized_username, status)
  VALUES ($1, $2, $3, $4, 'ACTIVE')
  ON CONFLICT (normalized_username) DO UPDATE SET display_name = excluded.display_name, username = excluded.username, status = 'ACTIVE', updated_at = now()
  RETURNING id
`, [userId, input.ADMIN_DISPLAY_NAME, input.ADMIN_USERNAME, normalized]);
const hash = await bcrypt.hash(input.ADMIN_PASSWORD, 12);
await pool.query(`
  INSERT INTO user_credentials(id, user_id, credential_format, password_hash)
  VALUES ($1, $2, 'bcrypt', $3)
  ON CONFLICT (user_id) DO UPDATE SET password_hash = excluded.password_hash, password_changed_at = now()
`, [randomUUID(), user.rows[0]?.id, hash]);
console.log(`Administrador central criado: ${input.ADMIN_USERNAME}`);
await pool.end();

