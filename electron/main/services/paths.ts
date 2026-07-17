import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { AppDirectories } from "../../../src/shared/types/domain.js";

export function resolveAppDirectories(userData: string): AppDirectories {
  return {
    userData,
    databaseDir: join(userData, "database"),
    databasePath: join(userData, "database", "operations.sqlite"),
    documentsDir: join(userData, "documents"),
    invoicesDir: join(userData, "documents", "invoices"),
    confirmationsDir: join(userData, "documents", "confirmations"),
    chargesDir: join(userData, "documents", "charges"),
    attachmentsDir: join(userData, "documents", "attachments"),
    accountsPayableDir: join(userData, "documents", "accounts-payable"),
    financialReportsDir: join(userData, "documents", "financial-reports"),
    signedDir: join(userData, "documents", "signed"),
    spreadsheetImportsDir: join(userData, "documents", "spreadsheet-imports"),
    xmlImportsDir: join(userData, "documents", "invoices", "xml-imports"),
    backupsDir: join(userData, "backups"),
    logsDir: join(userData, "logs"),
    settingsDir: join(userData, "settings")
  };
}

export function ensureAppDirectories(directories: AppDirectories): void {
  Object.values(directories)
    .filter((value) => value !== directories.databasePath)
    .forEach((directory) => mkdirSync(directory, { recursive: true }));
}
