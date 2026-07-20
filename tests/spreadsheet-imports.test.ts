import ExcelJS from "exceljs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { AppRepository } from "../electron/main/services/appRepository";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";
import { inspectWorkbook, previewSheet, readSheetRows, validateSpreadsheetPath } from "../electron/main/services/spreadsheetService";

const tempDirs: string[] = [];
const villaId = "11111111-1111-4111-8111-111111111111";
const ownLegalEntityId = "33333333-3333-4333-8333-333333333331";

function setup(): { repo: AppRepository; db: ReturnType<typeof initializeDatabase>; partnerId: string; productId: string } {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-step5-"));
  tempDirs.push(userData);
  const dirs = resolveAppDirectories(userData);
  ensureAppDirectories(dirs);
  const db = initializeDatabase(dirs);
  const repo = new AppRepository(db);
  repo.saveInstallationProfile({
    installationName: "Villa",
    appVariant: "villa",
    defaultOrganizationId: villaId,
    defaultLegalEntityId: ownLegalEntityId,
    allowOrganizationSwitch: false,
    allowLegalEntitySwitch: true,
    completedSetup: true
  });
  const partner = repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Importado", notes: null, roles: ["CLIENT"], isActive: true });
  const product = repo.listProducts({ organizationId: villaId })[0];
  repo.createServiceRateRule({
    organizationId: villaId,
    businessPartnerId: partner.id,
    ownLegalEntityId: null,
    productId: product.id,
    operationScope: "EXTERNAL",
    rateType: "PER_SACK",
    rateValueCents: 600,
    effectiveFrom: "2026-07-01",
    effectiveTo: null,
    priority: 10,
    notes: null,
    isActive: true
  });
  return { repo, db, partnerId: partner.id, productId: product.id };
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe("spreadsheet imports", () => {
  it("inspects, previews and reads xlsx rows while ignoring total rows", async () => {
    const dir = mkdtempSync(join(tmpdir(), "operacoes-xlsx-"));
    tempDirs.push(dir);
    const filePath = join(dir, "historico.xlsx");
    await writeWorkbook(filePath);

    validateSpreadsheetPath(filePath);
    await expect(() => validateSpreadsheetPath(join(dir, "historico.csv"))).toThrow(/xlsx/);

    const workbook = await inspectWorkbook(filePath, "token-1");
    expect(workbook.fileName).toBe("historico.xlsx");
    expect(workbook.sheets).toEqual(expect.arrayContaining([expect.objectContaining({ name: "Vendas" })]));

    const preview = await previewSheet(filePath, "Vendas", 1);
    expect(preview.suggestedMapping).toMatchObject({ documentNumber: "NF", sacks: "Sacas", clientName: "Cliente" });
    expect(preview.rows[0]).toMatchObject({ NF: "9001", Sacas: "10.5" });

    const rows = await readSheetRows(filePath, "Vendas", 1);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.rowNumber)).toEqual([2, 3]);
  });

  it("creates aliases, imports grouped rows and reverts imported documents", () => {
    const { repo, db, partnerId, productId } = setup();
    const alias = repo.createPartnerAlias({ organizationId: villaId, businessPartnerId: partnerId, partnerLegalEntityId: null, alias: "Cliente XYZ Ltda", source: "planilha", isActive: true });
    expect(repo.resolvePartnerAlias(villaId, "cliente xyz ltda")?.id).toBe(alias.id);
    expect(() => repo.createPartnerAlias({ organizationId: villaId, businessPartnerId: partnerId, partnerLegalEntityId: null, alias: "Cliente XYZ Ltda", source: "planilha", isActive: true })).toThrow(/Alias ativo/);

    const job = repo.createSpreadsheetImportDraft({
      organizationId: villaId,
      ownLegalEntityId,
      mappingTemplateId: null,
      originalFileName: "historico.xlsx",
      storedFilePath: null,
      selectedSheetName: "Vendas",
      importType: "GENERAL_SALES",
      settings: { defaultPartnerId: partnerId, operationType: "SALE", defaultOperationScope: "EXTERNAL", defaultProductId: productId }
    });
    repo.addSpreadsheetImportRow({ importJobId: job.id, sheetName: "Vendas", sourceRowNumber: 2, rawData: { NF: "9001" }, normalizedData: normalizedRow(partnerId, productId, "9001", "10.5"), status: "VALID", errorCode: null, errorMessage: null, warningCodes: [] });
    repo.addSpreadsheetImportRow({ importJobId: job.id, sheetName: "Vendas", sourceRowNumber: 3, rawData: { NF: "9001" }, normalizedData: normalizedRow(partnerId, productId, "9001", "2.25"), status: "VALID", errorCode: null, errorMessage: null, warningCodes: [] });

    const imported = repo.executeSpreadsheetImport(job.id);
    expect(imported.job.status).toBe("COMPLETED");
    expect(imported.job.importedRows).toBe(2);
    const documentIds = new Set(imported.rows.map((row) => row.fiscalDocumentId));
    expect(documentIds.size).toBe(1);
    const detail = repo.getFiscalDocument(imported.rows[0].fiscalDocumentId as string);
    expect(detail.items).toHaveLength(2);
    expect(detail.operations.map((operation) => operation.serviceAmountCents)).toEqual([6300, 1350]);

    const reverted = repo.revertSpreadsheetImportJob(job.id, "Carga historica incorreta");
    expect(reverted.job.status).toBe("REVERTED");
    expect(reverted.rows.every((row) => row.status === "REVERTED")).toBe(true);
    expect(repo.getFiscalDocument(detail.document.id).document.status).toBe("CANCELED");
    db.close();
  });

  it("imports a row with no notes column (empty string, not null) instead of failing validation", () => {
    // Real-world spreadsheets rarely have a "notes"/"observacoes" column; normalizeSpreadsheetRow
    // (electron/main/ipc/handlers.ts) always sets notes to pick("notes"), which is "" when absent -
    // not null/undefined. addOperation's notes field previously used `??`, which does not treat ""
    // as missing, so it hit nullableText's z.string().min(1) and every such row failed with
    // "String must contain at least 1 character(s)".
    const { repo, db, partnerId, productId } = setup();
    const job = repo.createSpreadsheetImportDraft({
      organizationId: villaId,
      ownLegalEntityId,
      mappingTemplateId: null,
      originalFileName: "vendas-sem-notas.xlsx",
      storedFilePath: null,
      selectedSheetName: "DADOS",
      importType: "GENERAL_SALES",
      settings: { defaultPartnerId: partnerId, operationType: "SALE", defaultOperationScope: "EXTERNAL", defaultProductId: productId }
    });
    repo.addSpreadsheetImportRow({ importJobId: job.id, sheetName: "DADOS", sourceRowNumber: 2, rawData: { NF: "4820" }, normalizedData: { ...normalizedRow(partnerId, productId, "4820", "350"), notes: "" }, status: "VALID", errorCode: null, errorMessage: null, warningCodes: [] });

    const imported = repo.executeSpreadsheetImport(job.id);
    expect(imported.job.importedRows).toBe(1);
    expect(imported.job.errorRows).toBe(0);
    expect(imported.rows[0].status).toBe("IMPORTED");
    const detail = repo.getFiscalDocument(imported.rows[0].fiscalDocumentId as string);
    expect(detail.operations[0].notes).toBeNull();
    db.close();
  });
});

async function writeWorkbook(filePath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Vendas");
  sheet.addRow(["Data", "Cliente", "NF", "Sacas", "Interno/Externo", "Preco"]);
  sheet.addRow(["16/07/2026", "Cliente XYZ Ltda", "9001", "10.5", "Externo", "1234,5678"]);
  sheet.addRow(["16/07/2026", "Cliente XYZ Ltda", "9002", "2.25", "Externo", "987,6543"]);
  sheet.addRow(["TOTAL", "", "", "", "", ""]);
  await workbook.xlsx.writeFile(filePath);
}

function normalizedRow(partnerId: string, productId: string, documentNumber: string, sacks: string): Record<string, string> {
  return {
    date: "2026-07-16",
    sacks,
    documentNumber,
    clientPartnerId: partnerId,
    operationScope: "EXTERNAL",
    productId,
    series: "1",
    commercialUnitPrice: "1234.5678",
    totalAmountCents: "100000",
    notes: "Linha importada"
  };
}
