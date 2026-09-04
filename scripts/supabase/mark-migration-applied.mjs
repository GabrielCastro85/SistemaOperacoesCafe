/* global console, process */
// Uso pontual: registra em _migration_history uma migration cujos efeitos ja
// existem de fato no banco (aplicada fora do fluxo normal de
// run-migrations.mjs, por exemplo direto pelo SQL editor do Supabase), sem
// rodar o SQL dela de novo -- so' grava o registro de controle. NUNCA cria
// nem altera schema.
import { readFileSync } from "node:fs";
import pg from "pg";

const envFile = process.env.OPERACOES_CAFE_ENV_FILE || ".env";
const env = Object.fromEntries(
  readFileSync(envFile, "utf8").split("\n").filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  })
);

const migrationName = process.argv[2];
if (!migrationName) {
  console.error("uso: node scripts/supabase/mark-migration-applied.mjs <nome_do_arquivo.sql>");
  process.exit(1);
}

const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const result = await client.query(
  "insert into _migration_history (migration_name) values ($1) on conflict (migration_name) do nothing returning migration_name",
  [migrationName]
);
if (result.rows.length > 0) {
  console.log(`marcada como aplicada: ${migrationName}`);
} else {
  console.log(`ja estava marcada: ${migrationName}`);
}
await client.end();
