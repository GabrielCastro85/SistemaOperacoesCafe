import { dialog, type IpcMain } from "electron";
import { z } from "zod";
import { brandingAssetKindSchema, businessPartnerRoleSchema } from "../../../src/shared/schemas/domainSchemas.js";
import { IPC_CHANNELS } from "../../../src/shared/ipc/channels.js";
import type { BrandingAssetKind } from "../../../src/shared/types/domain.js";
import type { Diagnostics } from "../../../src/shared/types/domain.js";
import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { randomUUID } from "node:crypto";
import { getCurrentMigration } from "../database/database.js";
import type { AppRepository } from "../services/appRepository.js";
import { copyBrandingAssetFromPath, getBrandingDialogFilters } from "../services/brandingAssets.js";
import type { AppContext } from "../services/context.js";
import { inspectWorkbook, previewSheet, readSheetRows, validateSpreadsheetPath } from "../services/spreadsheetService.js";
import { multiplyDecimalByCents } from "../../../src/shared/utils/decimal.js";
import { inspectXmlFile, safeXmlTargetName } from "../services/xmlNfeService.js";

const spreadsheetTokens = new Map<string, string>();
const xmlTokens = new Map<string, string>();

export function createDiagnostics(context: AppContext, repository: AppRepository): Diagnostics {
  const profile = repository.getInstallationProfile();
  const bootstrap = repository.getBootstrapData(context.version);
  const organization = bootstrap.organizations.find((item) => item.id === profile?.defaultOrganizationId);
  const legalEntity = bootstrap.legalEntities.find((item) => item.id === profile?.defaultLegalEntityId);
  return {
    appVersion: context.version,
    databasePath: context.directories.databasePath,
    documentsPath: context.directories.documentsDir,
    activeVariant: profile?.appVariant ?? null,
    activeOrganization: organization?.displayName ?? null,
    activeLegalEntity: legalEntity?.tradeName ?? null,
    currentMigration: getCurrentMigration(context.db),
    databaseStatus: "ok"
  };
}

