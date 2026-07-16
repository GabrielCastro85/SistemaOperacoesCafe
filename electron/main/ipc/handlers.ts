import type { IpcMain } from "electron";
import { z } from "zod";
import { IPC_CHANNELS } from "../../../src/shared/ipc/channels.js";
import type { Diagnostics } from "../../../src/shared/types/domain.js";
import { getCurrentMigration } from "../database/database.js";
import type { AppRepository } from "../services/appRepository.js";
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
  ipcMain.handle(IPC_CHANNELS.getDiagnostics, () => createDiagnostics(context, repository));
  ipcMain.handle(IPC_CHANNELS.setActiveLegalEntity, (_event, payload: unknown) => {
    const legalEntityId = z.string().uuid().parse(payload);
    return repository.setActiveLegalEntity(legalEntityId);
  });
}
