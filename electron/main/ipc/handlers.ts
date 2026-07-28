import { dialog, shell, type IpcMain, type IpcMainInvokeEvent } from "electron";
import { z } from "zod";
import { brandingAssetKindSchema, businessPartnerRoleSchema } from "../../../src/shared/schemas/domainSchemas.js";
import { IPC_CHANNELS } from "../../../src/shared/ipc/channels.js";
import type { BrandingAssetKind } from "../../../src/shared/types/domain.js";
import type { Diagnostics } from "../../../src/shared/types/domain.js";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { randomUUID } from "node:crypto";
import { getCurrentMigration } from "../database/database.js";
import type { AppRepository } from "../services/appRepository.js";
import { copyBrandingAssetFromPath, getBrandingDialogFilters } from "../services/brandingAssets.js";
import type { AppContext } from "../services/context.js";
import { inspectWorkbook, previewSheet, readSheetRows, validateSpreadsheetPath } from "../services/spreadsheetService.js";
import { multiplyDecimalByCents } from "../../../src/shared/utils/decimal.js";
import { inspectXmlFile, safeXmlTargetName } from "../services/xmlNfeService.js";
import { lookupCnpj } from "../services/cnpjLookupService.js";
import { AuthError, AuthService, getIpcPolicy } from "../services/security.js";
import { BackupService } from "../services/backupService.js";

const spreadsheetTokens = new Map<string, string>();
const xmlTokens = new Map<string, string>();
const payableAttachmentTokens = new Map<string, string>();
const signedDealPdfTokens = new Map<string, string>();

