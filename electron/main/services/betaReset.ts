import type Database from "better-sqlite3";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import type { AppDirectories } from "../../../src/shared/types/domain.js";

const RESET_MARKER_KEY = "beta_1_operational_reset_preserve_clients_v1";

const OPERATIONAL_TABLES = [
  "payable_document_attachments",
  "payable_status_history",
  "payable_payment_allocations",
  "payable_payments",
  "account_payable_allocations",
  "accounts_payable",
  "payable_installment_groups",
  "financial_report_generations",
  "deal_confirmation_document_versions",
  "deal_confirmation_status_history",
  "deal_confirmation_signers",
  "deal_payment_terms",
  "deal_confirmation_clauses",
  "deal_confirmation_fiscal_documents",
  "deal_confirmation_operations",
  "deal_confirmation_items",
  "deal_confirmation_parties",
  "deal_confirmations",
  "client_payment_allocations",
  "client_payments",
  "client_credit_allocations",
  "client_ledger_entries",
  "client_charge_adjustments",
  "client_charge_operations",
  "client_charges",
  "xml_import_files",
  "xml_import_jobs",
  "spreadsheet_import_rows",
  "spreadsheet_import_jobs",
  "fiscal_document_merge_history",
  "fiscal_document_events",
  "operations",
  "fiscal_document_items",
  "fiscal_documents",
  "document_sequences",
  "local_sessions"
];

export function runBetaOperationalResetIfNeeded(db: Database.Database, directories: AppDirectories, appVersion: string, isPackaged: boolean): boolean {
  if (!isPackaged || !appVersion.includes("beta")) return false;
  if (!tableExists(db, "app_settings")) return false;
  const marker = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(RESET_MARKER_KEY) as { value: string } | undefined;
  if (marker?.value === "done") return false;

  const now = new Date().toISOString();
  db.pragma("foreign_keys = OFF");
  try {
    db.transaction(() => {
      for (const table of OPERATIONAL_TABLES) {
        if (tableExists(db, table)) db.prepare(`DELETE FROM ${table}`).run();
      }
      db.prepare(`
        INSERT INTO app_settings (id, key, value, value_type, created_at, updated_at)
        VALUES (?, ?, 'done', 'string', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = 'done', updated_at = excluded.updated_at
      `).run(RESET_MARKER_KEY, RESET_MARKER_KEY, now, now);
    })();
  } finally {
    db.pragma("foreign_keys = ON");
  }

  resetDocumentFolders(directories);
  return true;
}

function tableExists(db: Database.Database, table: string): boolean {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function resetDocumentFolders(directories: AppDirectories): void {
  const folders = [
    directories.invoicesDir,
    directories.confirmationsDir,
    directories.chargesDir,
    directories.attachmentsDir,
    directories.accountsPayableDir,
    directories.financialReportsDir,
    directories.signedDir,
    directories.spreadsheetImportsDir,
    directories.xmlImportsDir
  ];

  for (const folder of folders) {
    if (existsSync(folder)) rmSync(folder, { recursive: true, force: true });
    mkdirSync(folder, { recursive: true });
  }
}
