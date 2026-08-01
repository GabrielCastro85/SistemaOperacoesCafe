/* global console, process */
// Reset de release estavel: mantem cadastros comerciais, empresas/CNPJs,
// fornecedores, produtos, regras por saca e usuarios. Zera somente dados
// operacionais/testes (notas, XMLs, cobrancas, conta-corrente, acertos,
// confirmacoes e relatorios). Roda no Postgres compartilhado para nenhum PC
// re-sincronizar dados beta de volta. Faz dump JSON antes de apagar.
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
  "financial_report_generations",
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
  "account_payable_allocations",
  "deal_confirmation_document_versions",
  "deal_confirmation_status_history",
  "deal_payment_terms",
  "deal_confirmation_signers",
  "deal_confirmation_fiscal_documents",
  "deal_confirmation_operations",
  "deal_confirmation_clauses",
  "deal_confirmation_items",
  "deal_confirmation_parties",
  "operation_rate_history",
  "fiscal_document_merge_history",
  "fiscal_document_events",
  "xml_import_files",
  "spreadsheet_import_rows",
  "operations",
  "fiscal_document_items",
  "client_payments",
  "client_ledger_entries",
  "client_charges",
  "payable_payments",
  "accounts_payable",
  "payable_installment_groups",
  "payable_recurring_templates",
  "deal_confirmations",
  "fiscal_documents",
  "xml_import_jobs",
  "spreadsheet_import_jobs"
];

async function tableExists(client, table) {
  const result = await client.query("SELECT to_regclass($1) AS table_name", [`public.${table}`]);
  return Boolean(result.rows[0]?.table_name);
}

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
    if (!(await tableExists(client, table))) {
      dump[table] = [];
      console.log(`  ${table}: tabela ausente, pulando`);
      continue;
    }
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
    await client.query("UPDATE client_charges SET replaced_by_charge_id = NULL").catch(() => {});
    await client.query("UPDATE deal_confirmations SET replaced_by_confirmation_id = NULL").catch(() => {});
    for (const table of TABLES_TO_WIPE_IN_ORDER) {
      if (!(await tableExists(client, table))) {
        console.log(`  DELETE FROM ${table}: tabela ausente, pulando`);
        continue;
      }
      const res = await client.query(`DELETE FROM ${table}`);
      console.log(`  DELETE FROM ${table}: ${res.rowCount} linha(s)`);
    }
    const seq = await client.query("UPDATE document_sequences SET current_number = 0, updated_at = now()");
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