export function createDiagnostics(context: AppContext, repository: AppRepository): Diagnostics {
  const profile = repository.getInstallationProfile();
  const bootstrap = repository.getBootstrapData(context.version);
  const organization = bootstrap.organizations.find((item) => item.id === profile?.defaultOrganizationId);
  const legalEntity = bootstrap.legalEntities.find((item) => item.id === profile?.defaultLegalEntityId);
  return {
    appVersion: context.version,
    productName: context.buildVariant?.productName,
    executableName: context.buildVariant?.executableName,
    appId: context.buildVariant?.appId,
    buildVariant: context.buildVariant?.variant,
    architecture: process.arch,
    electronVersion: process.versions.electron,
    signatureStatus: "UNSIGNED",
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
  const auth = new AuthService(context.db);
  const backups = new BackupService(context, auth);
  const handle = <T>(channel: string, listener: (event: IpcMainInvokeEvent, payload?: unknown) => T | Promise<T>): void => {
    ipcMain.handle(channel, async (event, payload) => {
      const policy = getIpcPolicy(channel);
      try {
        if (policy.mode === "authenticated") auth.requireSession();
        if (policy.mode === "permission") auth.requireSession(policy.permission);
        const result = await listener(event, payload);
        return result;
      } catch (error) {
        if (error instanceof AuthError) {
          const session = auth.getCurrentSession();
          auth.writeAudit({
            actorUserId: session?.user.id ?? null,
            sessionId: session?.id ?? null,
            action: `ipc.${channel}`,
            result: error.code === "ACCESS_DENIED" || error.code === "SESSION_REQUIRED" ? "DENIED" : "FAILED",
            severity: error.code === "ACCESS_DENIED" ? "WARNING" : "INFO",
            reason: error.code
          });
        }
        throw error;
      }
    });
  };

  handle(IPC_CHANNELS.authNeedsBootstrap, () => auth.needsBootstrap());
  handle(IPC_CHANNELS.authBootstrapAdmin, (_event, payload: unknown) => auth.bootstrapAdministrator(payload));
  handle(IPC_CHANNELS.authLogin, (_event, payload: unknown) => auth.login(payload));
  handle(IPC_CHANNELS.authCurrentSession, () => auth.getCurrentSession());
  handle(IPC_CHANNELS.authLock, () => auth.lock());
  handle(IPC_CHANNELS.authUnlock, (_event, payload: unknown) => auth.unlock(z.string().parse(payload)));
  handle(IPC_CHANNELS.authLogout, () => auth.logout());
  handle(IPC_CHANNELS.authChangePassword, (_event, payload: unknown) => auth.changePassword(payload));
  handle(IPC_CHANNELS.listUsers, () => auth.listUsers());
  handle(IPC_CHANNELS.createUser, (_event, payload: unknown) => auth.createUser(payload));
  handle(IPC_CHANNELS.updateUser, (_event, payload: unknown) => auth.updateUser(payload));
  handle(IPC_CHANNELS.listRoles, () => auth.listRoles());
  handle(IPC_CHANNELS.listPermissions, () => auth.listPermissions());
  handle(IPC_CHANNELS.assignUserRole, (_event, payload: unknown) => auth.assignRole(payload));
  handle(IPC_CHANNELS.listAuditEvents, (_event, payload: unknown) => {
    const data = z.object({ limit: z.number().int().min(1).max(1000).optional() }).optional().parse(payload);
    return auth.listAuditEvents(data?.limit ?? 200);
  });
  handle(IPC_CHANNELS.verifyAuditChain, () => auth.verifyAuditChain());
  handle(IPC_CHANNELS.listBackups, () => backups.list());
  handle(IPC_CHANNELS.getBackup, (_event, payload: unknown) => backups.get(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.estimateBackup, (_event, payload: unknown) => {
    const data = z.object({ backupType: z.enum(["FULL", "DATABASE_ONLY", "DOCUMENTS_ONLY"]).optional() }).optional().parse(payload);
    return backups.estimate(data?.backupType);
  });
  handle(IPC_CHANNELS.selectBackupDestination, async () => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
    return result.canceled ? null : result.filePaths[0] ?? null;
  });
  handle(IPC_CHANNELS.createBackup, (_event, payload: unknown) => backups.create(payload));
  handle(IPC_CHANNELS.cancelBackup, (_event, payload: unknown) => backups.get(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.verifyBackup, (_event, payload: unknown) => backups.verify(payload));
  handle(IPC_CHANNELS.protectBackup, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), reason: z.string().nullable().optional() }).parse(payload);
    return backups.protect(data.id, data.reason ?? null);
  });
  handle(IPC_CHANNELS.unprotectBackup, (_event, payload: unknown) => backups.unprotect(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.deleteBackup, (_event, payload: unknown) => backups.delete(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.openBackupLocation, (_event, payload: unknown) => {
    const backup = backups.get(z.string().uuid().parse(payload));
    if (!backup.storedFilePath) return false;
    shell.showItemInFolder(backup.storedFilePath);
    return true;
  });
  handle(IPC_CHANNELS.getBackupSettings, () => backups.getSettings());
  handle(IPC_CHANNELS.updateBackupSettings, (_event, payload: unknown) => backups.updateSettings(payload));
  handle(IPC_CHANNELS.runPendingBackup, () => backups.runPendingAutomaticBackup());
  handle(IPC_CHANNELS.selectRestoreFile, async () => {
    const result = await dialog.showOpenDialog({ properties: ["openFile"], filters: [{ name: "Backups do Operacoes Cafe", extensions: ["cafebackup"] }] });
    return result.canceled ? null : result.filePaths[0] ?? null;
  });
  handle(IPC_CHANNELS.inspectRestoreBackup, (_event, payload: unknown) => {
    const data = z.object({ path: z.string().min(1), password: z.string().nullable().optional() }).parse(payload);
    return backups.inspectRestoreFile(data.path, data.password ?? null);
  });
  handle(IPC_CHANNELS.validateRestoreBackup, (_event, payload: unknown) => {
    const data = z.object({ path: z.string().min(1), password: z.string().nullable().optional() }).parse(payload);
    return backups.inspectRestoreFile(data.path, data.password ?? null);
  });
  handle(IPC_CHANNELS.executeRestore, (_event, payload: unknown) => backups.executeRestore(payload));
  handle(IPC_CHANNELS.getRestoreStatus, () => null);
  handle(IPC_CHANNELS.cancelRestore, () => false);
  handle(IPC_CHANNELS.getIntegritySummary, () => ({ database: backups.runQuickDatabaseCheck(), documents: backups.checkDocumentFiles() }));
  handle(IPC_CHANNELS.runQuickIntegrityCheck, () => backups.runQuickDatabaseCheck());
  handle(IPC_CHANNELS.runFullIntegrityCheck, () => backups.runQuickDatabaseCheck());
  handle(IPC_CHANNELS.checkDocumentIntegrity, () => backups.checkDocumentFiles());
  handle(IPC_CHANNELS.findOrphanFiles, () => backups.findOrphans());
  handle(IPC_CHANNELS.generateIntegrityReport, () => backups.generateIntegrityReport());
  handle(IPC_CHANNELS.cleanupTemporaries, () => backups.findOrphans());
  handle(IPC_CHANNELS.listIntegrityHistory, () => backups.history());

  handle(IPC_CHANNELS.getBootstrapData, () => repository.getBootstrapData(context.version));
  handle(IPC_CHANNELS.saveInstallationProfile, (_event, payload: unknown) => repository.saveInstallationProfile(payload));
  handle(IPC_CHANNELS.updateInstallationProfile, (_event, payload: unknown) => repository.updateInstallationProfile(payload));
  handle(IPC_CHANNELS.getActiveContext, () => repository.getActiveContext());
  handle(IPC_CHANNELS.getDiagnostics, () => createDiagnostics(context, repository));
  handle(IPC_CHANNELS.setActiveLegalEntity, (_event, payload: unknown) => {
    const legalEntityId = z.string().uuid().parse(payload);
    return repository.setActiveLegalEntity(legalEntityId);
  });
  handle(IPC_CHANNELS.setActiveOrganization, (_event, payload: unknown) => {
    const organizationId = z.string().uuid().parse(payload);
    return repository.setActiveOrganization(organizationId);
  });
  handle(IPC_CHANNELS.listOrganizations, (_event, payload: unknown) =>
    repository.listOrganizations(z.object({ search: z.string().optional(), status: z.enum(["active", "inactive", "all"]).optional() }).optional().parse(payload) ?? {})
  );
  handle(IPC_CHANNELS.getOrganization, (_event, payload: unknown) => repository.getOrganization(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.createOrganization, (_event, payload: unknown) => repository.createOrganization(payload));
  handle(IPC_CHANNELS.updateOrganization, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateOrganization(data.id, data.input);
  });
  handle(IPC_CHANNELS.activateOrganization, (_event, payload: unknown) => repository.activateOrganization(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.deactivateOrganization, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), replacementOrganizationId: z.string().uuid().optional() }).parse(payload);
    return repository.deactivateOrganization(data.id, data.replacementOrganizationId);
  });
  handle(IPC_CHANNELS.selectOrganizationBrandingAsset, async (_event, payload: unknown) => {
    const data = z.object({ organizationId: z.string().uuid(), kind: brandingAssetKindSchema }).parse(payload);
    const result = await dialog.showOpenDialog({ properties: ["openFile"], filters: getBrandingDialogFilters() });
    if (result.canceled || !result.filePaths[0]) {
      return repository.getOrganization(data.organizationId);
    }
    const copiedPath = copyBrandingAssetFromPath(context.directories, data.organizationId, data.kind as BrandingAssetKind, result.filePaths[0]);
    const field = data.kind === "logo" ? "logoPath" : data.kind === "compactLogo" ? "compactLogoPath" : "iconPath";
    return repository.updateOrganizationBranding(data.organizationId, { [field]: copiedPath });
  });
  handle(IPC_CHANNELS.listLegalEntities, (_event, payload: unknown) =>
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
  handle(IPC_CHANNELS.getLegalEntity, (_event, payload: unknown) => repository.getLegalEntity(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.createLegalEntity, (_event, payload: unknown) => repository.createLegalEntity(payload));
  handle(IPC_CHANNELS.updateLegalEntity, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateLegalEntity(data.id, data.input);
  });
  handle(IPC_CHANNELS.activateLegalEntity, (_event, payload: unknown) => repository.activateLegalEntity(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.deactivateLegalEntity, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), replacementLegalEntityId: z.string().uuid().optional() }).parse(payload);
    return repository.deactivateLegalEntity(data.id, data.replacementLegalEntityId);
  });
  handle(IPC_CHANNELS.listLocations, (_event, payload: unknown) =>
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
  handle(IPC_CHANNELS.getLocation, (_event, payload: unknown) => repository.getLocation(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.createLocation, (_event, payload: unknown) => repository.createLocation(payload));
  handle(IPC_CHANNELS.updateLocation, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateLocation(data.id, data.input);
  });
  handle(IPC_CHANNELS.activateLocation, (_event, payload: unknown) => repository.activateLocation(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.deactivateLocation, (_event, payload: unknown) => repository.deactivateLocation(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.listBusinessPartners, (_event, payload: unknown) =>
    repository.listBusinessPartners(z.object({ search: z.string().optional(), role: businessPartnerRoleSchema.optional(), organizationId: z.string().uuid().optional(), status: z.enum(["active", "inactive", "all"]).optional() }).optional().parse(payload) ?? {})
  );
  handle(IPC_CHANNELS.getBusinessPartner, (_event, payload: unknown) => repository.getBusinessPartner(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.createBusinessPartner, (_event, payload: unknown) => repository.createBusinessPartner(payload));
  handle(IPC_CHANNELS.updateBusinessPartner, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateBusinessPartner(data.id, data.input);
  });
  handle(IPC_CHANNELS.deleteBusinessPartner, (_event, payload: unknown) => repository.deleteBusinessPartner(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.activateBusinessPartner, (_event, payload: unknown) => repository.activateBusinessPartner(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.deactivateBusinessPartner, (_event, payload: unknown) => repository.deactivateBusinessPartner(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.addBusinessPartnerRole, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), role: businessPartnerRoleSchema }).parse(payload);
    return repository.addBusinessPartnerRole(data.id, data.role);
  });
  handle(IPC_CHANNELS.removeBusinessPartnerRole, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), role: businessPartnerRoleSchema }).parse(payload);
    return repository.removeBusinessPartnerRole(data.id, data.role);
  });
  handle(IPC_CHANNELS.listPartnerLegalEntities, (_event, payload: unknown) => repository.listPartnerLegalEntities(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.createPartnerLegalEntity, (_event, payload: unknown) => repository.createPartnerLegalEntity(payload));
  handle(IPC_CHANNELS.lookupCnpj, (_event, payload: unknown) => lookupCnpj(z.string().min(1).parse(payload)));
  handle(IPC_CHANNELS.updatePartnerLegalEntity, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updatePartnerLegalEntity(data.id, data.input);
  });
  handle(IPC_CHANNELS.activatePartnerLegalEntity, (_event, payload: unknown) => repository.activatePartnerLegalEntity(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.deactivatePartnerLegalEntity, (_event, payload: unknown) => repository.deactivatePartnerLegalEntity(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.listPartnerContacts, (_event, payload: unknown) => repository.listPartnerContacts(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.createPartnerContact, (_event, payload: unknown) => repository.createPartnerContact(payload));
  handle(IPC_CHANNELS.updatePartnerContact, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updatePartnerContact(data.id, data.input);
  });
  handle(IPC_CHANNELS.activatePartnerContact, (_event, payload: unknown) => repository.activatePartnerContact(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.deactivatePartnerContact, (_event, payload: unknown) => repository.deactivatePartnerContact(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.listProducts, (_event, payload: unknown) =>
    repository.listProducts(z.object({ search: z.string().optional(), organizationId: z.string().uuid().optional(), category: z.string().optional(), status: z.enum(["active", "inactive", "all"]).optional() }).optional().parse(payload) ?? {})
  );
  handle(IPC_CHANNELS.getProduct, (_event, payload: unknown) => repository.getProduct(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.createProduct, (_event, payload: unknown) => repository.createProduct(payload));
  handle(IPC_CHANNELS.updateProduct, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateProduct(data.id, data.input);
  });
  handle(IPC_CHANNELS.activateProduct, (_event, payload: unknown) => repository.activateProduct(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.deactivateProduct, (_event, payload: unknown) => repository.deactivateProduct(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.getBillingProfile, (_event, payload: unknown) => repository.getBillingProfile(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.upsertBillingProfile, (_event, payload: unknown) => repository.upsertBillingProfile(payload));
  handle(IPC_CHANNELS.activateBillingProfile, (_event, payload: unknown) => repository.activateBillingProfile(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.deactivateBillingProfile, (_event, payload: unknown) => repository.deactivateBillingProfile(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.listServiceRateRules, (_event, payload: unknown) =>
    repository.listServiceRateRules(z.object({ businessPartnerId: z.string().uuid().optional(), organizationId: z.string().uuid().optional(), operationScope: z.string().optional(), productId: z.string().uuid().optional(), ownLegalEntityId: z.string().uuid().optional(), counterpartyPartnerLegalEntityId: z.string().uuid().optional(), status: z.enum(["active", "inactive", "all"]).optional() }).optional().parse(payload) ?? {})
  );
  handle(IPC_CHANNELS.getServiceRateRule, (_event, payload: unknown) => repository.getServiceRateRule(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.createServiceRateRule, (_event, payload: unknown) => repository.createServiceRateRule(payload));
  handle(IPC_CHANNELS.updateServiceRateRule, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateServiceRateRule(data.id, data.input);
  });
  handle(IPC_CHANNELS.deleteServiceRateRule, (_event, payload: unknown) => repository.deleteServiceRateRule(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.activateServiceRateRule, (_event, payload: unknown) => repository.activateServiceRateRule(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.deactivateServiceRateRule, (_event, payload: unknown) => repository.deactivateServiceRateRule(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.resolveServiceRateRule, (_event, payload: unknown) => repository.resolveServiceRateRule(payload));
  handle(IPC_CHANNELS.listFiscalDocuments, (_event, payload: unknown) =>
    repository.listFiscalDocuments(
      z
        .object({
          organizationId: z.string().uuid().optional(),
          ownLegalEntityId: z.string().uuid().optional(),
          search: z.string().optional(),
          status: z.enum(["DRAFT", "PENDING", "CONFIRMED", "CANCELED", "all"]).optional()
        })
        .optional()
        .parse(payload) ?? {}
    )
  );
  handle(IPC_CHANNELS.getFiscalDocument, (_event, payload: unknown) => repository.getFiscalDocument(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.createFiscalDocument, (_event, payload: unknown) => repository.createFiscalDocument(payload));
  handle(IPC_CHANNELS.updateFiscalDocument, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateFiscalDocument(data.id, data.input);
  });
  handle(IPC_CHANNELS.deleteFiscalDocument, (_event, payload: unknown) => repository.deleteFiscalDocument(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.addFiscalDocumentItem, (_event, payload: unknown) => repository.addFiscalDocumentItem(payload));
  handle(IPC_CHANNELS.listOperations, (_event, payload: unknown) =>
    repository.listOperations(
      z
        .object({
          organizationId: z.string().uuid().optional(),
          ownLegalEntityId: z.string().uuid().optional(),
          responsiblePartnerId: z.string().uuid().optional(),
          periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          status: z.enum(["DRAFT", "PENDING", "CONFIRMED", "CANCELED", "all"]).optional(),
          billingStatus: z.enum(["UNBILLED", "RESERVED", "BILLED", "all"]).optional()
        })
        .optional()
        .parse(payload) ?? {}
    )
  );
  handle(IPC_CHANNELS.addOperation, (_event, payload: unknown) => repository.addOperation(payload));
  handle(IPC_CHANNELS.updateOperationManualRate, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), manualRateValueCents: z.number().int().min(0), reason: z.string().min(1) }).parse(payload);
    return repository.updateOperationManualRate(data.id, data.manualRateValueCents, data.reason);
  });
  handle(IPC_CHANNELS.confirmFiscalDocument, (_event, payload: unknown) => repository.confirmFiscalDocument(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.cancelFiscalDocument, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), reason: z.string().min(1) }).parse(payload);
    return repository.cancelFiscalDocument(data.id, data.reason);
  });
  handle(IPC_CHANNELS.getOperationalIndicators, (_event, payload: unknown) =>
    repository.getOperationalIndicators(z.union([z.string().uuid(), z.object({ organizationId: z.string().uuid(), ownLegalEntityId: z.string().uuid().nullable().optional() })]).parse(payload))
  );
  handle(IPC_CHANNELS.getMonthlyOperationTotals, (_event, payload: unknown) => {
    const data = z.object({ organizationId: z.string().uuid(), ownLegalEntityId: z.string().uuid().nullable().optional(), year: z.number().int().min(2000).max(2100) }).parse(payload);
    return repository.getMonthlyOperationTotals(data.organizationId, data.year, data.ownLegalEntityId);
  });
  handle(IPC_CHANNELS.selectSpreadsheetFile, async () => {
    const result = await dialog.showOpenDialog({ properties: ["openFile"], filters: [{ name: "Planilhas Excel", extensions: ["xlsx"] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    validateSpreadsheetPath(result.filePaths[0]);
    const token = randomUUID();
    spreadsheetTokens.set(token, result.filePaths[0]);
    return inspectWorkbook(result.filePaths[0], token);
  });
  handle(IPC_CHANNELS.inspectSpreadsheetWorkbook, (_event, payload: unknown) => {
    const token = z.string().uuid().parse(payload);
    const filePath = spreadsheetTokens.get(token);
    if (!filePath) throw new Error("Arquivo temporario nao encontrado.");
    return inspectWorkbook(filePath, token);
  });
  handle(IPC_CHANNELS.previewSpreadsheetSheet, (_event, payload: unknown) => {
    const data = z.object({ token: z.string().uuid(), sheetName: z.string().min(1), headerRow: z.number().int().min(1) }).parse(payload);
    const filePath = spreadsheetTokens.get(data.token);
    if (!filePath) throw new Error("Arquivo temporario nao encontrado.");
    return previewSheet(filePath, data.sheetName, data.headerRow);
  });
  handle(IPC_CHANNELS.listSpreadsheetMappingTemplates, (_event, payload: unknown) => repository.listSpreadsheetMappingTemplates(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.createSpreadsheetMappingTemplate, (_event, payload: unknown) => repository.createSpreadsheetMappingTemplate(payload));
  handle(IPC_CHANNELS.updateSpreadsheetMappingTemplate, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateSpreadsheetMappingTemplate(data.id, data.input);
  });
  handle(IPC_CHANNELS.duplicateSpreadsheetMappingTemplate, (_event, payload: unknown) => repository.duplicateSpreadsheetMappingTemplate(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.activateSpreadsheetMappingTemplate, (_event, payload: unknown) => repository.activateSpreadsheetMappingTemplate(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.deactivateSpreadsheetMappingTemplate, (_event, payload: unknown) => repository.deactivateSpreadsheetMappingTemplate(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.createSpreadsheetImportDraft, (_event, payload: unknown) => repository.createSpreadsheetImportDraft(payload));
  handle(IPC_CHANNELS.validateSpreadsheetImportRows, async (_event, payload: unknown) => {
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
  handle(IPC_CHANNELS.executeSpreadsheetImport, (_event, payload: unknown) => {
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
  handle(IPC_CHANNELS.getSpreadsheetImportJob, (_event, payload: unknown) => repository.getSpreadsheetImportJob(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.listSpreadsheetImportJobs, (_event, payload: unknown) => repository.listSpreadsheetImportJobs(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.cancelSpreadsheetImportJob, (_event, payload: unknown) => repository.cancelSpreadsheetImportJob(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.revertSpreadsheetImportJob, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), reason: z.string().min(1) }).parse(payload);
    return repository.revertSpreadsheetImportJob(data.id, data.reason);
  });
  handle(IPC_CHANNELS.listPartnerAliases, (_event, payload: unknown) => repository.listPartnerAliases(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.createPartnerAlias, (_event, payload: unknown) => repository.createPartnerAlias(payload));
  handle(IPC_CHANNELS.deactivatePartnerAlias, (_event, payload: unknown) => repository.deactivatePartnerAlias(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.resolvePartnerAlias, (_event, payload: unknown) => {
    const data = z.object({ organizationId: z.string().uuid(), value: z.string().min(1) }).parse(payload);
    return repository.resolvePartnerAlias(data.organizationId, data.value);
  });
  handle(IPC_CHANNELS.selectXmlFile, async () => {
    const result = await dialog.showOpenDialog({ properties: ["openFile"], filters: [{ name: "XML NF-e", extensions: ["xml"] }] });
    if (result.canceled || !result.filePaths[0]) return [];
    return registerXmlPaths(result.filePaths);
  });
  handle(IPC_CHANNELS.selectXmlFiles, async () => {
    const result = await dialog.showOpenDialog({ properties: ["openFile", "multiSelections"], filters: [{ name: "XML NF-e", extensions: ["xml"] }] });
    if (result.canceled) return [];
    return registerXmlPaths(result.filePaths);
  });
  handle(IPC_CHANNELS.selectXmlFolder, async (_event, payload: unknown) => {
    const data = z.object({ includeSubfolders: z.boolean().optional() }).optional().parse(payload) ?? {};
    const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (result.canceled || !result.filePaths[0]) return { folder: null, files: [] };
    const files = findXmlFiles(result.filePaths[0], data.includeSubfolders === true);
    return { folder: result.filePaths[0], files: registerXmlPaths(files) };
  });
  handle(IPC_CHANNELS.registerDroppedXmlFiles, (_event, payload: unknown) => {
    const data = z.object({ paths: z.array(z.string().min(1)).min(1).max(100) }).parse(payload);
    const xmlPaths = data.paths.filter((filePath) => filePath.toLowerCase().endsWith(".xml"));
    if (xmlPaths.length === 0) throw new Error("Arraste somente arquivos XML.");
    return registerXmlPaths(xmlPaths);
  });
  handle(IPC_CHANNELS.inspectXmlFiles, (_event, payload: unknown) => {
    const tokens = z.array(z.string().uuid()).parse(payload);
    return tokens.map((token) => {
      const filePath = xmlTokens.get(token);
      if (!filePath) throw new Error("Arquivo XML temporario nao encontrado.");
      return inspectXmlFile(filePath, token);
    });
  });
  handle(IPC_CHANNELS.createXmlImportDraft, (_event, payload: unknown) => repository.createXmlImportDraft(payload));
  handle(IPC_CHANNELS.addXmlImportFiles, (_event, payload: unknown) => {
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
  handle(IPC_CHANNELS.updateXmlImportSettings, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), settings: z.record(z.string(), z.unknown()) }).parse(payload);
    return repository.updateXmlImportSettings(data.id, data.settings);
  });
  handle(IPC_CHANNELS.validateXmlImportJob, (_event, payload: unknown) => repository.validateXmlImportJob(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.updateXmlImportFileResolution, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), resolution: z.unknown() }).parse(payload);
    return repository.updateXmlImportFileResolution(data.id, data.resolution);
  });
  handle(IPC_CHANNELS.applyXmlBulkResolution, (_event, payload: unknown) => {
    const data = z.object({ jobId: z.string().uuid(), fileIds: z.array(z.string().uuid()), resolution: z.unknown() }).parse(payload);
    return repository.applyXmlBulkResolution(data.jobId, data.fileIds, data.resolution);
  });
  handle(IPC_CHANNELS.executeXmlImportJob, (_event, payload: unknown) => {
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
  handle(IPC_CHANNELS.getXmlImportJobProgress, (_event, payload: unknown) => repository.getXmlImportJobProgress(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.listXmlImportJobs, (_event, payload: unknown) => repository.listXmlImportJobs(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.getXmlImportJob, (_event, payload: unknown) => repository.getXmlImportJob(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.cancelXmlImportJob, (_event, payload: unknown) => repository.cancelXmlImportJob(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.revertXmlImportJob, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), reason: z.string().min(1) }).parse(payload);
    return repository.revertXmlImportJob(data.id, data.reason);
  });
  handle(IPC_CHANNELS.listFiscalDocumentEvents, (_event, payload: unknown) => repository.listFiscalDocumentEvents(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.getFiscalDocumentEvent, (_event, payload: unknown) => repository.getFiscalDocumentEvent(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.linkPendingFiscalDocumentEvents, (_event, payload: unknown) => repository.linkPendingFiscalDocumentEvents(z.string().regex(/^\d{44}$/).parse(payload)));
  handle(IPC_CHANNELS.listProductAliases, (_event, payload: unknown) => repository.listProductAliases(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.createProductAlias, (_event, payload: unknown) => repository.createProductAlias(payload));
  handle(IPC_CHANNELS.updateProductAlias, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateProductAlias(data.id, data.input);
  });
  handle(IPC_CHANNELS.activateProductAlias, (_event, payload: unknown) => repository.activateProductAlias(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.deactivateProductAlias, (_event, payload: unknown) => repository.deactivateProductAlias(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.resolveProductAlias, (_event, payload: unknown) => {
    const data = z.object({ organizationId: z.string().uuid(), criteria: z.object({ issuerPartnerLegalEntityId: z.string().uuid().nullable().optional(), sourceProductCode: z.string().nullable().optional(), sourceDescription: z.string().min(1), ncm: z.string().nullable().optional() }) }).parse(payload);
    return repository.resolveProductAlias(data.organizationId, data.criteria);
  });
  handle(IPC_CHANNELS.listOperationClassificationRules, (_event, payload: unknown) => repository.listOperationClassificationRules(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.createOperationClassificationRule, (_event, payload: unknown) => repository.createOperationClassificationRule(payload));
  handle(IPC_CHANNELS.updateOperationClassificationRule, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateOperationClassificationRule(data.id, data.input);
  });
  handle(IPC_CHANNELS.activateOperationClassificationRule, (_event, payload: unknown) => repository.activateOperationClassificationRule(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.deactivateOperationClassificationRule, (_event, payload: unknown) => repository.deactivateOperationClassificationRule(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.resolveOperationClassificationRule, (_event, payload: unknown) => repository.resolveOperationClassificationRule(z.object({ organizationId: z.string().uuid(), ownLegalEntityId: z.string().uuid().nullable().optional(), issuerPartnerLegalEntityId: z.string().uuid().nullable().optional(), recipientPartnerLegalEntityId: z.string().uuid().nullable().optional(), productId: z.string().uuid().nullable().optional() }).parse(payload)));
  handle(IPC_CHANNELS.compareXmlWithExisting, (_event, payload: unknown) => repository.compareXmlWithExisting(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.mergeXmlIntoExisting, (_event, payload: unknown) => {
    const data = z.object({ fileId: z.string().uuid(), decision: z.string().min(1) }).parse(payload);
    return repository.mergeXmlIntoExisting(data.fileId, data.decision);
  });
  handle(IPC_CHANNELS.getFiscalDocumentMergeHistory, (_event, payload: unknown) => repository.getFiscalDocumentMergeHistory(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.suggestChargePeriods, (_event, payload: unknown) => repository.suggestChargePeriods(payload));
  handle(IPC_CHANNELS.findEligibleChargeOperations, (_event, payload: unknown) => repository.findEligibleOperations(payload));
  handle(IPC_CHANNELS.getPartnerRateSummary, (_event, payload: unknown) => repository.getPartnerRateSummary(payload));
  handle(IPC_CHANNELS.createClientChargeDraft, (_event, payload: unknown) => repository.createClientChargeDraft(payload));
  handle(IPC_CHANNELS.reserveChargeOperations, (_event, payload: unknown) => {
    const data = z.object({ clientChargeId: z.string().uuid(), operationIds: z.array(z.string().uuid()) }).parse(payload);
    return repository.reserveOperations(data.clientChargeId, data.operationIds);
  });
  handle(IPC_CHANNELS.releaseChargeOperations, (_event, payload: unknown) => {
    const data = z.object({ clientChargeId: z.string().uuid(), operationIds: z.array(z.string().uuid()).optional() }).parse(payload);
    return repository.releaseOperations(data.clientChargeId, data.operationIds);
  });
  handle(IPC_CHANNELS.addChargeAdjustment, (_event, payload: unknown) => repository.addChargeAdjustment(payload));
  handle(IPC_CHANNELS.removeChargeAdjustment, (_event, payload: unknown) => repository.removeChargeAdjustment(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.applyChargeCredit, (_event, payload: unknown) => repository.applyCredit(payload));
  handle(IPC_CHANNELS.submitClientChargeForReview, (_event, payload: unknown) => repository.submitClientChargeForReview(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.issueClientCharge, async (_event, payload: unknown) => {
    return repository.issueClientCharge(z.string().uuid().parse(payload));
  });
  handle(IPC_CHANNELS.cancelClientCharge, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), reason: z.string().min(1) }).parse(payload);
    return repository.cancelClientCharge(data.id, data.reason);
  });
  handle(IPC_CHANNELS.listClientCharges, (_event, payload: unknown) => repository.listClientCharges(z.object({ organizationId: z.string().uuid().optional(), clientPartnerId: z.string().uuid().optional(), status: z.string().optional() }).optional().parse(payload) ?? {}));
  handle(IPC_CHANNELS.getClientCharge, (_event, payload: unknown) => repository.getClientCharge(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.regenerateChargeDocuments, async (_event, payload: unknown) => {
    return repository.regenerateChargeDocuments(z.string().uuid().parse(payload));
  });
  handle(IPC_CHANNELS.openChargeDocument, async (_event, payload: unknown) => {
    const data = z.object({ chargeId: z.string().uuid(), kind: z.enum(["pdf", "image"]) }).parse(payload);
    const regenerated = await repository.regenerateChargeDocuments(data.chargeId);
    const filePath = repository.getChargeDocumentPath(regenerated.charge.id, data.kind);
    const destinationDir = await selectExportDirectory(`Escolha a pasta para salvar ${data.kind === "pdf" ? "o PDF" : "a imagem"} da cobranca`);
    if (!destinationDir) return false;
    const exportedPath = copyGeneratedFileToDirectory(filePath, destinationDir);
    const result = await shell.openPath(exportedPath);
    if (result) throw new Error(result);
    return true;
  });
  handle(IPC_CHANNELS.listLedgerEntries, (_event, payload: unknown) => repository.listLedgerEntries(z.object({ organizationId: z.string().uuid(), ownLegalEntityId: z.string().uuid().optional(), clientPartnerId: z.string().uuid().optional() }).parse(payload)));
  handle(IPC_CHANNELS.createLedgerEntry, (_event, payload: unknown) => repository.createLedgerEntry(payload));
  handle(IPC_CHANNELS.createAdvance, (_event, payload: unknown) => repository.createAdvance(payload));
  handle(IPC_CHANNELS.createCredit, (_event, payload: unknown) => repository.createCredit(payload));
  handle(IPC_CHANNELS.getAvailableCredits, (_event, payload: unknown) => {
    const data = z.object({ organizationId: z.string().uuid(), ownLegalEntityId: z.string().uuid(), clientPartnerId: z.string().uuid() }).parse(payload);
    return repository.getAvailableCredits(data.organizationId, data.ownLegalEntityId, data.clientPartnerId);
  });
  handle(IPC_CHANNELS.createClientPayment, (_event, payload: unknown) => repository.createClientPayment(payload));
  handle(IPC_CHANNELS.allocateClientPayment, (_event, payload: unknown) => repository.allocatePayment(payload));
  handle(IPC_CHANNELS.getBillingSummary, (_event, payload: unknown) =>
    repository.getBillingSummary(z.union([z.string().uuid(), z.object({ organizationId: z.string().uuid(), ownLegalEntityId: z.string().uuid().nullable().optional(), includeAllCompanies: z.boolean().optional() })]).parse(payload))
  );
  handle(IPC_CHANNELS.getDashboardAlerts, (_event, payload: unknown) => {
    const data = z.object({ organizationId: z.string().uuid(), ownLegalEntityId: z.string().uuid().nullable().optional() }).parse(payload);
    return repository.getDashboardAlerts(data.organizationId, data.ownLegalEntityId);
  });
  handle(IPC_CHANNELS.listExpenseCategories, (_event, payload: unknown) => repository.listExpenseCategories(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.createExpenseCategory, (_event, payload: unknown) => repository.createExpenseCategory(payload));
  handle(IPC_CHANNELS.updateExpenseCategory, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateExpenseCategory(data.id, data.input);
  });
  handle(IPC_CHANNELS.activateExpenseCategory, (_event, payload: unknown) => repository.activateExpenseCategory(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.deactivateExpenseCategory, (_event, payload: unknown) => repository.deactivateExpenseCategory(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.listCostCenters, (_event, payload: unknown) => repository.listCostCenters(z.object({ organizationId: z.string().uuid(), ownLegalEntityId: z.string().uuid().optional(), status: z.enum(["active", "inactive", "all"]).optional() }).parse(payload)));
  handle(IPC_CHANNELS.createCostCenter, (_event, payload: unknown) => repository.createCostCenter(payload));
  handle(IPC_CHANNELS.updateCostCenter, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateCostCenter(data.id, data.input);
  });
  handle(IPC_CHANNELS.activateCostCenter, (_event, payload: unknown) => repository.activateCostCenter(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.deactivateCostCenter, (_event, payload: unknown) => repository.deactivateCostCenter(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.listFinancialAccounts, (_event, payload: unknown) => repository.listFinancialAccounts(z.object({ organizationId: z.string().uuid(), ownLegalEntityId: z.string().uuid().optional(), status: z.enum(["active", "inactive", "all"]).optional() }).parse(payload)));
  handle(IPC_CHANNELS.createFinancialAccount, (_event, payload: unknown) => repository.createFinancialAccount(payload));
  handle(IPC_CHANNELS.updateFinancialAccount, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateFinancialAccount(data.id, data.input);
  });
  handle(IPC_CHANNELS.activateFinancialAccount, (_event, payload: unknown) => repository.activateFinancialAccount(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.deactivateFinancialAccount, (_event, payload: unknown) => repository.deactivateFinancialAccount(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.listAccountsPayable, (_event, payload: unknown) => repository.listAccountsPayable(z.object({ organizationId: z.string().uuid(), ownLegalEntityId: z.string().uuid().optional(), status: z.string().optional(), supplierPartnerId: z.string().uuid().optional() }).parse(payload)));
  handle(IPC_CHANNELS.getAccountPayable, (_event, payload: unknown) => repository.getAccountPayable(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.createAccountPayableDraft, (_event, payload: unknown) => repository.createAccountPayableDraft(payload));
  handle(IPC_CHANNELS.updateAccountPayable, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateAccountPayable(data.id, data.input);
  });
  handle(IPC_CHANNELS.confirmAccountPayable, (_event, payload: unknown) => repository.confirmAccountPayable(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.duplicateAccountPayable, (_event, payload: unknown) => repository.duplicateAccountPayable(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.findPossiblePayableDuplicates, (_event, payload: unknown) => repository.findPossiblePayableDuplicates(payload));
  handle(IPC_CHANNELS.addPayableAllocation, (_event, payload: unknown) => repository.addPayableAllocation(payload));
  handle(IPC_CHANNELS.removePayableAllocation, (_event, payload: unknown) => repository.removePayableAllocation(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.contestAccountPayable, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), reason: z.string().min(1) }).parse(payload);
    return repository.contestAccountPayable(data.id, data.reason);
  });
  handle(IPC_CHANNELS.cancelAccountPayable, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), reason: z.string().min(1) }).parse(payload);
    return repository.cancelAccountPayable(data.id, data.reason);
  });
  handle(IPC_CHANNELS.listPayableRecurringTemplates, (_event, payload: unknown) => repository.listPayableRecurringTemplates(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.createPayableRecurringTemplate, (_event, payload: unknown) => repository.createPayableRecurringTemplate(payload));
  handle(IPC_CHANNELS.previewPayableRecurringGeneration, (_event, payload: unknown) => {
    const data = z.object({ templateId: z.string().uuid(), monthsAhead: z.number().int().min(1).max(24).optional() }).parse(payload);
    return repository.previewPayableRecurringGeneration(data.templateId, data.monthsAhead);
  });
  handle(IPC_CHANNELS.generatePayableRecurringPeriod, (_event, payload: unknown) => {
    const data = z.object({ templateId: z.string().uuid(), monthsAhead: z.number().int().min(1).max(24).optional() }).parse(payload);
    return repository.generatePayableRecurringPeriod(data.templateId, data.monthsAhead);
  });
  handle(IPC_CHANNELS.createPayableInstallmentGroup, (_event, payload: unknown) => repository.createPayableInstallmentGroup(payload));
  handle(IPC_CHANNELS.getPayableInstallmentGroup, (_event, payload: unknown) => repository.getPayableInstallmentGroup(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.createPayablePayment, (_event, payload: unknown) => repository.createPayablePayment(payload));
  handle(IPC_CHANNELS.allocatePayablePayment, (_event, payload: unknown) => repository.allocatePayablePayment(payload));
  handle(IPC_CHANNELS.cancelPayablePayment, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), reason: z.string().min(1) }).parse(payload);
    return repository.cancelPayablePayment(data.id, data.reason);
  });
  handle(IPC_CHANNELS.listPayablePayments, (_event, payload: unknown) => repository.listPayablePayments(z.object({ organizationId: z.string().uuid(), ownLegalEntityId: z.string().uuid().optional() }).parse(payload)));
  handle(IPC_CHANNELS.getFinancialSummary, (_event, payload: unknown) => repository.getFinancialSummary(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.selectPayableAttachment, async () => {
    const result = await dialog.showOpenDialog({ properties: ["openFile"], filters: [{ name: "Documentos", extensions: ["pdf", "png", "jpg", "jpeg", "webp"] }] });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const token = randomUUID();
    payableAttachmentTokens.set(token, filePath);
    return { token, fileName: basename(filePath), sizeBytes: statSync(filePath).size };
  });
  handle(IPC_CHANNELS.addPayableAttachment, (_event, payload: unknown) => {
    const data = z.object({ token: z.string().uuid(), accountPayableId: z.string().uuid(), attachmentType: z.string(), description: z.string().nullable() }).parse(payload);
    const sourcePath = payableAttachmentTokens.get(data.token);
    if (!sourcePath) throw new Error("Arquivo selecionado expirou.");
    return repository.addPayableAttachment({ ...data, sourcePath });
  });
  handle(IPC_CHANNELS.addPayablePaymentAttachment, (_event, payload: unknown) => {
    const data = z.object({ token: z.string().uuid(), payablePaymentId: z.string().uuid(), attachmentType: z.string(), description: z.string().nullable() }).parse(payload);
    const sourcePath = payableAttachmentTokens.get(data.token);
    if (!sourcePath) throw new Error("Arquivo selecionado expirou.");
    return repository.addPayablePaymentAttachment({ ...data, sourcePath });
  });
  handle(IPC_CHANNELS.listPayableAttachments, (_event, payload: unknown) => repository.listPayableAttachments(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.listPayablePaymentAttachments, (_event, payload: unknown) => repository.listPayablePaymentAttachments(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.openPayableAttachment, async (_event, payload: unknown) => {
    const filePath = repository.getPayableAttachmentPath(z.string().uuid().parse(payload));
    const result = await shell.openPath(filePath);
    if (result) throw new Error(result);
    return true;
  });
  handle(IPC_CHANNELS.removePayableAttachment, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), reason: z.string().nullable() }).parse(payload);
    return repository.removePayableAttachment(data.id, data.reason);
  });
  handle(IPC_CHANNELS.previewFinancialReport, (_event, payload: unknown) => repository.previewFinancialReport(payload));
  handle(IPC_CHANNELS.generateFinancialReport, async (_event, payload: unknown) => {
    const destinationDir = await selectExportDirectory("Escolha a pasta para salvar o relatorio financeiro");
    if (!destinationDir) return null;
    const report = await repository.generateFinancialReport(payload);
    const exportedPath = copyGeneratedFileToDirectory(report.storedFilePath, destinationDir, report.fileName);
    return { ...report, fileName: basename(exportedPath), storedFilePath: exportedPath };
  });
  handle(IPC_CHANNELS.listFinancialReports, (_event, payload: unknown) => repository.listFinancialReportGenerations(z.object({ organizationId: z.string().uuid(), ownLegalEntityId: z.string().uuid().nullable().optional() }).parse(payload)));
  handle(IPC_CHANNELS.openFinancialReport, async (_event, payload: unknown) => {
    const filePath = repository.getFinancialReportPath(z.string().uuid().parse(payload));
    const result = await shell.openPath(filePath);
    if (result) throw new Error(result);
    return true;
  });
  handle(IPC_CHANNELS.listDealConfirmations, (_event, payload: unknown) => repository.listDealConfirmations(payload));
  handle(IPC_CHANNELS.getDealConfirmation, (_event, payload: unknown) => repository.getDealConfirmation(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.createDealConfirmationDraft, (_event, payload: unknown) => repository.createDealConfirmationDraft(payload));
  handle(IPC_CHANNELS.createDealConfirmationFromOperations, (_event, payload: unknown) => repository.createDealConfirmationFromOperations(payload));
  handle(IPC_CHANNELS.createDealConfirmationFromFiscalDocuments, (_event, payload: unknown) => repository.createDealConfirmationFromFiscalDocuments(payload));
  handle(IPC_CHANNELS.duplicateDealConfirmationAsDraft, (_event, payload: unknown) => repository.duplicateDealConfirmationAsDraft(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.deleteDealConfirmation, (_event, payload: unknown) => repository.deleteDealConfirmation(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.updateDealConfirmationDraft, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateDealConfirmationDraft(data.id, data.input);
  });
  handle(IPC_CHANNELS.addDealConfirmationItem, (_event, payload: unknown) => repository.addDealConfirmationItem(payload));
  handle(IPC_CHANNELS.updateDealConfirmationItem, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateDealConfirmationItem(data.id, data.input);
  });
  handle(IPC_CHANNELS.removeDealConfirmationItem, (_event, payload: unknown) => repository.removeDealConfirmationItem(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.addDealConfirmationParty, (_event, payload: unknown) => repository.addDealConfirmationParty(payload));
  handle(IPC_CHANNELS.updateDealConfirmationParty, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateDealConfirmationParty(data.id, data.input);
  });
  handle(IPC_CHANNELS.removeDealConfirmationParty, (_event, payload: unknown) => repository.removeDealConfirmationParty(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.linkDealOperation, (_event, payload: unknown) => {
    const data = z.object({ dealConfirmationId: z.string().uuid(), operationId: z.string().uuid() }).parse(payload);
    return repository.linkDealOperation(data.dealConfirmationId, data.operationId);
  });
  handle(IPC_CHANNELS.unlinkDealOperation, (_event, payload: unknown) => {
    const data = z.object({ dealConfirmationId: z.string().uuid(), operationId: z.string().uuid() }).parse(payload);
    return repository.unlinkDealOperation(data.dealConfirmationId, data.operationId);
  });
  handle(IPC_CHANNELS.linkDealFiscalDocument, (_event, payload: unknown) => {
    const data = z.object({ dealConfirmationId: z.string().uuid(), fiscalDocumentId: z.string().uuid() }).parse(payload);
    return repository.linkDealFiscalDocument(data.dealConfirmationId, data.fiscalDocumentId);
  });
  handle(IPC_CHANNELS.unlinkDealFiscalDocument, (_event, payload: unknown) => {
    const data = z.object({ dealConfirmationId: z.string().uuid(), fiscalDocumentId: z.string().uuid() }).parse(payload);
    return repository.unlinkDealFiscalDocument(data.dealConfirmationId, data.fiscalDocumentId);
  });
  handle(IPC_CHANNELS.addDealConfirmationClause, (_event, payload: unknown) => repository.addDealConfirmationClause(payload));
  handle(IPC_CHANNELS.updateDealConfirmationClause, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateDealConfirmationClause(data.id, data.input);
  });
  handle(IPC_CHANNELS.removeDealConfirmationClause, (_event, payload: unknown) => repository.removeDealConfirmationClause(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.reorderDealConfirmationClauses, (_event, payload: unknown) => {
    const data = z.object({ dealConfirmationId: z.string().uuid(), clauseIds: z.array(z.string().uuid()) }).parse(payload);
    return repository.reorderDealConfirmationClauses(data.dealConfirmationId, data.clauseIds);
  });
  handle(IPC_CHANNELS.addDealPaymentTerm, (_event, payload: unknown) => repository.addDealPaymentTerm(payload));
  handle(IPC_CHANNELS.updateDealPaymentTerm, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateDealPaymentTerm(data.id, data.input);
  });
  handle(IPC_CHANNELS.removeDealPaymentTerm, (_event, payload: unknown) => repository.removeDealPaymentTerm(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.addDealSigner, (_event, payload: unknown) => repository.addDealSigner(payload));
  handle(IPC_CHANNELS.updateDealSigner, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateDealSigner(data.id, data.input);
  });
  handle(IPC_CHANNELS.removeDealSigner, (_event, payload: unknown) => repository.removeDealSigner(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.calculateDealTotals, (_event, payload: unknown) => repository.calculateDealTotals(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.validateDealForIssue, (_event, payload: unknown) => repository.listDealPendingIssues(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.submitDealConfirmationForReview, (_event, payload: unknown) => repository.submitDealConfirmationForReview(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.generateDealConfirmationPreview, async (_event, payload: unknown) => {
    const destinationDir = await selectExportDirectory("Escolha a pasta para salvar a previa da confirmacao");
    if (!destinationDir) return null;
    const detail = await repository.generateDealConfirmationPreview(z.string().uuid().parse(payload));
    copyCurrentDealDocumentToDirectory(repository, detail.confirmation.issuedDocumentVersionId ?? detail.documents.at(-1)?.id ?? null, destinationDir);
    return detail;
  });
  handle(IPC_CHANNELS.issueDealConfirmation, async (_event, payload: unknown) => {
    const destinationDir = await selectExportDirectory("Escolha a pasta para salvar a confirmacao emitida");
    if (!destinationDir) return null;
    const detail = await repository.issueDealConfirmation(z.string().uuid().parse(payload));
    copyCurrentDealDocumentToDirectory(repository, detail.confirmation.issuedDocumentVersionId, destinationDir);
    return detail;
  });
  handle(IPC_CHANNELS.markDealConfirmationSentForSignature, (_event, payload: unknown) => repository.markDealConfirmationSentForSignature(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.importSignedDealConfirmationDocument, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.object({ token: z.string().uuid().optional(), sourcePath: z.string().optional(), notes: z.string().nullable().optional() }) }).parse(payload);
    const sourcePath = data.input.sourcePath ?? (data.input.token ? signedDealPdfTokens.get(data.input.token) : undefined);
    if (!sourcePath) throw new Error("PDF assinado selecionado expirou.");
    return repository.importSignedDealConfirmationDocument(data.id, { ...data.input, sourcePath });
  });
  handle(IPC_CHANNELS.updateDealSignatureStatus, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), signatureStatus: z.string() }).parse(payload);
    return repository.updateDealSignatureStatus(data.id, data.signatureStatus);
  });
  handle(IPC_CHANNELS.cancelDealConfirmation, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), reason: z.string().min(1) }).parse(payload);
    return repository.cancelDealConfirmation(data.id, data.reason);
  });
  handle(IPC_CHANNELS.replaceDealConfirmation, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), reason: z.string().min(1) }).parse(payload);
    return repository.replaceDealConfirmation(data.id, data.reason);
  });
  handle(IPC_CHANNELS.listDealPendingIssues, (_event, payload: unknown) => repository.listDealPendingIssues(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.listDealConfirmationTemplates, (_event, payload: unknown) =>
    repository.listDealConfirmationTemplates(z.object({ organizationId: z.string().uuid().optional(), ownLegalEntityId: z.string().uuid().optional(), status: z.enum(["active", "inactive", "all"]).optional() }).optional().parse(payload) ?? {})
  );
  handle(IPC_CHANNELS.getDealConfirmationTemplate, (_event, payload: unknown) => repository.getDealConfirmationTemplate(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.createDealConfirmationTemplate, (_event, payload: unknown) => repository.createDealConfirmationTemplate(payload));
  handle(IPC_CHANNELS.updateDealConfirmationTemplate, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateDealConfirmationTemplate(data.id, data.input);
  });
  handle(IPC_CHANNELS.duplicateDealConfirmationTemplate, (_event, payload: unknown) => repository.duplicateDealConfirmationTemplate(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.setDefaultDealConfirmationTemplate, (_event, payload: unknown) => repository.setDefaultDealConfirmationTemplate(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.activateDealConfirmationTemplate, (_event, payload: unknown) => repository.activateDealConfirmationTemplate(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.deactivateDealConfirmationTemplate, (_event, payload: unknown) => repository.deactivateDealConfirmationTemplate(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.previewDealConfirmationTemplate, (_event, payload: unknown) => repository.previewDealConfirmationTemplate(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.listDealClauseTemplates, (_event, payload: unknown) => repository.listDealClauseTemplates(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.getDealClauseTemplate, (_event, payload: unknown) => repository.getDealClauseTemplate(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.createDealClauseTemplate, (_event, payload: unknown) => repository.createDealClauseTemplate(payload));
  handle(IPC_CHANNELS.updateDealClauseTemplate, (_event, payload: unknown) => {
    const data = z.object({ id: z.string().uuid(), input: z.unknown() }).parse(payload);
    return repository.updateDealClauseTemplate(data.id, data.input);
  });
  handle(IPC_CHANNELS.duplicateDealClauseTemplate, (_event, payload: unknown) => repository.duplicateDealClauseTemplate(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.activateDealClauseTemplate, (_event, payload: unknown) => repository.activateDealClauseTemplate(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.deactivateDealClauseTemplate, (_event, payload: unknown) => repository.deactivateDealClauseTemplate(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.listDealDocumentVersions, (_event, payload: unknown) => repository.listDealDocumentVersions(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.getDealDocumentVersion, (_event, payload: unknown) => repository.getDealDocumentVersion(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.openDealDocument, async (_event, payload: unknown) => {
    const result = await shell.openPath(repository.getDealDocumentPath(z.string().uuid().parse(payload)));
    if (result) throw new Error(result);
    return true;
  });
  handle(IPC_CHANNELS.getDealDocumentBytes, (_event, payload: unknown) => readFileSync(repository.getDealDocumentPath(z.string().uuid().parse(payload))).toString("base64"));
  handle(IPC_CHANNELS.revealDealDocumentFolder, (_event, payload: unknown) => {
    shell.showItemInFolder(repository.getDealDocumentPath(z.string().uuid().parse(payload)));
    return true;
  });
  handle(IPC_CHANNELS.validateSignedDealPdf, (_event, payload: unknown) => repository.validateSignedDealPdf(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.calculateDealDocumentHash, (_event, payload: unknown) => repository.calculateDealDocumentHash(z.string().uuid().parse(payload)));
  handle(IPC_CHANNELS.previewDealConfirmationNumber, (_event, payload: unknown) => {
    const data = z.object({ organizationId: z.string().uuid(), ownLegalEntityId: z.string().uuid() }).parse(payload);
    return repository.previewDealConfirmationNumber(data.organizationId, data.ownLegalEntityId);
  });
  handle(IPC_CHANNELS.reserveDealConfirmationNumber, (_event, payload: unknown) => {
    const data = z.object({ organizationId: z.string().uuid(), ownLegalEntityId: z.string().uuid() }).parse(payload);
    return repository.reserveDealConfirmationNumber(data.organizationId, data.ownLegalEntityId);
  });
  handle(IPC_CHANNELS.generateConfirmationReport, async (_event, payload: unknown) => {
    const destinationDir = await selectExportDirectory("Escolha a pasta para salvar o relatorio de confirmacoes");
    if (!destinationDir) return null;
    const report = await repository.generateConfirmationReport(payload);
    const exportedPath = copyGeneratedFileToDirectory(report.storedFilePath, destinationDir, report.fileName);
    return { ...report, fileName: basename(exportedPath), storedFilePath: exportedPath };
  });
  handle(IPC_CHANNELS.getDealConfirmationSummary, (_event, payload: unknown) => repository.getDealConfirmationSummary(payload));
  handle(IPC_CHANNELS.selectSignedDealPdf, async () => {
    const result = await dialog.showOpenDialog({ properties: ["openFile"], filters: [{ name: "PDF assinado", extensions: ["pdf"] }] });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const token = randomUUID();
    signedDealPdfTokens.set(token, filePath);
    return { token, fileName: basename(filePath), sizeBytes: statSync(filePath).size };
  });
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

async function selectExportDirectory(title: string): Promise<string | null> {
  const result = await dialog.showOpenDialog({ title, properties: ["openDirectory", "createDirectory"] });
  return result.canceled ? null : result.filePaths[0] ?? null;
}

function copyGeneratedFileToDirectory(sourcePath: string | null | undefined, destinationDir: string, fileName?: string | null): string {
  if (!sourcePath) throw new Error("Arquivo gerado nao encontrado.");
  mkdirSync(destinationDir, { recursive: true });
  const targetPath = join(destinationDir, sanitizeExportFileName(fileName || basename(sourcePath)));
  copyFileSync(sourcePath, targetPath);
  return targetPath;
}

function copyCurrentDealDocumentToDirectory(repository: AppRepository, documentVersionId: string | null | undefined, destinationDir: string): void {
  if (!documentVersionId) throw new Error("Documento gerado nao encontrado.");
  const document = repository.getDealDocumentVersion(documentVersionId);
  copyGeneratedFileToDirectory(document.storedFilePath, destinationDir, document.originalFileName);
}

function sanitizeExportFileName(fileName: string): string {
  const sanitized = Array.from(fileName)
    .map((char) => (char.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(char) ? "-" : char))
    .join("")
    .trim();
  return sanitized || "arquivo-gerado";
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
