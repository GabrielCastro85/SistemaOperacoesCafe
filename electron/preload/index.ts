import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../../src/shared/ipc/channels.js";
import type {
  ActiveContext,
  BootstrapData,
  BrandingAssetKind,
  BusinessPartner,
  BusinessPartnerLegalEntity,
  BusinessPartnerRole,
  ClientBillingProfile,
  Diagnostics,
  InstallationProfile,
  LegalEntity,
  Location,
  PartnerContact,
  Product,
  ResolveRateResult,
  ServiceRateRule,
  Organization,
  OrganizationListItem
} from "../../src/shared/types/domain.js";
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
  listBusinessPartners: (filters?: { search?: string; role?: BusinessPartnerRole; organizationId?: string; status?: "active" | "inactive" | "all" }) => Promise<BusinessPartner[]>;
  getBusinessPartner: (id: string) => Promise<BusinessPartner>;
  createBusinessPartner: (input: unknown) => Promise<BusinessPartner>;
  updateBusinessPartner: (id: string, input: unknown) => Promise<BusinessPartner>;
  activateBusinessPartner: (id: string) => Promise<BusinessPartner>;
  deactivateBusinessPartner: (id: string) => Promise<BusinessPartner>;
  addBusinessPartnerRole: (id: string, role: BusinessPartnerRole) => Promise<BusinessPartner>;
  removeBusinessPartnerRole: (id: string, role: BusinessPartnerRole) => Promise<BusinessPartner>;
  listPartnerLegalEntities: (businessPartnerId: string) => Promise<BusinessPartnerLegalEntity[]>;
  createPartnerLegalEntity: (input: unknown) => Promise<BusinessPartnerLegalEntity>;
  updatePartnerLegalEntity: (id: string, input: unknown) => Promise<BusinessPartnerLegalEntity>;
  activatePartnerLegalEntity: (id: string) => Promise<BusinessPartnerLegalEntity>;
  deactivatePartnerLegalEntity: (id: string) => Promise<BusinessPartnerLegalEntity>;
  listPartnerContacts: (businessPartnerId: string) => Promise<PartnerContact[]>;
  createPartnerContact: (input: unknown) => Promise<PartnerContact>;
  updatePartnerContact: (id: string, input: unknown) => Promise<PartnerContact>;
  activatePartnerContact: (id: string) => Promise<PartnerContact>;
  deactivatePartnerContact: (id: string) => Promise<PartnerContact>;
  listProducts: (filters?: { search?: string; organizationId?: string; category?: string; status?: "active" | "inactive" | "all" }) => Promise<Product[]>;
  getProduct: (id: string) => Promise<Product>;
  createProduct: (input: unknown) => Promise<Product>;
  updateProduct: (id: string, input: unknown) => Promise<Product>;
  activateProduct: (id: string) => Promise<Product>;
  deactivateProduct: (id: string) => Promise<Product>;
  getBillingProfile: (businessPartnerId: string) => Promise<ClientBillingProfile | null>;
  upsertBillingProfile: (input: unknown) => Promise<ClientBillingProfile>;
  activateBillingProfile: (id: string) => Promise<ClientBillingProfile>;
  deactivateBillingProfile: (id: string) => Promise<ClientBillingProfile>;
  listServiceRateRules: (filters?: { businessPartnerId?: string; organizationId?: string; operationScope?: string; productId?: string; ownLegalEntityId?: string; status?: "active" | "inactive" | "all" }) => Promise<ServiceRateRule[]>;
  getServiceRateRule: (id: string) => Promise<ServiceRateRule>;
  createServiceRateRule: (input: unknown) => Promise<ServiceRateRule>;
  updateServiceRateRule: (id: string, input: unknown) => Promise<ServiceRateRule>;
  activateServiceRateRule: (id: string) => Promise<ServiceRateRule>;
  deactivateServiceRateRule: (id: string) => Promise<ServiceRateRule>;
  resolveServiceRateRule: (input: unknown) => Promise<ResolveRateResult>;
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
  deactivateLocation: (id) => ipcRenderer.invoke(IPC_CHANNELS.deactivateLocation, id) as Promise<Location>,
  listBusinessPartners: (filters) => ipcRenderer.invoke(IPC_CHANNELS.listBusinessPartners, filters) as Promise<BusinessPartner[]>,
  getBusinessPartner: (id) => ipcRenderer.invoke(IPC_CHANNELS.getBusinessPartner, id) as Promise<BusinessPartner>,
  createBusinessPartner: (input) => ipcRenderer.invoke(IPC_CHANNELS.createBusinessPartner, input) as Promise<BusinessPartner>,
  updateBusinessPartner: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.updateBusinessPartner, { id, input }) as Promise<BusinessPartner>,
  activateBusinessPartner: (id) => ipcRenderer.invoke(IPC_CHANNELS.activateBusinessPartner, id) as Promise<BusinessPartner>,
  deactivateBusinessPartner: (id) => ipcRenderer.invoke(IPC_CHANNELS.deactivateBusinessPartner, id) as Promise<BusinessPartner>,
  addBusinessPartnerRole: (id, role) => ipcRenderer.invoke(IPC_CHANNELS.addBusinessPartnerRole, { id, role }) as Promise<BusinessPartner>,
  removeBusinessPartnerRole: (id, role) => ipcRenderer.invoke(IPC_CHANNELS.removeBusinessPartnerRole, { id, role }) as Promise<BusinessPartner>,
  listPartnerLegalEntities: (businessPartnerId) => ipcRenderer.invoke(IPC_CHANNELS.listPartnerLegalEntities, businessPartnerId) as Promise<BusinessPartnerLegalEntity[]>,
  createPartnerLegalEntity: (input) => ipcRenderer.invoke(IPC_CHANNELS.createPartnerLegalEntity, input) as Promise<BusinessPartnerLegalEntity>,
  updatePartnerLegalEntity: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.updatePartnerLegalEntity, { id, input }) as Promise<BusinessPartnerLegalEntity>,
  activatePartnerLegalEntity: (id) => ipcRenderer.invoke(IPC_CHANNELS.activatePartnerLegalEntity, id) as Promise<BusinessPartnerLegalEntity>,
  deactivatePartnerLegalEntity: (id) => ipcRenderer.invoke(IPC_CHANNELS.deactivatePartnerLegalEntity, id) as Promise<BusinessPartnerLegalEntity>,
  listPartnerContacts: (businessPartnerId) => ipcRenderer.invoke(IPC_CHANNELS.listPartnerContacts, businessPartnerId) as Promise<PartnerContact[]>,
  createPartnerContact: (input) => ipcRenderer.invoke(IPC_CHANNELS.createPartnerContact, input) as Promise<PartnerContact>,
  updatePartnerContact: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.updatePartnerContact, { id, input }) as Promise<PartnerContact>,
  activatePartnerContact: (id) => ipcRenderer.invoke(IPC_CHANNELS.activatePartnerContact, id) as Promise<PartnerContact>,
  deactivatePartnerContact: (id) => ipcRenderer.invoke(IPC_CHANNELS.deactivatePartnerContact, id) as Promise<PartnerContact>,
  listProducts: (filters) => ipcRenderer.invoke(IPC_CHANNELS.listProducts, filters) as Promise<Product[]>,
  getProduct: (id) => ipcRenderer.invoke(IPC_CHANNELS.getProduct, id) as Promise<Product>,
  createProduct: (input) => ipcRenderer.invoke(IPC_CHANNELS.createProduct, input) as Promise<Product>,
  updateProduct: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.updateProduct, { id, input }) as Promise<Product>,
  activateProduct: (id) => ipcRenderer.invoke(IPC_CHANNELS.activateProduct, id) as Promise<Product>,
  deactivateProduct: (id) => ipcRenderer.invoke(IPC_CHANNELS.deactivateProduct, id) as Promise<Product>,
  getBillingProfile: (businessPartnerId) => ipcRenderer.invoke(IPC_CHANNELS.getBillingProfile, businessPartnerId) as Promise<ClientBillingProfile | null>,
  upsertBillingProfile: (input) => ipcRenderer.invoke(IPC_CHANNELS.upsertBillingProfile, input) as Promise<ClientBillingProfile>,
  activateBillingProfile: (id) => ipcRenderer.invoke(IPC_CHANNELS.activateBillingProfile, id) as Promise<ClientBillingProfile>,
  deactivateBillingProfile: (id) => ipcRenderer.invoke(IPC_CHANNELS.deactivateBillingProfile, id) as Promise<ClientBillingProfile>,
  listServiceRateRules: (filters) => ipcRenderer.invoke(IPC_CHANNELS.listServiceRateRules, filters) as Promise<ServiceRateRule[]>,
  getServiceRateRule: (id) => ipcRenderer.invoke(IPC_CHANNELS.getServiceRateRule, id) as Promise<ServiceRateRule>,
  createServiceRateRule: (input) => ipcRenderer.invoke(IPC_CHANNELS.createServiceRateRule, input) as Promise<ServiceRateRule>,
  updateServiceRateRule: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.updateServiceRateRule, { id, input }) as Promise<ServiceRateRule>,
  activateServiceRateRule: (id) => ipcRenderer.invoke(IPC_CHANNELS.activateServiceRateRule, id) as Promise<ServiceRateRule>,
  deactivateServiceRateRule: (id) => ipcRenderer.invoke(IPC_CHANNELS.deactivateServiceRateRule, id) as Promise<ServiceRateRule>,
  resolveServiceRateRule: (input) => ipcRenderer.invoke(IPC_CHANNELS.resolveServiceRateRule, input) as Promise<ResolveRateResult>
};

contextBridge.exposeInMainWorld("operationsCafe", api);
