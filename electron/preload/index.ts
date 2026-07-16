import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../../src/shared/ipc/channels.js";
import type { BootstrapData, Diagnostics, InstallationProfile } from "../../src/shared/types/domain.js";
import type { saveInstallationProfileSchema } from "../../src/shared/schemas/domainSchemas.js";
import type { z } from "zod";

type SaveInstallationProfileInput = z.infer<typeof saveInstallationProfileSchema>;

export interface OperationsCafeApi {
  getBootstrapData: () => Promise<BootstrapData>;
  saveInstallationProfile: (profile: SaveInstallationProfileInput) => Promise<InstallationProfile>;
  getDiagnostics: () => Promise<Diagnostics>;
  setActiveLegalEntity: (legalEntityId: string) => Promise<InstallationProfile>;
}

const api: OperationsCafeApi = {
  getBootstrapData: () => ipcRenderer.invoke(IPC_CHANNELS.getBootstrapData) as Promise<BootstrapData>,
  saveInstallationProfile: (profile) =>
    ipcRenderer.invoke(IPC_CHANNELS.saveInstallationProfile, profile) as Promise<InstallationProfile>,
  getDiagnostics: () => ipcRenderer.invoke(IPC_CHANNELS.getDiagnostics) as Promise<Diagnostics>,
  setActiveLegalEntity: (legalEntityId) =>
    ipcRenderer.invoke(IPC_CHANNELS.setActiveLegalEntity, legalEntityId) as Promise<InstallationProfile>
};

contextBridge.exposeInMainWorld("operationsCafe", api);
