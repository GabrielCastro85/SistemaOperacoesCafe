const { copyFileSync, existsSync, mkdirSync, rmSync } = require("node:fs");
const { basename, dirname, join } = require("node:path");
const Database = require("better-sqlite3");

const SOURCE_DATABASE = join(
  process.env.APPDATA || "",
  "Sistema de Operacoes de Cafe Multiempresa",
  "database",
  "operations.sqlite"
);
const DEFAULT_XML = "C:\\Vulpe\\NFe\\VILLA_COFFEE_MG\\EMITIDO\\202610\\NFe\\31261044963370000523550010000014101114985352-nfe.xml";
const SANDBOX_ROOT = join(process.cwd(), ".codex-tmp", "vulpe-dry-run");
const SANDBOX_DATABASE = join(SANDBOX_ROOT, "database", "operations.sqlite");

function argument(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function directories() {
  return {
    userData: SANDBOX_ROOT,
    databaseDir: dirname(SANDBOX_DATABASE),
    databasePath: SANDBOX_DATABASE,
    documentsDir: join(SANDBOX_ROOT, "documents"),
    invoicesDir: join(SANDBOX_ROOT, "documents", "invoices"),
    confirmationsDir: join(SANDBOX_ROOT, "documents", "confirmations"),
    chargesDir: join(SANDBOX_ROOT, "documents", "charges"),
    attachmentsDir: join(SANDBOX_ROOT, "documents", "attachments"),
    accountsPayableDir: join(SANDBOX_ROOT, "documents", "accounts-payable"),
    financialReportsDir: join(SANDBOX_ROOT, "documents", "financial-reports"),
    signedDir: join(SANDBOX_ROOT, "documents", "signed"),
    spreadsheetImportsDir: join(SANDBOX_ROOT, "documents", "spreadsheet-imports"),
    xmlImportsDir: join(SANDBOX_ROOT, "documents", "invoices", "xml-imports"),
    backupsDir: join(SANDBOX_ROOT, "backups"),
    logsDir: join(SANDBOX_ROOT, "logs"),
    settingsDir: join(SANDBOX_ROOT, "settings")
  };
}

async function main() {
  const xmlPath = argument("xml", DEFAULT_XML);
  if (!existsSync(SOURCE_DATABASE)) throw new Error(`Banco de origem nao encontrado: ${SOURCE_DATABASE}`);
  if (!existsSync(xmlPath)) throw new Error(`XML da Vulpe nao encontrado: ${xmlPath}`);

  mkdirSync(dirname(SANDBOX_DATABASE), { recursive: true });
  if (existsSync(SANDBOX_DATABASE)) rmSync(SANDBOX_DATABASE, { force: true });

  const source = new Database(SOURCE_DATABASE, { readonly: true, fileMustExist: true });
  await source.backup(SANDBOX_DATABASE);
  source.close();

  const sandbox = new Database(SANDBOX_DATABASE);
  sandbox.pragma("foreign_keys = ON");
  const [{ AppRepository }, { inspectXmlFile }] = await Promise.all([
    import("../../dist-electron/electron/main/services/appRepository.js"),
    import("../../dist-electron/electron/main/services/xmlNfeService.js")
  ]);
  const repository = new AppRepository(sandbox, directories());
  const profile = repository.getInstallationProfile();
  if (!profile?.defaultOrganizationId) throw new Error("Organizacao padrao nao configurada no banco clonado.");

  const inspection = inspectXmlFile(xmlPath, "vulpe-dry-run");
  if (inspection.status === "ERROR") throw new Error(inspection.errorMessage || "Falha ao inspecionar XML.");
  const issuerCnpj = String(inspection.extractedData?.issuer?.cnpjCpf || "");
  const recipientCnpj = String(inspection.extractedData?.recipient?.cnpjCpf || "");
  const historicalPartners = sandbox.prepare(`
    SELECT f.responsible_partner_id AS id, p.display_name AS name, COUNT(*) AS uses
    FROM fiscal_documents f
    JOIN business_partners p ON p.id = f.responsible_partner_id
    WHERE f.status <> 'CANCELED'
      AND json_extract(f.fiscal_snapshot_json, '$.issuer.cnpjCpf') = ?
      AND json_extract(f.fiscal_snapshot_json, '$.recipient.cnpjCpf') = ?
    GROUP BY f.responsible_partner_id, p.display_name
    ORDER BY uses DESC
  `).all(issuerCnpj, recipientCnpj);
  const historicalPartnerId = historicalPartners.length === 1 ? historicalPartners[0].id : null;

  const draft = repository.createXmlImportDraft({
    organizationId: profile.defaultOrganizationId,
    sourceType: "FOLDER",
    selectedFolder: dirname(xmlPath),
    includeSubfolders: true,
    settings: {
      ownLegalEntityId: null,
      clientPartnerId: historicalPartnerId,
      operationType: "SALE",
      operationScope: "INTERNAL",
      productId: null,
      createOperations: false,
      reviewBeforeConfirm: true
    }
  });
  const file = repository.addXmlImportFile({
    importJobId: draft.id,
    originalFileName: inspection.originalFileName,
    fileHash: inspection.fileHash,
    fileSize: inspection.fileSize,
    xmlType: inspection.xmlType,
    accessKey: inspection.accessKey,
    status: inspection.status,
    errorCode: inspection.errorCode,
    errorMessage: inspection.errorMessage,
    warningCodes: inspection.warnings,
    extractedData: inspection.extractedData,
    resolutionData: null
  });
  repository.setXmlImportFileStoredPath(file.id, xmlPath);
  repository.validateXmlImportJob(draft.id);
  const result = await repository.executeXmlImportJob(draft.id);
  const finalFile = result.files[0];
  const fiscalDocument = finalFile?.fiscalDocumentId
    ? repository.getFiscalDocument(finalFile.fiscalDocumentId).document
    : null;

  process.stdout.write(`${JSON.stringify({
    mode: "ISOLATED_DATABASE_DRY_RUN",
    sourceDatabaseUnchanged: true,
    sandboxDatabase: SANDBOX_DATABASE,
    xml: basename(xmlPath),
    importJobStatus: result.job.status,
    historicalPartners,
    historicalPartnerApplied: historicalPartnerId !== null,
    fileStatus: finalFile?.status ?? null,
    errorCode: finalFile?.errorCode ?? null,
    errorMessage: finalFile?.errorMessage ?? null,
    createdFiscalDocument: fiscalDocument
      ? {
          id: fiscalDocument.id,
          number: fiscalDocument.documentNumber,
          accessKey: fiscalDocument.accessKey,
          issueDate: fiscalDocument.issueDate,
          totalAmountCents: fiscalDocument.totalAmountCents,
          responsiblePartnerId: fiscalDocument.responsiblePartnerId,
          status: fiscalDocument.status,
          hasPendingIssues: fiscalDocument.hasPendingIssues,
          pendingNotes: fiscalDocument.pendingNotes
        }
      : null
  }, null, 2)}\n`);
  sandbox.close();
}

main().then(() => process.exit(0)).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
