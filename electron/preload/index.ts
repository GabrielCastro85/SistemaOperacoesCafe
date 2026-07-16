import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../../src/shared/ipc/channels.js";
import type { ActiveContext, BootstrapData, BrandingAssetKind, Diagnostics, InstallationProfile, LegalEntity, Location, Organization, OrganizationListItem } from "../../src/shared/types/domain.js";
import type { saveInstallationProfileSchema } from "../../src/shared/schemas/domainSchemas.js";
import type { z } from "zod";

type SaveInstallationProfileInput = z.infer<typeof saveInstallationProfileSchema>;

export interface OperationsCafeApi {
  getBootstrapData: () => Promise<BootstrapData>;
  saveInstallationProfile: (profile: SaveInstallationProfileInput) => Promise<InstallationProfile>;
  updateInstallationProfile: (profile: SaveInstallationProfileInput & { confirmVariantChange?: boolean }) => Promise<InstallationProfile>;
  getActiveContext: () => Promise<ActiveContext>;
  getDiagnostics: () => Promise<Diagnostics>;
  setActiveLegalEntity: (legalEntityId: string) => Promise<InstallationProfile>;
  setActiveOrganization: (organizationId: string) => Promise<InstallationProfile>;
  listOrganizations: (filters?: { search?: string; status?: "active" | "inactive" | "all" }) => Promise<OrganizationListItem[]>;
  getOrganization: (id: string) => Promise<Organization>;
  createOrganization: (input: unknown) => Promise<Organization>;
  updateOrganization: (id: string, input: unknown) => Promise<Organization>;
  activateOrganization: (id: string) => Promise<Organization>;
  deactivateOrganization: (id: string, replacementOrganizationId?: string) => Promise<Organization>;
  selectOrganizationBrandingAsset: (organizationId: string, kind: BrandingAssetKind) => Promise<Organization>;
  listLegalEntities: (filters?: { search?: string; organizationId?: string; state?: string; status?: "active" | "inactive" | "all" }) => Promise<LegalEntity[]>;
  getLegalEntity: (id: string) => Promise<LegalEntity>;
  createLegalEntity: (input: unknown) => Promise<LegalEntity>;
  updateLegalEntity: (id: string, input: unknown) => Promise<LegalEntity>;
  activateLegalEntity: (id: string) => Promise<LegalEntity>;
  deactivateLegalEntity: (id: string, replacementLegalEntityId?: string) => Promise<LegalEntity>;
  listLocations: (filters?: { search?: string; organizationId?: string; legalEntityId?: string; type?: string; status?: "active" | "inactive" | "all" }) => Promise<Location[]>;
  getLocation: (id: string) => Promise<Location>;
  createLocation: (input: unknown) => Promise<Location>;
  updateLocation: (id: string, input: unknown) => Promise<Location>;
  activateLocation: (id: string) => Promise<Location>;
  deactivateLocation: (id: string) => Promise<Location>;
}

const api: OperationsCafeApi = {
  getBootstrapData: () => ipcRenderer.invoke(IPC_CHANNELS.getBootstrapData) as Promise<BootstrapData>,
  saveInstallationProfile: (profile) =>
    ipcRenderer.invoke(IPC_CHANNELS.saveInstallationProfile, profile) as Promise<InstallationProfile>,
  updateInstallationProfile: (profile) =>
    ipcRenderer.invoke(IPC_CHANNELS.updateInstallationProfile, profile) as Promise<InstallationProfile>,
  getActiveContext: () => ipcRenderer.invoke(IPC_CHANNELS.getActiveContext) as Promise<ActiveContext>,
  getDiagnostics: () => ipcRenderer.invoke(IPC_CHANNELS.getDiagnostics) as Promise<Diagnostics>,
  setActiveLegalEntity: (legalEntityId) =>
    ipcRenderer.invoke(IPC_CHANNELS.setActiveLegalEntity, legalEntityId) as Promise<InstallationProfile>,
  setActiveOrganization: (organizationId) =>
    ipcRenderer.invoke(IPC_CHANNELS.setActiveOrganization, organizationId) as Promise<InstallationProfile>,
  listOrganizations: (filters) => ipcRenderer.invoke(IPC_CHANNELS.listOrganizations, filters) as Promise<OrganizationListItem[]>,
  getOrganization: (id) => ipcRenderer.invoke(IPC_CHANNELS.getOrganization, id) as Promise<Organization>,
  createOrganization: (input) => ipcRenderer.invoke(IPC_CHANNELS.createOrganization, input) as Promise<Organization>,
  updateOrganization: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.updateOrganization, { id, input }) as Promise<Organization>,
  activateOrganization: (id) => ipcRenderer.invoke(IPC_CHANNELS.activateOrganization, id) as Promise<Organization>,
  deactivateOrganization: (id, replacementOrganizationId) =>
    ipcRenderer.invoke(IPC_CHANNELS.deactivateOrganization, { id, replacementOrganizationId }) as Promise<Organization>,
  selectOrganizationBrandingAsset: (organizationId, kind) =>
    ipcRenderer.invoke(IPC_CHANNELS.selectOrganizationBrandingAsset, { organizationId, kind }) as Promise<Organization>,
  listLegalEntities: (filters) => ipcRenderer.invoke(IPC_CHANNELS.listLegalEntities, filters) as Promise<LegalEntity[]>,
  getLegalEntity: (id) => ipcRenderer.invoke(IPC_CHANNELS.getLegalEntity, id) as Promise<LegalEntity>,
  createLegalEntity: (input) => ipcRenderer.invoke(IPC_CHANNELS.createLegalEntity, input) as Promise<LegalEntity>,
  updateLegalEntity: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.updateLegalEntity, { id, input }) as Promise<LegalEntity>,
  activateLegalEntity: (id) => ipcRenderer.invoke(IPC_CHANNELS.activateLegalEntity, id) as Promise<LegalEntity>,
  deactivateLegalEntity: (id, replacementLegalEntityId) =>
    ipcRenderer.invoke(IPC_CHANNELS.deactivateLegalEntity, { id, replacementLegalEntityId }) as Promise<LegalEntity>,
  listLocations: (filters) => ipcRenderer.invoke(IPC_CHANNELS.listLocations, filters) as Promise<Location[]>,
  getLocation: (id) => ipcRenderer.invoke(IPC_CHANNELS.getLocation, id) as Promise<Location>,
  createLocation: (input) => ipcRenderer.invoke(IPC_CHANNELS.createLocation, input) as Promise<Location>,
  updateLocation: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.updateLocation, { id, input }) as Promise<Location>,
  activateLocation: (id) => ipcRenderer.invoke(IPC_CHANNELS.activateLocation, id) as Promise<Location>,
  deactivateLocation: (id) => ipcRenderer.invoke(IPC_CHANNELS.deactivateLocation, id) as Promise<Location>
};

contextBridge.exposeInMainWorld("operationsCafe", api);
