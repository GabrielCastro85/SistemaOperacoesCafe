import { dialog, type IpcMain } from "electron";
import { z } from "zod";
import { brandingAssetKindSchema } from "../../../src/shared/schemas/domainSchemas.js";
import { IPC_CHANNELS } from "../../../src/shared/ipc/channels.js";
import type { BrandingAssetKind } from "../../../src/shared/types/domain.js";
import type { Diagnostics } from "../../../src/shared/types/domain.js";
import { getCurrentMigration } from "../database/database.js";
import type { AppRepository } from "../services/appRepository.js";
import { copyBrandingAssetFromPath, getBrandingDialogFilters } from "../services/brandingAssets.js";
import type { AppContext } from "../services/context.js";

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
}