export function registerIpcHandlers(ipcMain: IpcMain, context: AppContext, repository: AppRepository): void {
  ipcMain.handle(IPC_CHANNELS.getBootstrapData, () => repository.getBootstrapData(context.version));
  ipcMain.handle(IPC_CHANNELS.saveInstallationProfile, (_event, payload: unknown) => repository.saveInstallationProfile(payload));
  ipcMain.handle(IPC_CHANNELS.updateInstallationProfile, (_event, payload: unknown) => repository.updateInstallationProfile(payload));
  ipcMain.handle(IPC_CHANNELS.getActiveContext, () => repository.getActiveContext());
  ipcMain.handle(IPC_CHANNELS.getDiagnostics, () => createDiagnostics(context, repository));
  ipcMain.handle(IPC_CHANNELS.setActiveLegalEntity, (_event, payload: unknown) => {
    const legalEntityId = z.string().uuid().parse(payload);
    return repository.setActiveLegalEntity(legalEntityId);
  });
  ipcMain.handle(IPC_CHANNELS.setActiveOrganization, (_event, payload: unknown) => {
    const organizationId = z.string().uuid().parse(payload);
    return repository.setActiveOrganization(organizationId);
  });
  ipcMain.handle(IPC_CHANNELS.listOrganizations, (_event, payload: unknown) =>
    repository.listOrganizations(z.object({ search: z.string().optional(), status: z.enum(["active", "inactive", "all"]).optional() }).optional().parse(payload) ?? {})
  );
  ipcMain.handle(IPC_CHANNELS.getOrganization, (_event, payload: unknown) => repository.getOrganization(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.createOrganization, (_event, payload: unknown) => repository.createOrganization(payload));
  ipcMain.handle(IPC_CHANNELS.updateOrganization, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateOrganization(data.id, data.input);
  });
  ipcMain.handle(IPC_CHANNELS.activateOrganization, (_event, payload: unknown) => repository.activateOrganization(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.deactivateOrganization, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), replacementOrganizationId: z.string().uuid().optional() }).parse(payload);
    return repository.deactivateOrganization(data.id, data.replacementOrganizationId);
  });
  ipcMain.handle(IPC_CHANNELS.selectOrganizationBrandingAsset, async (_event, payload: unknown) => {
    const data = z.object({ organizationId: z.string().uuid(), kind: brandingAssetKindSchema }).parse(payload);
    const result = await dialog.showOpenDialog({ properties: ["openFile"], filters: getBrandingDialogFilters() });
    if (result.canceled || !result.filePaths[0]) {
      return repository.getOrganization(data.organizationId);
    }
    const copiedPath = copyBrandingAssetFromPath(context.directories, data.organizationId, data.kind as BrandingAssetKind, result.filePaths[0]);
    const field = data.kind === "logo" ? "logoPath" : data.kind === "compactLogo" ? "compactLogoPath" : "iconPath";
    return repository.updateOrganizationBranding(data.organizationId, { [field]: copiedPath });
  });
  ipcMain.handle(IPC_CHANNELS.listLegalEntities, (_event, payload: unknown) =>
    repository.listLegalEntities(
      z
        .object({
          search: z.string().optional(),
          organizationId: z.string().uuid().optional(),
          state: z.string().optional(),
          status: z.enum(["active", "inactive", "all"]).optional()
        })
        .optional()
        .parse(payload) ?? {}
    )
  );
  ipcMain.handle(IPC_CHANNELS.getLegalEntity, (_event, payload: unknown) => repository.getLegalEntity(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.createLegalEntity, (_event, payload: unknown) => repository.createLegalEntity(payload));
  ipcMain.handle(IPC_CHANNELS.updateLegalEntity, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateLegalEntity(data.id, data.input);
  });
  ipcMain.handle(IPC_CHANNELS.activateLegalEntity, (_event, payload: unknown) => repository.activateLegalEntity(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.deactivateLegalEntity, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), replacementLegalEntityId: z.string().uuid().optional() }).parse(payload);
    return repository.deactivateLegalEntity(data.id, data.replacementLegalEntityId);
  });
  ipcMain.handle(IPC_CHANNELS.listLocations, (_event, payload: unknown) =>
    repository.listLocations(
      z
        .object({
          search: z.string().optional(),
          organizationId: z.string().uuid().optional(),
          legalEntityId: z.string().uuid().optional(),
          type: z.string().optional(),
          status: z.enum(["active", "inactive", "all"]).optional()
        })
        .optional()
        .parse(payload) ?? {}
    )
  );
  ipcMain.handle(IPC_CHANNELS.getLocation, (_event, payload: unknown) => repository.getLocation(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.createLocation, (_event, payload: unknown) => repository.createLocation(payload));
  ipcMain.handle(IPC_CHANNELS.updateLocation, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateLocation(data.id, data.input);
  });
  ipcMain.handle(IPC_CHANNELS.activateLocation, (_event, payload: unknown) => repository.activateLocation(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.deactivateLocation, (_event, payload: unknown) => repository.deactivateLocation(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.listBusinessPartners, (_event, payload: unknown) =>
    repository.listBusinessPartners(z.object({ search: z.string().optional(), role: businessPartnerRoleSchema.optional(), organizationId: z.string().uuid().optional(), status: z.enum(["active", "inactive", "all"]).optional() }).optional().parse(payload) ?? {})
  );
  ipcMain.handle(IPC_CHANNELS.getBusinessPartner, (_event, payload: unknown) => repository.getBusinessPartner(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.createBusinessPartner, (_event, payload: unknown) => repository.createBusinessPartner(payload));
  ipcMain.handle(IPC_CHANNELS.updateBusinessPartner, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateBusinessPartner(data.id, data.input);
  });
  ipcMain.handle(IPC_CHANNELS.activateBusinessPartner, (_event, payload: unknown) => repository.activateBusinessPartner(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.deactivateBusinessPartner, (_event, payload: unknown) => repository.deactivateBusinessPartner(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.addBusinessPartnerRole, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), role: businessPartnerRoleSchema }).parse(payload);
    return repository.addBusinessPartnerRole(data.id, data.role);
  });
  ipcMain.handle(IPC_CHANNELS.removeBusinessPartnerRole, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), role: businessPartnerRoleSchema }).parse(payload);
    return repository.removeBusinessPartnerRole(data.id, data.role);
  });
  ipcMain.handle(IPC_CHANNELS.listPartnerLegalEntities, (_event, payload: unknown) => repository.listPartnerLegalEntities(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.createPartnerLegalEntity, (_event, payload: unknown) => repository.createPartnerLegalEntity(payload));
  ipcMain.handle(IPC_CHANNELS.updatePartnerLegalEntity, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updatePartnerLegalEntity(data.id, data.input);
  });
  ipcMain.handle(IPC_CHANNELS.activatePartnerLegalEntity, (_event, payload: unknown) => repository.activatePartnerLegalEntity(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.deactivatePartnerLegalEntity, (_event, payload: unknown) => repository.deactivatePartnerLegalEntity(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.listPartnerContacts, (_event, payload: unknown) => repository.listPartnerContacts(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.createPartnerContact, (_event, payload: unknown) => repository.createPartnerContact(payload));
  ipcMain.handle(IPC_CHANNELS.updatePartnerContact, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updatePartnerContact(data.id, data.input);
  });
  ipcMain.handle(IPC_CHANNELS.activatePartnerContact, (_event, payload: unknown) => repository.activatePartnerContact(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.deactivatePartnerContact, (_event, payload: unknown) => repository.deactivatePartnerContact(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.listProducts, (_event, payload: unknown) =>
    repository.listProducts(z.object({ search: z.string().optional(), organizationId: z.string().uuid().optional(), category: z.string().optional(), status: z.enum(["active", "inactive", "all"]).optional() }).optional().parse(payload) ?? {})
  );
  ipcMain.handle(IPC_CHANNELS.getProduct, (_event, payload: unknown) => repository.getProduct(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.createProduct, (_event, payload: unknown) => repository.createProduct(payload));
  ipcMain.handle(IPC_CHANNELS.updateProduct, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateProduct(data.id, data.input);
  });
  ipcMain.handle(IPC_CHANNELS.activateProduct, (_event, payload: unknown) => repository.activateProduct(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.deactivateProduct, (_event, payload: unknown) => repository.deactivateProduct(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.getBillingProfile, (_event, payload: unknown) => repository.getBillingProfile(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.upsertBillingProfile, (_event, payload: unknown) => repository.upsertBillingProfile(payload));
  ipcMain.handle(IPC_CHANNELS.activateBillingProfile, (_event, payload: unknown) => repository.activateBillingProfile(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.deactivateBillingProfile, (_event, payload: unknown) => repository.deactivateBillingProfile(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.listServiceRateRules, (_event, payload: unknown) =>
    repository.listServiceRateRules(z.object({ businessPartnerId: z.string().uuid().optional(), organizationId: z.string().uuid().optional(), operationScope: z.string().optional(), productId: z.string().uuid().optional(), ownLegalEntityId: z.string().uuid().optional(), status: z.enum(["active", "inactive", "all"]).optional() }).optional().parse(payload) ?? {})
  );
  ipcMain.handle(IPC_CHANNELS.getServiceRateRule, (_event, payload: unknown) => repository.getServiceRateRule(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.createServiceRateRule, (_event, payload: unknown) => repository.createServiceRateRule(payload));
  ipcMain.handle(IPC_CHANNELS.updateServiceRateRule, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateServiceRateRule(data.id, data.input);
  });
  ipcMain.handle(IPC_CHANNELS.activateServiceRateRule, (_event, payload: unknown) => repository.activateServiceRateRule(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.deactivateServiceRateRule, (_event, payload: unknown) => repository.deactivateServiceRateRule(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.resolveServiceRateRule, (_event, payload: unknown) => repository.resolveServiceRateRule(payload));
  ipcMain.handle(IPC_CHANNELS.listFiscalDocuments, (_event, payload: unknown) =>
    repository.listFiscalDocuments(
      z
        .object({
          organizationId: z.string().uuid().optional(),
          search: z.string().optional(),
          status: z.enum(["DRAFT", "PENDING", "CONFIRMED", "CANCELED", "all"]).optional()
        })
        .optional()
        .parse(payload) ?? {}
    )
  );
  ipcMain.handle(IPC_CHANNELS.getFiscalDocument, (_event, payload: unknown) => repository.getFiscalDocument(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.createFiscalDocument, (_event, payload: unknown) => repository.createFiscalDocument(payload));
  ipcMain.handle(IPC_CHANNELS.updateFiscalDocument, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateFiscalDocument(data.id, data.input);
  });
  ipcMain.handle(IPC_CHANNELS.addFiscalDocumentItem, (_event, payload: unknown) => repository.addFiscalDocumentItem(payload));
  ipcMain.handle(IPC_CHANNELS.addOperation, (_event, payload: unknown) => repository.addOperation(payload));
  ipcMain.handle(IPC_CHANNELS.updateOperationManualRate, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), manualRateValueCents: z.number().int().min(0), reason: z.string().min(1) }).parse(payload);
    return repository.updateOperationManualRate(data.id, data.manualRateValueCents, data.reason);
  });
  ipcMain.handle(IPC_CHANNELS.confirmFiscalDocument, (_event, payload: unknown) => repository.confirmFiscalDocument(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.cancelFiscalDocument, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), reason: z.string().min(1) }).parse(payload);
    return repository.cancelFiscalDocument(data.id, data.reason);
  });
  ipcMain.handle(IPC_CHANNELS.getOperationalIndicators, (_event, payload: unknown) => repository.getOperationalIndicators(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.selectSpreadsheetFile, async () => {
    const result = await dialog.showOpenDialog({ properties: ["openFile"], filters: [{ name: "Planilhas Excel", extensions: ["xlsx"] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    validateSpreadsheetPath(result.filePaths[0]);
    const token = randomUUID();
    spreadsheetTokens.set(token, result.filePaths[0]);
    return inspectWorkbook(result.filePaths[0], token);
  });
  ipcMain.handle(IPC_CHANNELS.inspectSpreadsheetWorkbook, (_event, payload: unknown) => {
    const token = z.string().uuid().parse(payload);
    const filePath = spreadsheetTokens.get(token);
    if (!filePath) throw new Error("Arquivo temporario nao encontrado.");
    return inspectWorkbook(filePath, token);
  });
  ipcMain.handle(IPC_CHANNELS.previewSpreadsheetSheet, (_event, payload: unknown) => {
    const data = z.object({ token: z.string().uuid(), sheetName: z.string().min(1), headerRow: z.number().int().min(1) }).parse(payload);
    const filePath = spreadsheetTokens.get(data.token);
    if (!filePath) throw new Error("Arquivo temporario nao encontrado.");
    return previewSheet(filePath, data.sheetName, data.headerRow);
  });
  ipcMain.handle(IPC_CHANNELS.listSpreadsheetMappingTemplates, (_event, payload: unknown) => repository.listSpreadsheetMappingTemplates(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.createSpreadsheetMappingTemplate, (_event, payload: unknown) => repository.createSpreadsheetMappingTemplate(payload));
  ipcMain.handle(IPC_CHANNELS.updateSpreadsheetMappingTemplate, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateSpreadsheetMappingTemplate(data.id, data.input);
  });
  ipcMain.handle(IPC_CHANNELS.duplicateSpreadsheetMappingTemplate, (_event, payload: unknown) => repository.duplicateSpreadsheetMappingTemplate(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.activateSpreadsheetMappingTemplate, (_event, payload: unknown) => repository.activateSpreadsheetMappingTemplate(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.deactivateSpreadsheetMappingTemplate, (_event, payload: unknown) => repository.deactivateSpreadsheetMappingTemplate(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.createSpreadsheetImportDraft, (_event, payload: unknown) => repository.createSpreadsheetImportDraft(payload));
  ipcMain.handle(IPC_CHANNELS.validateSpreadsheetImportRows, async (_event, payload: unknown) => {
    const data = z.object({
      token: z.string().uuid(),
      jobId: z.string().uuid(),
      sheetName: z.string().min(1),
      headerRow: z.number().int().min(1),
      mapping: z.record(z.string(), z.string()),
      defaults: z.record(z.string(), z.unknown())
    }).parse(payload);
    const filePath = spreadsheetTokens.get(data.token);
    if (!filePath) throw new Error("Arquivo temporario nao encontrado.");
    const rows = await readSheetRows(filePath, data.sheetName, data.headerRow);
    rows.forEach((row) => {
      const normalized = normalizeSpreadsheetRow(row.data, data.mapping, data.defaults);
      repository.addSpreadsheetImportRow({
        importJobId: data.jobId,
        sheetName: data.sheetName,
        sourceRowNumber: row.rowNumber,
        rawData: row.data,
        normalizedData: normalized.data,
        status: normalized.status,
        errorCode: normalized.errorCode,
        errorMessage: normalized.errorMessage,
        warningCodes: normalized.warningCodes
      });
    });
    return repository.getSpreadsheetImportJob(data.jobId);
  });
  ipcMain.handle(IPC_CHANNELS.executeSpreadsheetImport, (_event, payload: unknown) => {
    const data = z.object({ jobId: z.string().uuid(), token: z.string().uuid().optional(), importWarnings: z.boolean().optional() }).parse(payload);
    const filePath = data.token ? spreadsheetTokens.get(data.token) : undefined;
    if (filePath) {
      const targetDir = join(context.directories.spreadsheetImportsDir, data.jobId);
      mkdirSync(targetDir, { recursive: true });
      const targetPath = join(targetDir, basename(filePath));
      copyFileSync(filePath, targetPath);
      repository.setSpreadsheetImportStoredFilePath(data.jobId, targetPath);
    }
    return repository.executeSpreadsheetImport(data.jobId, { importWarnings: data.importWarnings });
  });
  ipcMain.handle(IPC_CHANNELS.getSpreadsheetImportJob, (_event, payload: unknown) => repository.getSpreadsheetImportJob(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.listSpreadsheetImportJobs, (_event, payload: unknown) => repository.listSpreadsheetImportJobs(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.cancelSpreadsheetImportJob, (_event, payload: unknown) => repository.cancelSpreadsheetImportJob(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.revertSpreadsheetImportJob, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), reason: z.string().min(1) }).parse(payload);
    return repository.revertSpreadsheetImportJob(data.id, data.reason);
  });
  ipcMain.handle(IPC_CHANNELS.listPartnerAliases, (_event, payload: unknown) => repository.listPartnerAliases(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.createPartnerAlias, (_event, payload: unknown) => repository.createPartnerAlias(payload));
  ipcMain.handle(IPC_CHANNELS.deactivatePartnerAlias, (_event, payload: unknown) => repository.deactivatePartnerAlias(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.resolvePartnerAlias, (_event, payload: unknown) => {
    const data = z.object({ organizationId: z.string().uuid(), value: z.string().min(1) }).parse(payload);
    return repository.resolvePartnerAlias(data.organizationId, data.value);
  });
  ipcMain.handle(IPC_CHANNELS.selectXmlFile, async () => {
    const result = await dialog.showOpenDialog({ properties: ["openFile"], filters: [{ name: "XML NF-e", extensions: ["xml"] }] });
    if (result.canceled || !result.filePaths[0]) return [];
    return registerXmlPaths(result.filePaths);
  });
  ipcMain.handle(IPC_CHANNELS.selectXmlFiles, async () => {
    const result = await dialog.showOpenDialog({ properties: ["openFile", "multiSelections"], filters: [{ name: "XML NF-e", extensions: ["xml"] }] });
    if (result.canceled) return [];
    return registerXmlPaths(result.filePaths);
  });
  ipcMain.handle(IPC_CHANNELS.selectXmlFolder, async (_event, payload: unknown) => {
    const data = z.object({ includeSubfolders: z.boolean().optional() }).optional().parse(payload) ?? {};
    const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (result.canceled || !result.filePaths[0]) return { folder: null, files: [] };
    const files = findXmlFiles(result.filePaths[0], data.includeSubfolders === true);
    return { folder: result.filePaths[0], files: registerXmlPaths(files) };
  });
  ipcMain.handle(IPC_CHANNELS.inspectXmlFiles, (_event, payload: unknown) => {
    const tokens = z.array(z.string().uuid()).parse(payload);
    return tokens.map((token) => {
      const filePath = xmlTokens.get(token);
      if (!filePath) throw new Error("Arquivo XML temporario nao encontrado.");
      return inspectXmlFile(filePath, token);
    });
  });
  ipcMain.handle(IPC_CHANNELS.createXmlImportDraft, (_event, payload: unknown) => repository.createXmlImportDraft(payload));
  ipcMain.handle(IPC_CHANNELS.addXmlImportFiles, (_event, payload: unknown) => {
    const data = z.object({ jobId: z.string().uuid(), tokens: z.array(z.string().uuid()) }).parse(payload);
    data.tokens.forEach((token) => {
      const filePath = xmlTokens.get(token);
      if (!filePath) throw new Error("Arquivo XML temporario nao encontrado.");
      const inspection = inspectXmlFile(filePath, token);
      repository.addXmlImportFile({
        importJobId: data.jobId,
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
    });
    return repository.getXmlImportJob(data.jobId);
  });
  ipcMain.handle(IPC_CHANNELS.updateXmlImportSettings, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), settings: z.record(z.string(), z.unknown()) }).parse(payload);
    return repository.updateXmlImportSettings(data.id, data.settings);
  });
  ipcMain.handle(IPC_CHANNELS.validateXmlImportJob, (_event, payload: unknown) => repository.validateXmlImportJob(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.updateXmlImportFileResolution, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), resolution: z.unknown() }).parse(payload);
    return repository.updateXmlImportFileResolution(data.id, data.resolution);
  });
  ipcMain.handle(IPC_CHANNELS.applyXmlBulkResolution, (_event, payload: unknown) => {
    const data = z.object({ jobId: z.string().uuid(), fileIds: z.array(z.string().uuid()), resolution: z.unknown() }).parse(payload);
    return repository.applyXmlBulkResolution(data.jobId, data.fileIds, data.resolution);
  });
  ipcMain.handle(IPC_CHANNELS.executeXmlImportJob, (_event, payload: unknown) => {
    const data = z.object({ jobId: z.string().uuid(), tokens: z.array(z.string().uuid()).optional() }).parse(payload);
    const details = repository.getXmlImportJob(data.jobId);
    const filesByHash = new Map(details.files.map((file) => [file.fileHash, file]));
    (data.tokens ?? []).forEach((token) => {
      const filePath = xmlTokens.get(token);
      if (!filePath) return;
      const inspection = inspectXmlFile(filePath, token);
      const file = filesByHash.get(inspection.fileHash);
      if (!file) return;
      const targetDir = join(context.directories.xmlImportsDir, data.jobId);
      mkdirSync(targetDir, { recursive: true });
      const targetPath = join(targetDir, safeXmlTargetName(inspection));
      copyFileSync(filePath, targetPath);
      repository.setXmlImportFileStoredPath(file.id, targetPath);
    });
    return repository.executeXmlImportJob(data.jobId);
  });
  ipcMain.handle(IPC_CHANNELS.getXmlImportJobProgress, (_event, payload: unknown) => repository.getXmlImportJobProgress(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.listXmlImportJobs, (_event, payload: unknown) => repository.listXmlImportJobs(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.getXmlImportJob, (_event, payload: unknown) => repository.getXmlImportJob(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.cancelXmlImportJob, (_event, payload: unknown) => repository.cancelXmlImportJob(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.revertXmlImportJob, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), reason: z.string().min(1) }).parse(payload);
    return repository.revertXmlImportJob(data.id, data.reason);
  });
  ipcMain.handle(IPC_CHANNELS.listFiscalDocumentEvents, (_event, payload: unknown) => repository.listFiscalDocumentEvents(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.getFiscalDocumentEvent, (_event, payload: unknown) => repository.getFiscalDocumentEvent(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.linkPendingFiscalDocumentEvents, (_event, payload: unknown) => repository.linkPendingFiscalDocumentEvents(z.string().regex(/^\d{44}$/).parse(payload)));
  ipcMain.handle(IPC_CHANNELS.listProductAliases, (_event, payload: unknown) => repository.listProductAliases(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.createProductAlias, (_event, payload: unknown) => repository.createProductAlias(payload));
  ipcMain.handle(IPC_CHANNELS.updateProductAlias, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateProductAlias(data.id, data.input);
  });
  ipcMain.handle(IPC_CHANNELS.activateProductAlias, (_event, payload: unknown) => repository.activateProductAlias(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.deactivateProductAlias, (_event, payload: unknown) => repository.deactivateProductAlias(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.resolveProductAlias, (_event, payload: unknown) => {
    const data = z.object({ organizationId: z.string().uuid(), criteria: z.object({ issuerPartnerLegalEntityId: z.string().uuid().nullable().optional(), sourceProductCode: z.string().nullable().optional(), sourceDescription: z.string().min(1), ncm: z.string().nullable().optional() }) }).parse(payload);
    return repository.resolveProductAlias(data.organizationId, data.criteria);
  });
  ipcMain.handle(IPC_CHANNELS.listOperationClassificationRules, (_event, payload: unknown) => repository.listOperationClassificationRules(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.createOperationClassificationRule, (_event, payload: unknown) => repository.createOperationClassificationRule(payload));
  ipcMain.handle(IPC_CHANNELS.updateOperationClassificationRule, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateOperationClassificationRule(data.id, data.input);
  });
  ipcMain.handle(IPC_CHANNELS.activateOperationClassificationRule, (_event, payload: unknown) => repository.activateOperationClassificationRule(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.deactivateOperationClassificationRule, (_event, payload: unknown) => repository.deactivateOperationClassificationRule(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.resolveOperationClassificationRule, (_event, payload: unknown) => repository.resolveOperationClassificationRule(z.object({ organizationId: z.string().uuid(), ownLegalEntityId: z.string().uuid().nullable().optional(), issuerPartnerLegalEntityId: z.string().uuid().nullable().optional(), recipientPartnerLegalEntityId: z.string().uuid().nullable().optional(), productId: z.string().uuid().nullable().optional() }).parse(payload)));
  ipcMain.handle(IPC_CHANNELS.compareXmlWithExisting, (_event, payload: unknown) => repository.compareXmlWithExisting(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.mergeXmlIntoExisting, (_event, payload: unknown) => {
    const data = z.object({ fileId: z.string().uuid(), decision: z.string().min(1) }).parse(payload);
    return repository.mergeXmlIntoExisting(data.fileId, data.decision);
  });
  ipcMain.handle(IPC_CHANNELS.getFiscalDocumentMergeHistory, (_event, payload: unknown) => repository.getFiscalDocumentMergeHistory(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.suggestChargePeriods, (_event, payload: unknown) => repository.suggestChargePeriods(payload));
  ipcMain.handle(IPC_CHANNELS.findEligibleChargeOperations, (_event, payload: unknown) => repository.findEligibleOperations(payload));
  ipcMain.handle(IPC_CHANNELS.createClientChargeDraft, (_event, payload: unknown) => repository.createClientChargeDraft(payload));
  ipcMain.handle(IPC_CHANNELS.reserveChargeOperations, (_event, payload: unknown) => {
    const data = z.object({ clientChargeId: z.string().uuid(), operationIds: z.array(z.string().uuid()) }).parse(payload);
    return repository.reserveOperations(data.clientChargeId, data.operationIds);
  });
  ipcMain.handle(IPC_CHANNELS.releaseChargeOperations, (_event, payload: unknown) => {
    const data = z.object({ clientChargeId: z.string().uuid(), operationIds: z.array(z.string().uuid()).optional() }).parse(payload);
    return repository.releaseOperations(data.clientChargeId, data.operationIds);
  });
  ipcMain.handle(IPC_CHANNELS.addChargeAdjustment, (_event, payload: unknown) => repository.addChargeAdjustment(payload));
  ipcMain.handle(IPC_CHANNELS.removeChargeAdjustment, (_event, payload: unknown) => repository.removeChargeAdjustment(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.applyChargeCredit, (_event, payload: unknown) => repository.applyCredit(payload));
  ipcMain.handle(IPC_CHANNELS.submitClientChargeForReview, (_event, payload: unknown) => repository.submitClientChargeForReview(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.issueClientCharge, (_event, payload: unknown) => repository.issueClientCharge(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.cancelClientCharge, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), reason: z.string().min(1) }).parse(payload);
    return repository.cancelClientCharge(data.id, data.reason);
  });
  ipcMain.handle(IPC_CHANNELS.listClientCharges, (_event, payload: unknown) => repository.listClientCharges(z.object({ organizationId: z.string().uuid().optional(), clientPartnerId: z.string().uuid().optional(), status: z.string().optional() }).optional().parse(payload) ?? {}));
  ipcMain.handle(IPC_CHANNELS.getClientCharge, (_event, payload: unknown) => repository.getClientCharge(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.regenerateChargeDocuments, (_event, payload: unknown) => repository.regenerateChargeDocuments(z.string().uuid().parse(payload)));
  ipcMain.handle(IPC_CHANNELS.listLedgerEntries, (_event, payload: unknown) => repository.listLedgerEntries(z.object({ organizationId: z.string().uuid(), ownLegalEntityId: z.string().uuid().optional(), clientPartnerId: z.string().uuid().optional() }).parse(payload)));
  ipcMain.handle(IPC_CHANNELS.createLedgerEntry, (_event, payload: unknown) => repository.createLedgerEntry(payload));
  ipcMain.handle(IPC_CHANNELS.createAdvance, (_event, payload: unknown) => repository.createAdvance(payload));
  ipcMain.handle(IPC_CHANNELS.createCredit, (_event, payload: unknown) => repository.createCredit(payload));
  ipcMain.handle(IPC_CHANNELS.getAvailableCredits, (_event, payload: unknown) => {
    const data = z.object({ organizationId: z.string().uuid(), ownLegalEntityId: z.string().uuid(), clientPartnerId: z.string().uuid() }).parse(payload);
    return repository.getAvailableCredits(data.organizationId, data.ownLegalEntityId, data.clientPartnerId);
  });
  ipcMain.handle(IPC_CHANNELS.createClientPayment, (_event, payload: unknown) => repository.createClientPayment(payload));
  ipcMain.handle(IPC_CHANNELS.allocateClientPayment, (_event, payload: unknown) => repository.allocatePayment(payload));
  ipcMain.handle(IPC_CHANNELS.getBillingSummary, (_event, payload: unknown) => repository.getBillingSummary(z.string().uuid().parse(payload)));
}

function registerXmlPaths(paths: string[]): Array<{ token: string; fileName: string; sizeBytes: number }> {
  return paths.map((filePath) => {
    const token = randomUUID();
    xmlTokens.set(token, filePath);
    return { token, fileName: basename(filePath), sizeBytes: statSync(filePath).size };
  });
}

function findXmlFiles(folder: string, includeSubfolders: boolean): string[] {
  const result: string[] = [];
  readdirSync(folder, { withFileTypes: true }).forEach((entry) => {
    const full = join(folder, entry.name);
    if (entry.isDirectory() && includeSubfolders) result.push(...findXmlFiles(full, true));
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".xml")) result.push(full);
  });
  return result;
}

function normalizeSpreadsheetRow(raw: Record<string, string>, mapping: Record<string, string>, defaults: Record<string, unknown>): {
  data: Record<string, string>;
  status: "VALID" | "WARNING" | "ERROR" | "DUPLICATE";
  errorCode: string | null;
  errorMessage: string | null;
  warningCodes: string[];
} {
  const pick = (field: string): string => raw[mapping[field] ?? ""]?.trim() ?? "";
  const warnings: string[] = [];
  const date = normalizeDate(pick("date") || String(defaults.defaultDate ?? ""));
  const sacks = normalizeBrazilianDecimal(pick("sacks"));
  const documentNumber = pick("documentNumber");
  const clientPartnerId = String(defaults.defaultPartnerId ?? "");
  const operationScope = normalizeScope(pick("operationScope")) ?? String(defaults.defaultOperationScope ?? "");
  if (!date || !sacks || !documentNumber || !clientPartnerId || !operationScope) {
    return { data: {}, status: "ERROR", errorCode: "MISSING_REQUIRED", errorMessage: "Data, sacas, NF, cliente e classificacao sao obrigatorios.", warningCodes: warnings };
  }
  if (!pick("clientName")) warnings.push("CLIENT_FROM_DEFAULT");
  if (!pick("operationScope")) warnings.push("SCOPE_FROM_DEFAULT");
  return {
    data: {
      date,
      sacks,
      documentNumber,
      clientPartnerId,
      operationScope,
      productId: String(defaults.defaultProductId ?? ""),
      series: pick("series"),
      issuerName: pick("issuerName"),
      destinationName: pick("destinationName"),
      commercialUnitPrice: normalizeBrazilianDecimal(pick("commercialUnitPrice") || "0") ?? "0",
      totalAmountCents: String(parseMoneyToCents(pick("totalCommercialAmount") || "0")),
      notes: pick("notes")
    },
    status: warnings.length > 0 ? "WARNING" : "VALID",
    errorCode: null,
    errorMessage: null,
    warningCodes: warnings
  };
}

function normalizeDate(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return null;
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function normalizeBrazilianDecimal(value: string): string | null {
  const clean = value.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  return /^\d+(\.\d+)?$/.test(clean) ? clean : null;
}

function parseMoneyToCents(value: string): number {
  const decimal = normalizeBrazilianDecimal(value) ?? "0";
  return multiplyDecimalByCents(decimal, 100);
}

function normalizeScope(value: string): "INTERNAL" | "EXTERNAL" | null {
  const upper = value.trim().toUpperCase();
  if (["INTERNO", "INT", "I"].includes(upper)) return "INTERNAL";
  if (["EXTERNO", "EXT", "E"].includes(upper)) return "EXTERNAL";
  return null;
}
