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
  FiscalDocument,
  FiscalDocumentDetail,
  FiscalDocumentItem,
  Operation,
  WorkbookInspection,
  SheetPreview,
  SpreadsheetMappingTemplate,
  SpreadsheetImportJob,
  SpreadsheetImportRow,
  PartnerAlias,
  XmlFileInspection,
  XmlImportJob,
  XmlImportFile,
  FiscalDocumentEvent,
  ProductAlias,
  OperationClassificationRule,
  FiscalDocumentMergeHistory,
  ClientCharge,
  ClientChargeDetail,
  ClientLedgerEntry,
  ClientPayment,
  BillingSummary,
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
  listFiscalDocuments: (filters?: { organizationId?: string; search?: string; status?: "DRAFT" | "PENDING" | "CONFIRMED" | "CANCELED" | "all" }) => Promise<FiscalDocument[]>;
  getFiscalDocument: (id: string) => Promise<FiscalDocumentDetail>;
  createFiscalDocument: (input: unknown) => Promise<FiscalDocumentDetail>;
  updateFiscalDocument: (id: string, input: unknown) => Promise<FiscalDocumentDetail>;
  addFiscalDocumentItem: (input: unknown) => Promise<FiscalDocumentItem>;
  addOperation: (input: unknown) => Promise<Operation>;
  updateOperationManualRate: (id: string, manualRateValueCents: number, reason: string) => Promise<Operation>;
  confirmFiscalDocument: (id: string) => Promise<FiscalDocumentDetail>;
  cancelFiscalDocument: (id: string, reason: string) => Promise<FiscalDocumentDetail>;
  getOperationalIndicators: (organizationId: string) => Promise<{ documents: number; pending: number; confirmed: number; operations: number; serviceAmountCents: number }>;
  selectSpreadsheetFile: () => Promise<WorkbookInspection | null>;
  inspectSpreadsheetWorkbook: (token: string) => Promise<WorkbookInspection>;
  previewSpreadsheetSheet: (input: { token: string; sheetName: string; headerRow: number }) => Promise<SheetPreview>;
  listSpreadsheetMappingTemplates: (organizationId: string) => Promise<SpreadsheetMappingTemplate[]>;
  createSpreadsheetMappingTemplate: (input: unknown) => Promise<SpreadsheetMappingTemplate>;
  updateSpreadsheetMappingTemplate: (id: string, input: unknown) => Promise<SpreadsheetMappingTemplate>;
  duplicateSpreadsheetMappingTemplate: (id: string) => Promise<SpreadsheetMappingTemplate>;
  activateSpreadsheetMappingTemplate: (id: string) => Promise<SpreadsheetMappingTemplate>;
  deactivateSpreadsheetMappingTemplate: (id: string) => Promise<SpreadsheetMappingTemplate>;
  createSpreadsheetImportDraft: (input: unknown) => Promise<SpreadsheetImportJob>;
  validateSpreadsheetImportRows: (input: unknown) => Promise<{ job: SpreadsheetImportJob; rows: SpreadsheetImportRow[] }>;
  executeSpreadsheetImport: (input: { jobId: string; token?: string; importWarnings?: boolean }) => Promise<{ job: SpreadsheetImportJob; rows: SpreadsheetImportRow[] }>;
  getSpreadsheetImportJob: (id: string) => Promise<{ job: SpreadsheetImportJob; rows: SpreadsheetImportRow[] }>;
  listSpreadsheetImportJobs: (organizationId: string) => Promise<SpreadsheetImportJob[]>;
  cancelSpreadsheetImportJob: (id: string) => Promise<SpreadsheetImportJob>;
  revertSpreadsheetImportJob: (id: string, reason: string) => Promise<{ job: SpreadsheetImportJob; rows: SpreadsheetImportRow[] }>;
  listPartnerAliases: (organizationId: string) => Promise<PartnerAlias[]>;
  createPartnerAlias: (input: unknown) => Promise<PartnerAlias>;
  deactivatePartnerAlias: (id: string) => Promise<PartnerAlias>;
  resolvePartnerAlias: (organizationId: string, value: string) => Promise<PartnerAlias | null>;
  selectXmlFile: () => Promise<Array<{ token: string; fileName: string; sizeBytes: number }>>;
  selectXmlFiles: () => Promise<Array<{ token: string; fileName: string; sizeBytes: number }>>;
  selectXmlFolder: (includeSubfolders?: boolean) => Promise<{ folder: string | null; files: Array<{ token: string; fileName: string; sizeBytes: number }> }>;
  inspectXmlFiles: (tokens: string[]) => Promise<XmlFileInspection[]>;
  createXmlImportDraft: (input: unknown) => Promise<XmlImportJob>;
  addXmlImportFiles: (input: { jobId: string; tokens: string[] }) => Promise<{ job: XmlImportJob; files: XmlImportFile[] }>;
  updateXmlImportSettings: (id: string, settings: Record<string, unknown>) => Promise<XmlImportJob>;
  validateXmlImportJob: (id: string) => Promise<{ job: XmlImportJob; files: XmlImportFile[] }>;
  updateXmlImportFileResolution: (id: string, resolution: unknown) => Promise<XmlImportFile>;
  applyXmlBulkResolution: (jobId: string, fileIds: string[], resolution: unknown) => Promise<{ job: XmlImportJob; files: XmlImportFile[] }>;
  executeXmlImportJob: (input: { jobId: string; tokens?: string[] }) => Promise<{ job: XmlImportJob; files: XmlImportFile[] }>;
  getXmlImportJobProgress: (id: string) => Promise<XmlImportJob>;
  listXmlImportJobs: (organizationId: string) => Promise<XmlImportJob[]>;
  getXmlImportJob: (id: string) => Promise<{ job: XmlImportJob; files: XmlImportFile[] }>;
  cancelXmlImportJob: (id: string) => Promise<XmlImportJob>;
  revertXmlImportJob: (id: string, reason: string) => Promise<{ job: XmlImportJob; files: XmlImportFile[] }>;
  listFiscalDocumentEvents: (organizationId: string) => Promise<FiscalDocumentEvent[]>;
  getFiscalDocumentEvent: (id: string) => Promise<FiscalDocumentEvent>;
  linkPendingFiscalDocumentEvents: (accessKey: string) => Promise<number>;
  listProductAliases: (organizationId: string) => Promise<ProductAlias[]>;
  createProductAlias: (input: unknown) => Promise<ProductAlias>;
  updateProductAlias: (id: string, input: unknown) => Promise<ProductAlias>;
  activateProductAlias: (id: string) => Promise<ProductAlias>;
  deactivateProductAlias: (id: string) => Promise<ProductAlias>;
  resolveProductAlias: (organizationId: string, criteria: unknown) => Promise<ProductAlias | null>;
  listOperationClassificationRules: (organizationId: string) => Promise<OperationClassificationRule[]>;
  createOperationClassificationRule: (input: unknown) => Promise<OperationClassificationRule>;
  updateOperationClassificationRule: (id: string, input: unknown) => Promise<OperationClassificationRule>;
  activateOperationClassificationRule: (id: string) => Promise<OperationClassificationRule>;
  deactivateOperationClassificationRule: (id: string) => Promise<OperationClassificationRule>;
  resolveOperationClassificationRule: (input: unknown) => Promise<OperationClassificationRule | null>;
  compareXmlWithExisting: (fileId: string) => Promise<Record<string, unknown>>;
  mergeXmlIntoExisting: (fileId: string, decision: string) => Promise<FiscalDocumentDetail>;
  getFiscalDocumentMergeHistory: (fiscalDocumentId: string) => Promise<FiscalDocumentMergeHistory[]>;
  suggestChargePeriods: (input: unknown) => Promise<Array<{ periodicity: string; periodStart: string; periodEnd: string; label: string }>>;
  findEligibleChargeOperations: (input: unknown) => Promise<Operation[]>;
  createClientChargeDraft: (input: unknown) => Promise<ClientChargeDetail>;
  reserveChargeOperations: (clientChargeId: string, operationIds: string[]) => Promise<ClientChargeDetail>;
  releaseChargeOperations: (clientChargeId: string, operationIds?: string[]) => Promise<ClientChargeDetail>;
  addChargeAdjustment: (input: unknown) => Promise<ClientChargeDetail>;
  removeChargeAdjustment: (id: string) => Promise<ClientChargeDetail>;
  applyChargeCredit: (input: unknown) => Promise<ClientChargeDetail>;
  submitClientChargeForReview: (id: string) => Promise<ClientChargeDetail>;
  issueClientCharge: (id: string) => Promise<ClientChargeDetail>;
  cancelClientCharge: (id: string, reason: string) => Promise<ClientChargeDetail>;
  listClientCharges: (filters?: { organizationId?: string; clientPartnerId?: string; status?: string }) => Promise<ClientCharge[]>;
  getClientCharge: (id: string) => Promise<ClientChargeDetail>;
  regenerateChargeDocuments: (id: string) => Promise<ClientChargeDetail>;
  listLedgerEntries: (filters: { organizationId: string; ownLegalEntityId?: string; clientPartnerId?: string }) => Promise<ClientLedgerEntry[]>;
  createLedgerEntry: (input: unknown) => Promise<ClientLedgerEntry>;
  createAdvance: (input: unknown) => Promise<ClientLedgerEntry>;
  createCredit: (input: unknown) => Promise<ClientLedgerEntry>;
  getAvailableCredits: (organizationId: string, ownLegalEntityId: string, clientPartnerId: string) => Promise<ClientLedgerEntry[]>;
  createClientPayment: (input: unknown) => Promise<ClientPayment>;
  allocateClientPayment: (input: unknown) => Promise<ClientChargeDetail>;
  getBillingSummary: (organizationId: string) => Promise<BillingSummary>;
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
  resolveServiceRateRule: (input) => ipcRenderer.invoke(IPC_CHANNELS.resolveServiceRateRule, input) as Promise<ResolveRateResult>,
  listFiscalDocuments: (filters) => ipcRenderer.invoke(IPC_CHANNELS.listFiscalDocuments, filters) as Promise<FiscalDocument[]>,
  getFiscalDocument: (id) => ipcRenderer.invoke(IPC_CHANNELS.getFiscalDocument, id) as Promise<FiscalDocumentDetail>,
  createFiscalDocument: (input) => ipcRenderer.invoke(IPC_CHANNELS.createFiscalDocument, input) as Promise<FiscalDocumentDetail>,
  updateFiscalDocument: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.updateFiscalDocument, { id, input }) as Promise<FiscalDocumentDetail>,
  addFiscalDocumentItem: (input) => ipcRenderer.invoke(IPC_CHANNELS.addFiscalDocumentItem, input) as Promise<FiscalDocumentItem>,
  addOperation: (input) => ipcRenderer.invoke(IPC_CHANNELS.addOperation, input) as Promise<Operation>,
  updateOperationManualRate: (id, manualRateValueCents, reason) =>
    ipcRenderer.invoke(IPC_CHANNELS.updateOperationManualRate, { id, manualRateValueCents, reason }) as Promise<Operation>,
  confirmFiscalDocument: (id) => ipcRenderer.invoke(IPC_CHANNELS.confirmFiscalDocument, id) as Promise<FiscalDocumentDetail>,
  cancelFiscalDocument: (id, reason) => ipcRenderer.invoke(IPC_CHANNELS.cancelFiscalDocument, { id, reason }) as Promise<FiscalDocumentDetail>,
  getOperationalIndicators: (organizationId) =>
    ipcRenderer.invoke(IPC_CHANNELS.getOperationalIndicators, organizationId) as Promise<{
      documents: number;
      pending: number;
      confirmed: number;
      operations: number;
      serviceAmountCents: number;
    }>,
  selectSpreadsheetFile: () => ipcRenderer.invoke(IPC_CHANNELS.selectSpreadsheetFile) as Promise<WorkbookInspection | null>,
  inspectSpreadsheetWorkbook: (token) => ipcRenderer.invoke(IPC_CHANNELS.inspectSpreadsheetWorkbook, token) as Promise<WorkbookInspection>,
  previewSpreadsheetSheet: (input) => ipcRenderer.invoke(IPC_CHANNELS.previewSpreadsheetSheet, input) as Promise<SheetPreview>,
  listSpreadsheetMappingTemplates: (organizationId) =>
    ipcRenderer.invoke(IPC_CHANNELS.listSpreadsheetMappingTemplates, organizationId) as Promise<SpreadsheetMappingTemplate[]>,
  createSpreadsheetMappingTemplate: (input) => ipcRenderer.invoke(IPC_CHANNELS.createSpreadsheetMappingTemplate, input) as Promise<SpreadsheetMappingTemplate>,
  updateSpreadsheetMappingTemplate: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.updateSpreadsheetMappingTemplate, { id, input }) as Promise<SpreadsheetMappingTemplate>,
  duplicateSpreadsheetMappingTemplate: (id) => ipcRenderer.invoke(IPC_CHANNELS.duplicateSpreadsheetMappingTemplate, id) as Promise<SpreadsheetMappingTemplate>,
  activateSpreadsheetMappingTemplate: (id) => ipcRenderer.invoke(IPC_CHANNELS.activateSpreadsheetMappingTemplate, id) as Promise<SpreadsheetMappingTemplate>,
  deactivateSpreadsheetMappingTemplate: (id) => ipcRenderer.invoke(IPC_CHANNELS.deactivateSpreadsheetMappingTemplate, id) as Promise<SpreadsheetMappingTemplate>,
  createSpreadsheetImportDraft: (input) => ipcRenderer.invoke(IPC_CHANNELS.createSpreadsheetImportDraft, input) as Promise<SpreadsheetImportJob>,
  validateSpreadsheetImportRows: (input) => ipcRenderer.invoke(IPC_CHANNELS.validateSpreadsheetImportRows, input) as Promise<{ job: SpreadsheetImportJob; rows: SpreadsheetImportRow[] }>,
  executeSpreadsheetImport: (input) => ipcRenderer.invoke(IPC_CHANNELS.executeSpreadsheetImport, input) as Promise<{ job: SpreadsheetImportJob; rows: SpreadsheetImportRow[] }>,
  getSpreadsheetImportJob: (id) => ipcRenderer.invoke(IPC_CHANNELS.getSpreadsheetImportJob, id) as Promise<{ job: SpreadsheetImportJob; rows: SpreadsheetImportRow[] }>,
  listSpreadsheetImportJobs: (organizationId) => ipcRenderer.invoke(IPC_CHANNELS.listSpreadsheetImportJobs, organizationId) as Promise<SpreadsheetImportJob[]>,
  cancelSpreadsheetImportJob: (id) => ipcRenderer.invoke(IPC_CHANNELS.cancelSpreadsheetImportJob, id) as Promise<SpreadsheetImportJob>,
  revertSpreadsheetImportJob: (id, reason) => ipcRenderer.invoke(IPC_CHANNELS.revertSpreadsheetImportJob, { id, reason }) as Promise<{ job: SpreadsheetImportJob; rows: SpreadsheetImportRow[] }>,
  listPartnerAliases: (organizationId) => ipcRenderer.invoke(IPC_CHANNELS.listPartnerAliases, organizationId) as Promise<PartnerAlias[]>,
  createPartnerAlias: (input) => ipcRenderer.invoke(IPC_CHANNELS.createPartnerAlias, input) as Promise<PartnerAlias>,
  deactivatePartnerAlias: (id) => ipcRenderer.invoke(IPC_CHANNELS.deactivatePartnerAlias, id) as Promise<PartnerAlias>,
  resolvePartnerAlias: (organizationId, value) => ipcRenderer.invoke(IPC_CHANNELS.resolvePartnerAlias, { organizationId, value }) as Promise<PartnerAlias | null>,
  selectXmlFile: () => ipcRenderer.invoke(IPC_CHANNELS.selectXmlFile) as Promise<Array<{ token: string; fileName: string; sizeBytes: number }>>,
  selectXmlFiles: () => ipcRenderer.invoke(IPC_CHANNELS.selectXmlFiles) as Promise<Array<{ token: string; fileName: string; sizeBytes: number }>>,
  selectXmlFolder: (includeSubfolders) => ipcRenderer.invoke(IPC_CHANNELS.selectXmlFolder, { includeSubfolders }) as Promise<{ folder: string | null; files: Array<{ token: string; fileName: string; sizeBytes: number }> }>,
  inspectXmlFiles: (tokens) => ipcRenderer.invoke(IPC_CHANNELS.inspectXmlFiles, tokens) as Promise<XmlFileInspection[]>,
  createXmlImportDraft: (input) => ipcRenderer.invoke(IPC_CHANNELS.createXmlImportDraft, input) as Promise<XmlImportJob>,
  addXmlImportFiles: (input) => ipcRenderer.invoke(IPC_CHANNELS.addXmlImportFiles, input) as Promise<{ job: XmlImportJob; files: XmlImportFile[] }>,
  updateXmlImportSettings: (id, settings) => ipcRenderer.invoke(IPC_CHANNELS.updateXmlImportSettings, { id, settings }) as Promise<XmlImportJob>,
  validateXmlImportJob: (id) => ipcRenderer.invoke(IPC_CHANNELS.validateXmlImportJob, id) as Promise<{ job: XmlImportJob; files: XmlImportFile[] }>,
  updateXmlImportFileResolution: (id, resolution) => ipcRenderer.invoke(IPC_CHANNELS.updateXmlImportFileResolution, { id, resolution }) as Promise<XmlImportFile>,
  applyXmlBulkResolution: (jobId, fileIds, resolution) => ipcRenderer.invoke(IPC_CHANNELS.applyXmlBulkResolution, { jobId, fileIds, resolution }) as Promise<{ job: XmlImportJob; files: XmlImportFile[] }>,
  executeXmlImportJob: (input) => ipcRenderer.invoke(IPC_CHANNELS.executeXmlImportJob, input) as Promise<{ job: XmlImportJob; files: XmlImportFile[] }>,
  getXmlImportJobProgress: (id) => ipcRenderer.invoke(IPC_CHANNELS.getXmlImportJobProgress, id) as Promise<XmlImportJob>,
  listXmlImportJobs: (organizationId) => ipcRenderer.invoke(IPC_CHANNELS.listXmlImportJobs, organizationId) as Promise<XmlImportJob[]>,
  getXmlImportJob: (id) => ipcRenderer.invoke(IPC_CHANNELS.getXmlImportJob, id) as Promise<{ job: XmlImportJob; files: XmlImportFile[] }>,
  cancelXmlImportJob: (id) => ipcRenderer.invoke(IPC_CHANNELS.cancelXmlImportJob, id) as Promise<XmlImportJob>,
  revertXmlImportJob: (id, reason) => ipcRenderer.invoke(IPC_CHANNELS.revertXmlImportJob, { id, reason }) as Promise<{ job: XmlImportJob; files: XmlImportFile[] }>,
  listFiscalDocumentEvents: (organizationId) => ipcRenderer.invoke(IPC_CHANNELS.listFiscalDocumentEvents, organizationId) as Promise<FiscalDocumentEvent[]>,
  getFiscalDocumentEvent: (id) => ipcRenderer.invoke(IPC_CHANNELS.getFiscalDocumentEvent, id) as Promise<FiscalDocumentEvent>,
  linkPendingFiscalDocumentEvents: (accessKey) => ipcRenderer.invoke(IPC_CHANNELS.linkPendingFiscalDocumentEvents, accessKey) as Promise<number>,
  listProductAliases: (organizationId) => ipcRenderer.invoke(IPC_CHANNELS.listProductAliases, organizationId) as Promise<ProductAlias[]>,
  createProductAlias: (input) => ipcRenderer.invoke(IPC_CHANNELS.createProductAlias, input) as Promise<ProductAlias>,
  updateProductAlias: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.updateProductAlias, { id, input }) as Promise<ProductAlias>,
  activateProductAlias: (id) => ipcRenderer.invoke(IPC_CHANNELS.activateProductAlias, id) as Promise<ProductAlias>,
  deactivateProductAlias: (id) => ipcRenderer.invoke(IPC_CHANNELS.deactivateProductAlias, id) as Promise<ProductAlias>,
  resolveProductAlias: (organizationId, criteria) => ipcRenderer.invoke(IPC_CHANNELS.resolveProductAlias, { organizationId, criteria }) as Promise<ProductAlias | null>,
  listOperationClassificationRules: (organizationId) => ipcRenderer.invoke(IPC_CHANNELS.listOperationClassificationRules, organizationId) as Promise<OperationClassificationRule[]>,
  createOperationClassificationRule: (input) => ipcRenderer.invoke(IPC_CHANNELS.createOperationClassificationRule, input) as Promise<OperationClassificationRule>,
  updateOperationClassificationRule: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.updateOperationClassificationRule, { id, input }) as Promise<OperationClassificationRule>,
  activateOperationClassificationRule: (id) => ipcRenderer.invoke(IPC_CHANNELS.activateOperationClassificationRule, id) as Promise<OperationClassificationRule>,
  deactivateOperationClassificationRule: (id) => ipcRenderer.invoke(IPC_CHANNELS.deactivateOperationClassificationRule, id) as Promise<OperationClassificationRule>,
  resolveOperationClassificationRule: (input) => ipcRenderer.invoke(IPC_CHANNELS.resolveOperationClassificationRule, input) as Promise<OperationClassificationRule | null>,
  compareXmlWithExisting: (fileId) => ipcRenderer.invoke(IPC_CHANNELS.compareXmlWithExisting, fileId) as Promise<Record<string, unknown>>,
  mergeXmlIntoExisting: (fileId, decision) => ipcRenderer.invoke(IPC_CHANNELS.mergeXmlIntoExisting, { fileId, decision }) as Promise<FiscalDocumentDetail>,
  getFiscalDocumentMergeHistory: (fiscalDocumentId) => ipcRenderer.invoke(IPC_CHANNELS.getFiscalDocumentMergeHistory, fiscalDocumentId) as Promise<FiscalDocumentMergeHistory[]>,
  suggestChargePeriods: (input) => ipcRenderer.invoke(IPC_CHANNELS.suggestChargePeriods, input) as Promise<Array<{ periodicity: string; periodStart: string; periodEnd: string; label: string }>>,
  findEligibleChargeOperations: (input) => ipcRenderer.invoke(IPC_CHANNELS.findEligibleChargeOperations, input) as Promise<Operation[]>,
  createClientChargeDraft: (input) => ipcRenderer.invoke(IPC_CHANNELS.createClientChargeDraft, input) as Promise<ClientChargeDetail>,
  reserveChargeOperations: (clientChargeId, operationIds) => ipcRenderer.invoke(IPC_CHANNELS.reserveChargeOperations, { clientChargeId, operationIds }) as Promise<ClientChargeDetail>,
  releaseChargeOperations: (clientChargeId, operationIds) => ipcRenderer.invoke(IPC_CHANNELS.releaseChargeOperations, { clientChargeId, operationIds }) as Promise<ClientChargeDetail>,
  addChargeAdjustment: (input) => ipcRenderer.invoke(IPC_CHANNELS.addChargeAdjustment, input) as Promise<ClientChargeDetail>,
  removeChargeAdjustment: (id) => ipcRenderer.invoke(IPC_CHANNELS.removeChargeAdjustment, id) as Promise<ClientChargeDetail>,
  applyChargeCredit: (input) => ipcRenderer.invoke(IPC_CHANNELS.applyChargeCredit, input) as Promise<ClientChargeDetail>,
  submitClientChargeForReview: (id) => ipcRenderer.invoke(IPC_CHANNELS.submitClientChargeForReview, id) as Promise<ClientChargeDetail>,
  issueClientCharge: (id) => ipcRenderer.invoke(IPC_CHANNELS.issueClientCharge, id) as Promise<ClientChargeDetail>,
  cancelClientCharge: (id, reason) => ipcRenderer.invoke(IPC_CHANNELS.cancelClientCharge, { id, reason }) as Promise<ClientChargeDetail>,
  listClientCharges: (filters) => ipcRenderer.invoke(IPC_CHANNELS.listClientCharges, filters) as Promise<ClientCharge[]>,
  getClientCharge: (id) => ipcRenderer.invoke(IPC_CHANNELS.getClientCharge, id) as Promise<ClientChargeDetail>,
  regenerateChargeDocuments: (id) => ipcRenderer.invoke(IPC_CHANNELS.regenerateChargeDocuments, id) as Promise<ClientChargeDetail>,
  listLedgerEntries: (filters) => ipcRenderer.invoke(IPC_CHANNELS.listLedgerEntries, filters) as Promise<ClientLedgerEntry[]>,
  createLedgerEntry: (input) => ipcRenderer.invoke(IPC_CHANNELS.createLedgerEntry, input) as Promise<ClientLedgerEntry>,
  createAdvance: (input) => ipcRenderer.invoke(IPC_CHANNELS.createAdvance, input) as Promise<ClientLedgerEntry>,
  createCredit: (input) => ipcRenderer.invoke(IPC_CHANNELS.createCredit, input) as Promise<ClientLedgerEntry>,
  getAvailableCredits: (organizationId, ownLegalEntityId, clientPartnerId) => ipcRenderer.invoke(IPC_CHANNELS.getAvailableCredits, { organizationId, ownLegalEntityId, clientPartnerId }) as Promise<ClientLedgerEntry[]>,
  createClientPayment: (input) => ipcRenderer.invoke(IPC_CHANNELS.createClientPayment, input) as Promise<ClientPayment>,
  allocateClientPayment: (input) => ipcRenderer.invoke(IPC_CHANNELS.allocateClientPayment, input) as Promise<ClientChargeDetail>,
  getBillingSummary: (organizationId) => ipcRenderer.invoke(IPC_CHANNELS.getBillingSummary, organizationId) as Promise<BillingSummary>
};

contextBridge.exposeInMainWorld("operationsCafe", api);
