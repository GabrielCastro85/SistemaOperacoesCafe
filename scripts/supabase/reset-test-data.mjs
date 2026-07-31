/* global console, process */
// Reset pedido pelo dono pra testar o sistema do zero: mantem organizations/
// legal_entities/locations/products/app_users/roles/expense_categories, zera
// clientes/fornecedores e tudo que foi lancado em cima deles (notas,
// operacoes, cobrancas, contas a pagar, importacoes). Espelha exatamente a
// migration SQLite "030_reset_partners_and_documents" -- roda no Postgres
// (fonte compartilhada) pra nenhum PC re-sincronizar os dados antigos de
// volta depois que a migration local rodar em cada maquina. Faz um dump em
// JSON de cada tabela ANTES de apagar, como rede de seguranca.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..", "..");

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

const TABLES_TO_WIPE_IN_ORDER = [
  "business_partner_merges",
  "charge_status_history",
  "charge_document_versions",
  "client_payment_allocations",
  "client_credit_allocations",
  "client_charge_adjustments",
  "client_charge_operations",
  "payable_document_attachments",
  "payable_status_history",
  "payable_payment_allocations",
  "account_payable_operations",
  "fiscal_document_merge_history",
  "fiscal_document_events",
  "xml_import_files",
  "operations",
  "fiscal_document_items",
  "client_payments",
  "client_ledger_entries",
  "client_charges",
  "payable_payments",
  "accounts_payable",
  "fiscal_documents",
  "xml_import_jobs",
  "client_billing_profiles",
  "service_rate_rules",
  "purchase_rate_rules",
  "partner_contacts",
  "partner_legal_entities",
  "business_partner_roles",
  "business_partners"
];

async function main() {
  const env = loadEnv();
  if (!env.SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL nao configurado no .env");
  const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const dumpDir = join(projectRoot, "scripts", "supabase", "dumps");
  mkdirSync(dumpDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dumpPath = join(dumpDir, `reset-backup-${stamp}.json`);
  console.log("Fazendo dump de seguranca antes de apagar qualquer coisa...");
  const dump = {};
  for (const table of TABLES_TO_WIPE_IN_ORDER) {
    const res = await client.query(`SELECT * FROM ${table}`);
    dump[table] = res.rows;
    console.log(`  ${table}: ${res.rows.length} linha(s)`);
  }
  writeFileSync(dumpPath, JSON.stringify(dump, null, 2));
  console.log(`Dump salvo em: ${dumpPath}`);

  if (process.argv.includes("--dry-run")) {
    console.log("\n--dry-run: nada foi apagado.");
    await client.end();
    return;
  }

  console.log("\nApagando...");
  try {
    await client.query("begin");
    for (const table of TABLES_TO_WIPE_IN_ORDER) {
      const res = await client.query(`DELETE FROM ${table}`);
      console.log(`  DELETE FROM ${table}: ${res.rowCount} linha(s)`);
    }
    const seq = await client.query("UPDATE document_sequences SET current_number = 0");
    console.log(`  UPDATE document_sequences (reset contador): ${seq.rowCount} linha(s)`);
    await client.query("commit");
    console.log("\nConcluido e confirmado.");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("FALHOU, nada foi alterado (rollback):", error.message);
    process.exit(1);
  }

  await client.end();
}

main().catch((error) => {
  console.error("ERRO:", error.message);
  process.exit(1);
});
