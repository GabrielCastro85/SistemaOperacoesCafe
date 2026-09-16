import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { ServerConfig } from "./config.js";

const { Pool } = pg;

export function createPool(config: ServerConfig): pg.Pool {
  return new Pool({
    connectionString: config.DATABASE_URL,
    ssl: config.DATABASE_SSL ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  });
}

export async function runCentralMigrations(pool: pg.Pool): Promise<void> {
  await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, executed_at timestamptz NOT NULL DEFAULT now())");
  const directory = fileURLToPath(new URL("../migrations", import.meta.url));
  const files = readdirSync(directory).filter((name) => name.endsWith(".sql")).sort();
  for (const name of files) {
    const exists = await pool.query<{ exists: boolean }>("SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE name = $1) AS exists", [name]);
    if (exists.rows[0]?.exists) continue;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(readFileSync(join(directory, name), "utf8"));
      await client.query("INSERT INTO schema_migrations(name) VALUES ($1)", [name]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

