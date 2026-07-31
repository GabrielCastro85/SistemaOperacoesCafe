/* global console, process */
// Aplica os arquivos .sql de supabase/migrations/ em ordem, uma vez cada,
// contra o Postgres do Supabase (SUPABASE_DB_URL no .env). Mesmo espirito do
// runner de migrations do SQLite local (electron/main/database/migrations.ts):
// idempotente, registra o que ja rodou, roda cada arquivo dentro de uma
// transacao.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..", "..");
const migrationsDir = join(projectRoot, "supabase", "migrations");

function loadEnv() {
  const text = readFileSync(join(projectRoot, ".env"), "utf8");
  const env = {};
  text.split("\n").forEach((line) => {
    const idx = line.indexOf("=");
    if (idx === -1) return;
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  });
  return env;
}

async function main() {
  const env = loadEnv();
  if (!env.SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL nao configurado no .env");

  const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  await client.query(`
    create table if not exists _migration_history (
      id serial primary key,
      migration_name text not null unique,
      applied_at timestamptz not null default now()
    );
  `);

  const applied = new Set(
    (await client.query("select migration_name from _migration_history")).rows.map((row) => row.migration_name)
  );

  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  let ranCount = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip (ja aplicada): ${file}`);
      continue;
    }
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    console.log(`aplicando: ${file} ...`);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into _migration_history (migration_name) values ($1)", [file]);
      await client.query("commit");
      console.log(`  OK: ${file}`);
      ranCount += 1;
    } catch (error) {
      await client.query("rollback").catch(() => {});
      console.error(`  FALHOU: ${file}`);
      console.error(`  ${error.message}`);
      await client.end();
      process.exit(1);
    }
  }

  console.log(`\nConcluido. ${ranCount} migration(s) nova(s) aplicada(s), ${files.length - ranCount} ja estavam em dia.`);
  await client.end();
}

main().catch((error) => {
  console.error("ERRO:", error.message);
  process.exit(1);
});
