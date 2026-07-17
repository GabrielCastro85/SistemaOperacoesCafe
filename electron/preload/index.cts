import { contextBridge, ipcRenderer } from "electron";
import type {
  ActiveContext,
  AppPermission,
  AppRole,
  AppUser,
  AuditEvent,
  AuditIntegrityResult,
  AuthSession,
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
  ExpenseCategory,
  CostCenter,
  FinancialAccount,
  AccountPayable,
  AccountPayableDetail,
  PayableRecurringTemplate,
  PayableInstallmentGroup,
  PayablePayment,
  PayableDocumentAttachment,
  FinancialReportGeneration,
  FinancialReportPreview,
  FinancialSummary,
  ConfirmationReportGeneration,
  DealClauseTemplate,
  DealConfirmation,
  DealConfirmationClause,
  DealConfirmationDetail,
  DealConfirmationDocumentVersion,
  DealConfirmationItem,
  DealConfirmationParty,
  DealConfirmationSigner,
  DealConfirmationSummary,
  DealConfirmationTemplate,
  DealPaymentTerm,
  Organization,
  OrganizationListItem
} from "../../src/shared/types/domain.js";
import type { saveInstallationProfileSchema } from "../../src/shared/schemas/domainSchemas.js";
import type { z } from "zod";

const IPC_CHANNELS = {
  authNeedsBootstrap: "auth:needsBootstrap",
  authBootstrapAdmin: "auth:bootstrapAdmin",
  authLogin: "auth:login",
  authCurrentSession: "auth:currentSession",
  authLock: "auth:lock",
  authUnlock: "auth:unlock",
  authLogout: "auth:logout",
  authChangePassword: "auth:changePassword",
  listUsers: "users:list",
  createUser: "users:create",
  updateUser: "users:update",
  listRoles: "roles:list",
  listPermissions: "roles:listPermissions",
  assignUserRole: "roles:assignUserRole",
  listAuditEvents: "audit:list",
  verifyAuditChain: "audit:verifyChain",
  getBootstrapData: "app:getBootstrapData",
  saveInstallationProfile: "app:saveInstallationProfile",
  updateInstallationProfile: "app:updateInstallationProfile",
  getActiveContext: "app:getActiveContext",
  getDiagnostics: "app:getDiagnostics",
  setActiveLegalEntity: "app:setActiveLegalEntity",
  setActiveOrganization: "app:setActiveOrganization",
  listOrganizations: "organizations:list",
  getOrganization: "organizations:get",
  createOrganization: "organizations:create",
  updateOrganization: "organizations:update",
  activateOrganization: "organizations:activate",
  deactivateOrganization: "organizations:deactivate",
  selectOrganizationBrandingAsset: "organizations:selectBrandingAsset",
  listLegalEntities: "legalEntities:list",
  getLegalEntity: "legalEntities:get",
  createLegalEntity: "legalEntities:create",
  updateLegalEntity: "legalEntities:update",
  activateLegalEntity: "legalEntities:activate",
  deactivateLegalEntity: "legalEntities:deactivate",
  listLocations: "locations:list",
  getLocation: "locations:get",
  createLocation: "locations:create",
  updateLocation: "locations:update",
  activateLocation: "locations:activate",
  deactivateLocation: "locations:deactivate",
  listBusinessPartners: "businessPartners:list",
  getBusinessPartner: "businessPartners:get",
  createBusinessPartner: "businessPartners:create",
  updateBusinessPartner: "businessPartners:update",
  activateBusinessPartner: "businessPartners:activate",
  deactivateBusinessPartner: "businessPartners:deactivate",
  addBusinessPartnerRole: "businessPartners:addRole",
  removeBusinessPartnerRole: "businessPartners:removeRole",
  listPartnerLegalEntities: "partnerLegalEntities:list",
  createPartnerLegalEntity: "partnerLegalEntities:create",
  updatePartnerLegalEntity: "partnerLegalEntities:update",
  activatePartnerLegalEntity: "partnerLegalEntities:activate",
  deactivatePartnerLegalEntity: "partnerLegalEntities:deactivate",
  listPartnerContacts: "partnerContacts:list",
  createPartnerContact: "partnerContacts:create",
  updatePartnerContact: "partnerContacts:update",
  activatePartnerContact: "partnerContacts:activate",
  deactivatePartnerContact: "partnerContacts:deactivate",
  listProducts: "products:list",
  getProduct: "products:get",
  createProduct: "products:create",
  updateProduct: "products:update",
  activateProduct: "products:activate",
  deactivateProduct: "products:deactivate",
  getBillingProfile: "billingProfiles:get",
  upsertBillingProfile: "billingProfiles:upsert",
  activateBillingProfile: "billingProfiles:activate",
  deactivateBillingProfile: "billingProfiles:deactivate",
  listServiceRateRules: "serviceRateRules:list",
  getServiceRateRule: "serviceRateRules:get",
  createServiceRateRule: "serviceRateRules:create",
  updateServiceRateRule: "serviceRateRules:update",
  activateServiceRateRule: "serviceRateRules:activate",
  deactivateServiceRateRule: "serviceRateRules:deactivate",
  resolveServiceRateRule: "serviceRateRules:resolve",
  listFiscalDocuments: "fiscalDocuments:list",
  getFiscalDocument: "fiscalDocuments:get",
  createFiscalDocument: "fiscalDocuments:create",
  updateFiscalDocument: "fiscalDocuments:update",
  addFiscalDocumentItem: "fiscalDocuments:addItem",
  addOperation: "operations:add",
  updateOperationManualRate: "operations:updateManualRate",
  confirmFiscalDocument: "fiscalDocuments:confirm",
  cancelFiscalDocument: "fiscalDocuments:cancel",
  getOperationalIndicators: "operations:indicators",
  selectSpreadsheetFile: "spreadsheetFiles:select",
  inspectSpreadsheetWorkbook: "spreadsheetFiles:inspectWorkbook",
  previewSpreadsheetSheet: "spreadsheetFiles:previewSheet",
  listSpreadsheetMappingTemplates: "spreadsheetMappingTemplates:list",
  createSpreadsheetMappingTemplate: "spreadsheetMappingTemplates:create",
  updateSpreadsheetMappingTemplate: "spreadsheetMappingTemplates:update",
  duplicateSpreadsheetMappingTemplate: "spreadsheetMappingTemplates:duplicate",
  activateSpreadsheetMappingTemplate: "spreadsheetMappingTemplates:activate",
  deactivateSpreadsheetMappingTemplate: "spreadsheetMappingTemplates:deactivate",
  createSpreadsheetImportDraft: "spreadsheetImports:createDraft",
  validateSpreadsheetImportRows: "spreadsheetImports:validateRows",
  executeSpreadsheetImport: "spreadsheetImports:execute",
  getSpreadsheetImportJob: "spreadsheetImports:get",
  listSpreadsheetImportJobs: "spreadsheetImports:list",
  cancelSpreadsheetImportJob: "spreadsheetImports:cancel",
  revertSpreadsheetImportJob: "spreadsheetImports:revert",
  listPartnerAliases: "partnerAliases:list",
  createPartnerAlias: "partnerAliases:create",
  deactivatePartnerAlias: "partnerAliases:deactivate",
  resolvePartnerAlias: "partnerAliases:resolve",
  selectXmlFile: "xmlFiles:selectFile",
  selectXmlFiles: "xmlFiles:selectFiles",
  selectXmlFolder: "xmlFiles:selectFolder",
  inspectXmlFiles: "xmlFiles:inspect",
  createXmlImportDraft: "xmlImports:createDraft",
  addXmlImportFiles: "xmlImports:addFiles",
  updateXmlImportSettings: "xmlImports:updateSettings",
  validateXmlImportJob: "xmlImports:validate",
  updateXmlImportFileResolution: "xmlImports:updateFileResolution",
  applyXmlBulkResolution: "xmlImports:applyBulkResolution",
  executeXmlImportJob: "xmlImports:execute",
  getXmlImportJobProgress: "xmlImports:progress",
  listXmlImportJobs: "xmlImports:list",
  getXmlImportJob: "xmlImports:get",
  cancelXmlImportJob: "xmlImports:cancel",
  revertXmlImportJob: "xmlImports:revert",
  listFiscalDocumentEvents: "fiscalDocumentEvents:list",
  getFiscalDocumentEvent: "fiscalDocumentEvents:get",
  linkPendingFiscalDocumentEvents: "fiscalDocumentEvents:linkPending",
  listProductAliases: "productAliases:list",
  createProductAlias: "productAliases:create",
  updateProductAlias: "productAliases:update",
  activateProductAlias: "productAliases:activate",
  deactivateProductAlias: "productAliases:deactivate",
  resolveProductAlias: "productAliases:resolve",
  listOperationClassificationRules: "operationClassificationRules:list",
  createOperationClassificationRule: "operationClassificationRules:create",
  updateOperationClassificationRule: "operationClassificationRules:update",
  activateOperationClassificationRule: "operationClassificationRules:activate",
  deactivateOperationClassificationRule: "operationClassificationRules:deactivate",
  resolveOperationClassificationRule: "operationClassificationRules:resolve",
  compareXmlWithExisting: "xmlMerge:compare",
  mergeXmlIntoExisting: "xmlMerge:merge",
  getFiscalDocumentMergeHistory: "xmlMerge:history",
  suggestChargePeriods: "clientCharges:suggestPeriods",
  findEligibleChargeOperations: "clientCharges:findEligibleOperations",
  createClientChargeDraft: "clientCharges:createDraft",
  reserveChargeOperations: "clientCharges:reserveOperations",
  releaseChargeOperations: "clientCharges:releaseOperations",
  addChargeAdjustment: "clientCharges:addAdjustment",
  removeChargeAdjustment: "clientCharges:removeAdjustment",
  applyChargeCredit: "clientCharges:applyCredit",
  submitClientChargeForReview: "clientCharges:submitForReview",
  issueClientCharge: "clientCharges:issue",
  cancelClientCharge: "clientCharges:cancel",
  listClientCharges: "clientCharges:list",
  getClientCharge: "clientCharges:get",
  regenerateChargeDocuments: "clientCharges:regenerateDocuments",
  listLedgerEntries: "clientLedger:listEntries",
  createLedgerEntry: "clientLedger:createEntry",
  createAdvance: "clientLedger:createAdvance",
  createCredit: "clientLedger:createCredit",
  getAvailableCredits: "clientLedger:getAvailableCredits",
  createClientPayment: "clientPayments:create",
  allocateClientPayment: "clientPayments:allocate",
  getBillingSummary: "billingDashboard:summary",
  listExpenseCategories: "expenseCategories:list",
  createExpenseCategory: "expenseCategories:create",
  updateExpenseCategory: "expenseCategories:update",
  activateExpenseCategory: "expenseCategories:activate",
  deactivateExpenseCategory: "expenseCategories:deactivate",
  listCostCenters: "costCenters:list",
  createCostCenter: "costCenters:create",
  updateCostCenter: "costCenters:update",
  activateCostCenter: "costCenters:activate",
  deactivateCostCenter: "costCenters:deactivate",
  listFinancialAccounts: "financialAccounts:list",
  createFinancialAccount: "financialAccounts:create",
  updateFinancialAccount: "financialAccounts:update",
  activateFinancialAccount: "financialAccounts:activate",
  deactivateFinancialAccount: "financialAccounts:deactivate",
  listAccountsPayable: "accountsPayable:list",
  getAccountPayable: "accountsPayable:get",
  createAccountPayableDraft: "accountsPayable:createDraft",
  updateAccountPayable: "accountsPayable:update",
  confirmAccountPayable: "accountsPayable:confirm",
  duplicateAccountPayable: "accountsPayable:duplicate",
  findPossiblePayableDuplicates: "accountsPayable:findDuplicates",
  addPayableAllocation: "accountsPayable:addAllocation",
  removePayableAllocation: "accountsPayable:removeAllocation",
  contestAccountPayable: "accountsPayable:contest",
  cancelAccountPayable: "accountsPayable:cancel",
  listPayableRecurringTemplates: "payableRecurring:listTemplates",
  createPayableRecurringTemplate: "payableRecurring:createTemplate",
  previewPayableRecurringGeneration: "payableRecurring:previewGeneration",
  generatePayableRecurringPeriod: "payableRecurring:generatePeriod",
  createPayableInstallmentGroup: "payableInstallments:createGroup",
  getPayableInstallmentGroup: "payableInstallments:getGroup",
  createPayablePayment: "payablePayments:create",
  allocatePayablePayment: "payablePayments:allocate",
  cancelPayablePayment: "payablePayments:cancel",
  listPayablePayments: "payablePayments:list",
  getFinancialSummary: "financialDashboard:summary",
  selectPayableAttachment: "payableAttachments:select",
  addPayableAttachment: "payableAttachments:addToPayable",
  addPayablePaymentAttachment: "payableAttachments:addToPayment",
  listPayableAttachments: "payableAttachments:listByPayable",
  listPayablePaymentAttachments: "payableAttachments:listByPayment",
  openPayableAttachment: "payableAttachments:open",
  removePayableAttachment: "payableAttachments:remove",
  previewFinancialReport: "financialReports:preview",
  generateFinancialReport: "financialReports:generate",
  listFinancialReports: "financialReports:list",
  openFinancialReport: "financialReports:open",
  listDealConfirmations: "dealConfirmations:list",
  getDealConfirmation: "dealConfirmations:get",
  createDealConfirmationDraft: "dealConfirmations:createDraft",
  createDealConfirmationFromOperations: "dealConfirmations:createFromOperations",
  createDealConfirmationFromFiscalDocuments: "dealConfirmations:createFromFiscalDocuments",
  duplicateDealConfirmationAsDraft: "dealConfirmations:duplicateAsDraft",
  updateDealConfirmationDraft: "dealConfirmations:updateDraft",
  addDealConfirmationItem: "dealConfirmations:addItem",
  updateDealConfirmationItem: "dealConfirmations:updateItem",
  removeDealConfirmationItem: "dealConfirmations:removeItem",
  addDealConfirmationParty: "dealConfirmations:addParty",
  updateDealConfirmationParty: "dealConfirmations:updateParty",
  removeDealConfirmationParty: "dealConfirmations:removeParty",
  linkDealOperation: "dealConfirmations:linkOperation",
  unlinkDealOperation: "dealConfirmations:unlinkOperation",
  linkDealFiscalDocument: "dealConfirmations:linkFiscalDocument",
  unlinkDealFiscalDocument: "dealConfirmations:unlinkFiscalDocument",
  addDealConfirmationClause: "dealConfirmations:addClause",
  updateDealConfirmationClause: "dealConfirmations:updateClause",
  removeDealConfirmationClause: "dealConfirmations:removeClause",
  reorderDealConfirmationClauses: "dealConfirmations:reorderClauses",
  addDealPaymentTerm: "dealConfirmations:addPaymentTerm",
  updateDealPaymentTerm: "dealConfirmations:updatePaymentTerm",
  removeDealPaymentTerm: "dealConfirmations:removePaymentTerm",
  addDealSigner: "dealConfirmations:addSigner",
  updateDealSigner: "dealConfirmations:updateSigner",
  removeDealSigner: "dealConfirmations:removeSigner",
  calculateDealTotals: "dealConfirmations:calculateTotals",
  validateDealForIssue: "dealConfirmations:validateForIssue",
  submitDealConfirmationForReview: "dealConfirmations:submitForReview",
  generateDealConfirmationPreview: "dealConfirmations:generatePreview",
  issueDealConfirmation: "dealConfirmations:issue",
  markDealConfirmationSentForSignature: "dealConfirmations:markSentForSignature",
  importSignedDealConfirmationDocument: "dealConfirmations:importSignedDocument",
  updateDealSignatureStatus: "dealConfirmations:updateSignatureStatus",
  cancelDealConfirmation: "dealConfirmations:cancel",
  replaceDealConfirmation: "dealConfirmations:replace",
  listDealPendingIssues: "dealConfirmations:listPending",
  listDealConfirmationTemplates: "dealConfirmationTemplates:list",
  getDealConfirmationTemplate: "dealConfirmationTemplates:get",
  createDealConfirmationTemplate: "dealConfirmationTemplates:create",
  updateDealConfirmationTemplate: "dealConfirmationTemplates:update",
  duplicateDealConfirmationTemplate: "dealConfirmationTemplates:duplicate",
  setDefaultDealConfirmationTemplate: "dealConfirmationTemplates:setDefault",
  activateDealConfirmationTemplate: "dealConfirmationTemplates:activate",
  deactivateDealConfirmationTemplate: "dealConfirmationTemplates:deactivate",
  previewDealConfirmationTemplate: "dealConfirmationTemplates:preview",
  listDealClauseTemplates: "dealClauseTemplates:list",
  getDealClauseTemplate: "dealClauseTemplates:get",
  createDealClauseTemplate: "dealClauseTemplates:create",
  updateDealClauseTemplate: "dealClauseTemplates:update",
  duplicateDealClauseTemplate: "dealClauseTemplates:duplicate",
  activateDealClauseTemplate: "dealClauseTemplates:activate",
  deactivateDealClauseTemplate: "dealClauseTemplates:deactivate",
  listDealDocumentVersions: "dealConfirmationDocuments:listVersions",
  getDealDocumentVersion: "dealConfirmationDocuments:getVersion",
  openDealDocument: "dealConfirmationDocuments:open",
  revealDealDocumentFolder: "dealConfirmationDocuments:revealFolder",
  validateSignedDealPdf: "dealConfirmationDocuments:validateSignedPdf",
  calculateDealDocumentHash: "dealConfirmationDocuments:calculateHash",
  previewDealConfirmationNumber: "dealSequences:previewConfirmationNumber",
  reserveDealConfirmationNumber: "dealSequences:reserveConfirmationNumber",
  generateConfirmationReport: "dealReports:generate",
  getDealConfirmationSummary: "dealDashboard:summary",
  selectSignedDealPdf: "dealDocuments:selectSignedPdf"
} as const;


type SaveInstallationProfileInput = z.infer<typeof saveInstallationProfileSchema>;

export interface OperationsCafeApi {
  authNeedsBootstrap: () => Promise<boolean>;
  authBootstrapAdmin: (input: { displayName: string; username: string; email?: string | null; password: string }) => Promise<AuthSession>;
  authLogin: (input: { username: string; password: string }) => Promise<AuthSession>;
  authCurrentSession: () => Promise<AuthSession | null>;
  authLock: () => Promise<AuthSession | null>;
  authUnlock: (password: string) => Promise<AuthSession>;
  authLogout: () => Promise<void>;
  authChangePassword: (input: { currentPassword: string; newPassword: string }) => Promise<void>;
  listUsers: () => Promise<AppUser[]>;
  createUser: (input: { displayName: string; username: string; email?: string | null; password: string; mustChangePassword?: boolean }) => Promise<AppUser>;
  updateUser: (input: { id: string; displayName?: string; email?: string | null; status?: AppUser["status"]; mustChangePassword?: boolean }) => Promise<AppUser>;
  listRoles: () => Promise<AppRole[]>;
  listPermissions: () => Promise<AppPermission[]>;
  assignUserRole: (input: { userId: string; roleId: string; organizationId?: string | null; legalEntityId?: string | null; expiresAt?: string | null }) => Promise<AppUser>;
  listAuditEvents: (filters?: { limit?: number }) => Promise<AuditEvent[]>;
  verifyAuditChain: () => Promise<AuditIntegrityResult>;
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
  listExpenseCategories: (organizationId: string) => Promise<ExpenseCategory[]>;
  createExpenseCategory: (input: unknown) => Promise<ExpenseCategory>;
  updateExpenseCategory: (id: string, input: unknown) => Promise<ExpenseCategory>;
  activateExpenseCategory: (id: string) => Promise<ExpenseCategory>;
  deactivateExpenseCategory: (id: string) => Promise<ExpenseCategory>;
  listCostCenters: (filters: { organizationId: string; ownLegalEntityId?: string; status?: "active" | "inactive" | "all" }) => Promise<CostCenter[]>;
  createCostCenter: (input: unknown) => Promise<CostCenter>;
  updateCostCenter: (id: string, input: unknown) => Promise<CostCenter>;
  activateCostCenter: (id: string) => Promise<CostCenter>;
  deactivateCostCenter: (id: string) => Promise<CostCenter>;
  listFinancialAccounts: (filters: { organizationId: string; ownLegalEntityId?: string; status?: "active" | "inactive" | "all" }) => Promise<FinancialAccount[]>;
  createFinancialAccount: (input: unknown) => Promise<FinancialAccount>;
  updateFinancialAccount: (id: string, input: unknown) => Promise<FinancialAccount>;
  activateFinancialAccount: (id: string) => Promise<FinancialAccount>;
  deactivateFinancialAccount: (id: string) => Promise<FinancialAccount>;
  listAccountsPayable: (filters: { organizationId: string; ownLegalEntityId?: string; status?: string; supplierPartnerId?: string }) => Promise<AccountPayable[]>;
  getAccountPayable: (id: string) => Promise<AccountPayableDetail>;
  createAccountPayableDraft: (input: unknown) => Promise<AccountPayableDetail>;
  updateAccountPayable: (id: string, input: unknown) => Promise<AccountPayableDetail>;
  confirmAccountPayable: (id: string) => Promise<AccountPayableDetail>;
  duplicateAccountPayable: (id: string) => Promise<AccountPayableDetail>;
  findPossiblePayableDuplicates: (input: unknown) => Promise<AccountPayable[]>;
  addPayableAllocation: (input: unknown) => Promise<AccountPayableDetail>;
  removePayableAllocation: (id: string) => Promise<AccountPayableDetail>;
  contestAccountPayable: (id: string, reason: string) => Promise<AccountPayableDetail>;
  cancelAccountPayable: (id: string, reason: string) => Promise<AccountPayableDetail>;
  listPayableRecurringTemplates: (organizationId: string) => Promise<PayableRecurringTemplate[]>;
  createPayableRecurringTemplate: (input: unknown) => Promise<PayableRecurringTemplate>;
  previewPayableRecurringGeneration: (templateId: string, monthsAhead?: number) => Promise<Array<{ competenceDate: string; dueDate: string; amountCents: number | null; amountStatus: string }>>;
  generatePayableRecurringPeriod: (templateId: string, monthsAhead?: number) => Promise<AccountPayable[]>;
  createPayableInstallmentGroup: (input: unknown) => Promise<{ group: PayableInstallmentGroup; payables: AccountPayable[] }>;
  getPayableInstallmentGroup: (id: string) => Promise<PayableInstallmentGroup>;
  createPayablePayment: (input: unknown) => Promise<PayablePayment>;
  allocatePayablePayment: (input: unknown) => Promise<AccountPayableDetail>;
  cancelPayablePayment: (id: string, reason: string) => Promise<PayablePayment>;
  listPayablePayments: (filters: { organizationId: string; ownLegalEntityId?: string }) => Promise<PayablePayment[]>;
  getFinancialSummary: (organizationId: string) => Promise<FinancialSummary>;
  selectPayableAttachment: () => Promise<{ token: string; fileName: string; sizeBytes: number } | null>;
  addPayableAttachment: (input: { token: string; accountPayableId: string; attachmentType: string; description: string | null }) => Promise<PayableDocumentAttachment>;
  addPayablePaymentAttachment: (input: { token: string; payablePaymentId: string; attachmentType: string; description: string | null }) => Promise<PayableDocumentAttachment>;
  listPayableAttachments: (accountPayableId: string) => Promise<PayableDocumentAttachment[]>;
  listPayablePaymentAttachments: (payablePaymentId: string) => Promise<PayableDocumentAttachment[]>;
  openPayableAttachment: (id: string) => Promise<boolean>;
  removePayableAttachment: (id: string, reason: string | null) => Promise<PayableDocumentAttachment>;
  previewFinancialReport: (filters: unknown) => Promise<FinancialReportPreview>;
  generateFinancialReport: (input: unknown) => Promise<FinancialReportGeneration>;
  listFinancialReports: (filters: { organizationId: string; ownLegalEntityId?: string | null }) => Promise<FinancialReportGeneration[]>;
  openFinancialReport: (id: string) => Promise<boolean>;
  listDealConfirmations: (filters?: unknown) => Promise<DealConfirmation[]>;
  getDealConfirmation: (id: string) => Promise<DealConfirmationDetail>;
  createDealConfirmationDraft: (input: unknown) => Promise<DealConfirmationDetail>;
  createDealConfirmationFromOperations: (input: unknown) => Promise<DealConfirmationDetail>;
  createDealConfirmationFromFiscalDocuments: (input: unknown) => Promise<DealConfirmationDetail>;
  duplicateDealConfirmationAsDraft: (id: string) => Promise<DealConfirmationDetail>;
  updateDealConfirmationDraft: (id: string, input: unknown) => Promise<DealConfirmationDetail>;
  addDealConfirmationItem: (input: unknown) => Promise<DealConfirmationItem>;
  updateDealConfirmationItem: (id: string, input: unknown) => Promise<DealConfirmationItem>;
  removeDealConfirmationItem: (id: string) => Promise<DealConfirmationDetail>;
  addDealConfirmationParty: (input: unknown) => Promise<DealConfirmationParty>;
  updateDealConfirmationParty: (id: string, input: unknown) => Promise<DealConfirmationParty>;
  removeDealConfirmationParty: (id: string) => Promise<DealConfirmationDetail>;
  linkDealOperation: (dealConfirmationId: string, operationId: string) => Promise<DealConfirmationDetail>;
  unlinkDealOperation: (dealConfirmationId: string, operationId: string) => Promise<DealConfirmationDetail>;
  linkDealFiscalDocument: (dealConfirmationId: string, fiscalDocumentId: string) => Promise<DealConfirmationDetail>;
  unlinkDealFiscalDocument: (dealConfirmationId: string, fiscalDocumentId: string) => Promise<DealConfirmationDetail>;
  addDealConfirmationClause: (input: unknown) => Promise<DealConfirmationClause>;
  updateDealConfirmationClause: (id: string, input: unknown) => Promise<DealConfirmationClause>;
  removeDealConfirmationClause: (id: string) => Promise<DealConfirmationDetail>;
  reorderDealConfirmationClauses: (dealConfirmationId: string, clauseIds: string[]) => Promise<DealConfirmationDetail>;
  addDealPaymentTerm: (input: unknown) => Promise<DealPaymentTerm>;
  updateDealPaymentTerm: (id: string, input: unknown) => Promise<DealPaymentTerm>;
  removeDealPaymentTerm: (id: string) => Promise<DealConfirmationDetail>;
  addDealSigner: (input: unknown) => Promise<DealConfirmationSigner>;
  updateDealSigner: (id: string, input: unknown) => Promise<DealConfirmationSigner>;
  removeDealSigner: (id: string) => Promise<DealConfirmationDetail>;
  calculateDealTotals: (id: string) => Promise<{ totalQuantitySacksDecimal: string; totalCommercialAmountCents: number }>;
  validateDealForIssue: (id: string) => Promise<DealConfirmationDetail["pendingIssues"]>;
  submitDealConfirmationForReview: (id: string) => Promise<DealConfirmationDetail>;
  generateDealConfirmationPreview: (id: string) => Promise<DealConfirmationDetail>;
  issueDealConfirmation: (id: string) => Promise<DealConfirmationDetail>;
  markDealConfirmationSentForSignature: (id: string) => Promise<DealConfirmationDetail>;
  importSignedDealConfirmationDocument: (id: string, input: unknown) => Promise<DealConfirmationDetail>;
  updateDealSignatureStatus: (id: string, signatureStatus: string) => Promise<DealConfirmationDetail>;
  cancelDealConfirmation: (id: string, reason: string) => Promise<DealConfirmationDetail>;
  replaceDealConfirmation: (id: string, reason: string) => Promise<DealConfirmationDetail>;
  listDealPendingIssues: (id: string) => Promise<DealConfirmationDetail["pendingIssues"]>;
  listDealConfirmationTemplates: (filters?: { organizationId?: string; ownLegalEntityId?: string; status?: "active" | "inactive" | "all" }) => Promise<DealConfirmationTemplate[]>;
  getDealConfirmationTemplate: (id: string) => Promise<DealConfirmationTemplate>;
  createDealConfirmationTemplate: (input: unknown) => Promise<DealConfirmationTemplate>;
  updateDealConfirmationTemplate: (id: string, input: unknown) => Promise<DealConfirmationTemplate>;
  duplicateDealConfirmationTemplate: (id: string) => Promise<DealConfirmationTemplate>;
  setDefaultDealConfirmationTemplate: (id: string) => Promise<DealConfirmationTemplate>;
  activateDealConfirmationTemplate: (id: string) => Promise<DealConfirmationTemplate>;
  deactivateDealConfirmationTemplate: (id: string) => Promise<DealConfirmationTemplate>;
  previewDealConfirmationTemplate: (id: string) => Promise<DealConfirmationTemplate>;
  listDealClauseTemplates: (organizationId: string) => Promise<DealClauseTemplate[]>;
  getDealClauseTemplate: (id: string) => Promise<DealClauseTemplate>;
  createDealClauseTemplate: (input: unknown) => Promise<DealClauseTemplate>;
  updateDealClauseTemplate: (id: string, input: unknown) => Promise<DealClauseTemplate>;
  duplicateDealClauseTemplate: (id: string) => Promise<DealClauseTemplate>;
  activateDealClauseTemplate: (id: string) => Promise<DealClauseTemplate>;
  deactivateDealClauseTemplate: (id: string) => Promise<DealClauseTemplate>;
  listDealDocumentVersions: (id: string) => Promise<DealConfirmationDocumentVersion[]>;
  getDealDocumentVersion: (id: string) => Promise<DealConfirmationDocumentVersion>;
  openDealDocument: (id: string) => Promise<boolean>;
  revealDealDocumentFolder: (id: string) => Promise<boolean>;
  validateSignedDealPdf: (id: string) => Promise<{ validPdfStored: boolean; cryptographicSignatureValidated: false; message: string }>;
  calculateDealDocumentHash: (id: string) => Promise<string>;
  previewDealConfirmationNumber: (organizationId: string, ownLegalEntityId: string) => Promise<string>;
  reserveDealConfirmationNumber: (organizationId: string, ownLegalEntityId: string) => Promise<string>;
  generateConfirmationReport: (input: unknown) => Promise<ConfirmationReportGeneration>;
  getDealConfirmationSummary: (input: unknown) => Promise<DealConfirmationSummary>;
  selectSignedDealPdf: () => Promise<{ token: string; fileName: string; sizeBytes: number } | null>;
}

const api: OperationsCafeApi = {
  authNeedsBootstrap: () => ipcRenderer.invoke(IPC_CHANNELS.authNeedsBootstrap) as Promise<boolean>,
  authBootstrapAdmin: (input) => ipcRenderer.invoke(IPC_CHANNELS.authBootstrapAdmin, input) as Promise<AuthSession>,
  authLogin: (input) => ipcRenderer.invoke(IPC_CHANNELS.authLogin, input) as Promise<AuthSession>,
  authCurrentSession: () => ipcRenderer.invoke(IPC_CHANNELS.authCurrentSession) as Promise<AuthSession | null>,
  authLock: () => ipcRenderer.invoke(IPC_CHANNELS.authLock) as Promise<AuthSession | null>,
  authUnlock: (password) => ipcRenderer.invoke(IPC_CHANNELS.authUnlock, password) as Promise<AuthSession>,
  authLogout: () => ipcRenderer.invoke(IPC_CHANNELS.authLogout) as Promise<void>,
  authChangePassword: (input) => ipcRenderer.invoke(IPC_CHANNELS.authChangePassword, input) as Promise<void>,
  listUsers: () => ipcRenderer.invoke(IPC_CHANNELS.listUsers) as Promise<AppUser[]>,
  createUser: (input) => ipcRenderer.invoke(IPC_CHANNELS.createUser, input) as Promise<AppUser>,
  updateUser: (input) => ipcRenderer.invoke(IPC_CHANNELS.updateUser, input) as Promise<AppUser>,
  listRoles: () => ipcRenderer.invoke(IPC_CHANNELS.listRoles) as Promise<AppRole[]>,
  listPermissions: () => ipcRenderer.invoke(IPC_CHANNELS.listPermissions) as Promise<AppPermission[]>,
  assignUserRole: (input) => ipcRenderer.invoke(IPC_CHANNELS.assignUserRole, input) as Promise<AppUser>,
  listAuditEvents: (filters) => ipcRenderer.invoke(IPC_CHANNELS.listAuditEvents, filters) as Promise<AuditEvent[]>,
  verifyAuditChain: () => ipcRenderer.invoke(IPC_CHANNELS.verifyAuditChain) as Promise<AuditIntegrityResult>,
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
  getBillingSummary: (organizationId) => ipcRenderer.invoke(IPC_CHANNELS.getBillingSummary, organizationId) as Promise<BillingSummary>,
  listExpenseCategories: (organizationId) => ipcRenderer.invoke(IPC_CHANNELS.listExpenseCategories, organizationId) as Promise<ExpenseCategory[]>,
  createExpenseCategory: (input) => ipcRenderer.invoke(IPC_CHANNELS.createExpenseCategory, input) as Promise<ExpenseCategory>,
  updateExpenseCategory: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.updateExpenseCategory, { id, input }) as Promise<ExpenseCategory>,
  activateExpenseCategory: (id) => ipcRenderer.invoke(IPC_CHANNELS.activateExpenseCategory, id) as Promise<ExpenseCategory>,
  deactivateExpenseCategory: (id) => ipcRenderer.invoke(IPC_CHANNELS.deactivateExpenseCategory, id) as Promise<ExpenseCategory>,
  listCostCenters: (filters) => ipcRenderer.invoke(IPC_CHANNELS.listCostCenters, filters) as Promise<CostCenter[]>,
  createCostCenter: (input) => ipcRenderer.invoke(IPC_CHANNELS.createCostCenter, input) as Promise<CostCenter>,
  updateCostCenter: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.updateCostCenter, { id, input }) as Promise<CostCenter>,
  activateCostCenter: (id) => ipcRenderer.invoke(IPC_CHANNELS.activateCostCenter, id) as Promise<CostCenter>,
  deactivateCostCenter: (id) => ipcRenderer.invoke(IPC_CHANNELS.deactivateCostCenter, id) as Promise<CostCenter>,
  listFinancialAccounts: (filters) => ipcRenderer.invoke(IPC_CHANNELS.listFinancialAccounts, filters) as Promise<FinancialAccount[]>,
  createFinancialAccount: (input) => ipcRenderer.invoke(IPC_CHANNELS.createFinancialAccount, input) as Promise<FinancialAccount>,
  updateFinancialAccount: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.updateFinancialAccount, { id, input }) as Promise<FinancialAccount>,
  activateFinancialAccount: (id) => ipcRenderer.invoke(IPC_CHANNELS.activateFinancialAccount, id) as Promise<FinancialAccount>,
  deactivateFinancialAccount: (id) => ipcRenderer.invoke(IPC_CHANNELS.deactivateFinancialAccount, id) as Promise<FinancialAccount>,
  listAccountsPayable: (filters) => ipcRenderer.invoke(IPC_CHANNELS.listAccountsPayable, filters) as Promise<AccountPayable[]>,
  getAccountPayable: (id) => ipcRenderer.invoke(IPC_CHANNELS.getAccountPayable, id) as Promise<AccountPayableDetail>,
  createAccountPayableDraft: (input) => ipcRenderer.invoke(IPC_CHANNELS.createAccountPayableDraft, input) as Promise<AccountPayableDetail>,
  updateAccountPayable: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.updateAccountPayable, { id, input }) as Promise<AccountPayableDetail>,
  confirmAccountPayable: (id) => ipcRenderer.invoke(IPC_CHANNELS.confirmAccountPayable, id) as Promise<AccountPayableDetail>,
  duplicateAccountPayable: (id) => ipcRenderer.invoke(IPC_CHANNELS.duplicateAccountPayable, id) as Promise<AccountPayableDetail>,
  findPossiblePayableDuplicates: (input) => ipcRenderer.invoke(IPC_CHANNELS.findPossiblePayableDuplicates, input) as Promise<AccountPayable[]>,
  addPayableAllocation: (input) => ipcRenderer.invoke(IPC_CHANNELS.addPayableAllocation, input) as Promise<AccountPayableDetail>,
  removePayableAllocation: (id) => ipcRenderer.invoke(IPC_CHANNELS.removePayableAllocation, id) as Promise<AccountPayableDetail>,
  contestAccountPayable: (id, reason) => ipcRenderer.invoke(IPC_CHANNELS.contestAccountPayable, { id, reason }) as Promise<AccountPayableDetail>,
  cancelAccountPayable: (id, reason) => ipcRenderer.invoke(IPC_CHANNELS.cancelAccountPayable, { id, reason }) as Promise<AccountPayableDetail>,
  listPayableRecurringTemplates: (organizationId) => ipcRenderer.invoke(IPC_CHANNELS.listPayableRecurringTemplates, organizationId) as Promise<PayableRecurringTemplate[]>,
  createPayableRecurringTemplate: (input) => ipcRenderer.invoke(IPC_CHANNELS.createPayableRecurringTemplate, input) as Promise<PayableRecurringTemplate>,
  previewPayableRecurringGeneration: (templateId, monthsAhead) => ipcRenderer.invoke(IPC_CHANNELS.previewPayableRecurringGeneration, { templateId, monthsAhead }) as Promise<Array<{ competenceDate: string; dueDate: string; amountCents: number | null; amountStatus: string }>>,
  generatePayableRecurringPeriod: (templateId, monthsAhead) => ipcRenderer.invoke(IPC_CHANNELS.generatePayableRecurringPeriod, { templateId, monthsAhead }) as Promise<AccountPayable[]>,
  createPayableInstallmentGroup: (input) => ipcRenderer.invoke(IPC_CHANNELS.createPayableInstallmentGroup, input) as Promise<{ group: PayableInstallmentGroup; payables: AccountPayable[] }>,
  getPayableInstallmentGroup: (id) => ipcRenderer.invoke(IPC_CHANNELS.getPayableInstallmentGroup, id) as Promise<PayableInstallmentGroup>,
  createPayablePayment: (input) => ipcRenderer.invoke(IPC_CHANNELS.createPayablePayment, input) as Promise<PayablePayment>,
  allocatePayablePayment: (input) => ipcRenderer.invoke(IPC_CHANNELS.allocatePayablePayment, input) as Promise<AccountPayableDetail>,
  cancelPayablePayment: (id, reason) => ipcRenderer.invoke(IPC_CHANNELS.cancelPayablePayment, { id, reason }) as Promise<PayablePayment>,
  listPayablePayments: (filters) => ipcRenderer.invoke(IPC_CHANNELS.listPayablePayments, filters) as Promise<PayablePayment[]>,
  getFinancialSummary: (organizationId) => ipcRenderer.invoke(IPC_CHANNELS.getFinancialSummary, organizationId) as Promise<FinancialSummary>,
  selectPayableAttachment: () => ipcRenderer.invoke(IPC_CHANNELS.selectPayableAttachment) as Promise<{ token: string; fileName: string; sizeBytes: number } | null>,
  addPayableAttachment: (input) => ipcRenderer.invoke(IPC_CHANNELS.addPayableAttachment, input) as Promise<PayableDocumentAttachment>,
  addPayablePaymentAttachment: (input) => ipcRenderer.invoke(IPC_CHANNELS.addPayablePaymentAttachment, input) as Promise<PayableDocumentAttachment>,
  listPayableAttachments: (accountPayableId) => ipcRenderer.invoke(IPC_CHANNELS.listPayableAttachments, accountPayableId) as Promise<PayableDocumentAttachment[]>,
  listPayablePaymentAttachments: (payablePaymentId) => ipcRenderer.invoke(IPC_CHANNELS.listPayablePaymentAttachments, payablePaymentId) as Promise<PayableDocumentAttachment[]>,
  openPayableAttachment: (id) => ipcRenderer.invoke(IPC_CHANNELS.openPayableAttachment, id) as Promise<boolean>,
  removePayableAttachment: (id, reason) => ipcRenderer.invoke(IPC_CHANNELS.removePayableAttachment, { id, reason }) as Promise<PayableDocumentAttachment>,
  previewFinancialReport: (filters) => ipcRenderer.invoke(IPC_CHANNELS.previewFinancialReport, filters) as Promise<FinancialReportPreview>,
  generateFinancialReport: (input) => ipcRenderer.invoke(IPC_CHANNELS.generateFinancialReport, input) as Promise<FinancialReportGeneration>,
  listFinancialReports: (filters) => ipcRenderer.invoke(IPC_CHANNELS.listFinancialReports, filters) as Promise<FinancialReportGeneration[]>,
  openFinancialReport: (id) => ipcRenderer.invoke(IPC_CHANNELS.openFinancialReport, id) as Promise<boolean>,
  listDealConfirmations: (filters) => ipcRenderer.invoke(IPC_CHANNELS.listDealConfirmations, filters) as Promise<DealConfirmation[]>,
  getDealConfirmation: (id) => ipcRenderer.invoke(IPC_CHANNELS.getDealConfirmation, id) as Promise<DealConfirmationDetail>,
  createDealConfirmationDraft: (input) => ipcRenderer.invoke(IPC_CHANNELS.createDealConfirmationDraft, input) as Promise<DealConfirmationDetail>,
  createDealConfirmationFromOperations: (input) => ipcRenderer.invoke(IPC_CHANNELS.createDealConfirmationFromOperations, input) as Promise<DealConfirmationDetail>,
  createDealConfirmationFromFiscalDocuments: (input) => ipcRenderer.invoke(IPC_CHANNELS.createDealConfirmationFromFiscalDocuments, input) as Promise<DealConfirmationDetail>,
  duplicateDealConfirmationAsDraft: (id) => ipcRenderer.invoke(IPC_CHANNELS.duplicateDealConfirmationAsDraft, id) as Promise<DealConfirmationDetail>,
  updateDealConfirmationDraft: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.updateDealConfirmationDraft, { id, input }) as Promise<DealConfirmationDetail>,
  addDealConfirmationItem: (input) => ipcRenderer.invoke(IPC_CHANNELS.addDealConfirmationItem, input) as Promise<DealConfirmationItem>,
  updateDealConfirmationItem: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.updateDealConfirmationItem, { id, input }) as Promise<DealConfirmationItem>,
  removeDealConfirmationItem: (id) => ipcRenderer.invoke(IPC_CHANNELS.removeDealConfirmationItem, id) as Promise<DealConfirmationDetail>,
  addDealConfirmationParty: (input) => ipcRenderer.invoke(IPC_CHANNELS.addDealConfirmationParty, input) as Promise<DealConfirmationParty>,
  updateDealConfirmationParty: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.updateDealConfirmationParty, { id, input }) as Promise<DealConfirmationParty>,
  removeDealConfirmationParty: (id) => ipcRenderer.invoke(IPC_CHANNELS.removeDealConfirmationParty, id) as Promise<DealConfirmationDetail>,
  linkDealOperation: (dealConfirmationId, operationId) => ipcRenderer.invoke(IPC_CHANNELS.linkDealOperation, { dealConfirmationId, operationId }) as Promise<DealConfirmationDetail>,
  unlinkDealOperation: (dealConfirmationId, operationId) => ipcRenderer.invoke(IPC_CHANNELS.unlinkDealOperation, { dealConfirmationId, operationId }) as Promise<DealConfirmationDetail>,
  linkDealFiscalDocument: (dealConfirmationId, fiscalDocumentId) => ipcRenderer.invoke(IPC_CHANNELS.linkDealFiscalDocument, { dealConfirmationId, fiscalDocumentId }) as Promise<DealConfirmationDetail>,
  unlinkDealFiscalDocument: (dealConfirmationId, fiscalDocumentId) => ipcRenderer.invoke(IPC_CHANNELS.unlinkDealFiscalDocument, { dealConfirmationId, fiscalDocumentId }) as Promise<DealConfirmationDetail>,
  addDealConfirmationClause: (input) => ipcRenderer.invoke(IPC_CHANNELS.addDealConfirmationClause, input) as Promise<DealConfirmationClause>,
  updateDealConfirmationClause: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.updateDealConfirmationClause, { id, input }) as Promise<DealConfirmationClause>,
  removeDealConfirmationClause: (id) => ipcRenderer.invoke(IPC_CHANNELS.removeDealConfirmationClause, id) as Promise<DealConfirmationDetail>,
  reorderDealConfirmationClauses: (dealConfirmationId, clauseIds) => ipcRenderer.invoke(IPC_CHANNELS.reorderDealConfirmationClauses, { dealConfirmationId, clauseIds }) as Promise<DealConfirmationDetail>,
  addDealPaymentTerm: (input) => ipcRenderer.invoke(IPC_CHANNELS.addDealPaymentTerm, input) as Promise<DealPaymentTerm>,
  updateDealPaymentTerm: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.updateDealPaymentTerm, { id, input }) as Promise<DealPaymentTerm>,
  removeDealPaymentTerm: (id) => ipcRenderer.invoke(IPC_CHANNELS.removeDealPaymentTerm, id) as Promise<DealConfirmationDetail>,
  addDealSigner: (input) => ipcRenderer.invoke(IPC_CHANNELS.addDealSigner, input) as Promise<DealConfirmationSigner>,
  updateDealSigner: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.updateDealSigner, { id, input }) as Promise<DealConfirmationSigner>,
  removeDealSigner: (id) => ipcRenderer.invoke(IPC_CHANNELS.removeDealSigner, id) as Promise<DealConfirmationDetail>,
  calculateDealTotals: (id) => ipcRenderer.invoke(IPC_CHANNELS.calculateDealTotals, id) as Promise<{ totalQuantitySacksDecimal: string; totalCommercialAmountCents: number }>,
  validateDealForIssue: (id) => ipcRenderer.invoke(IPC_CHANNELS.validateDealForIssue, id) as Promise<DealConfirmationDetail["pendingIssues"]>,
  submitDealConfirmationForReview: (id) => ipcRenderer.invoke(IPC_CHANNELS.submitDealConfirmationForReview, id) as Promise<DealConfirmationDetail>,
  generateDealConfirmationPreview: (id) => ipcRenderer.invoke(IPC_CHANNELS.generateDealConfirmationPreview, id) as Promise<DealConfirmationDetail>,
  issueDealConfirmation: (id) => ipcRenderer.invoke(IPC_CHANNELS.issueDealConfirmation, id) as Promise<DealConfirmationDetail>,
  markDealConfirmationSentForSignature: (id) => ipcRenderer.invoke(IPC_CHANNELS.markDealConfirmationSentForSignature, id) as Promise<DealConfirmationDetail>,
  importSignedDealConfirmationDocument: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.importSignedDealConfirmationDocument, { id, input }) as Promise<DealConfirmationDetail>,
  updateDealSignatureStatus: (id, signatureStatus) => ipcRenderer.invoke(IPC_CHANNELS.updateDealSignatureStatus, { id, signatureStatus }) as Promise<DealConfirmationDetail>,
  cancelDealConfirmation: (id, reason) => ipcRenderer.invoke(IPC_CHANNELS.cancelDealConfirmation, { id, reason }) as Promise<DealConfirmationDetail>,
  replaceDealConfirmation: (id, reason) => ipcRenderer.invoke(IPC_CHANNELS.replaceDealConfirmation, { id, reason }) as Promise<DealConfirmationDetail>,
  listDealPendingIssues: (id) => ipcRenderer.invoke(IPC_CHANNELS.listDealPendingIssues, id) as Promise<DealConfirmationDetail["pendingIssues"]>,
  listDealConfirmationTemplates: (filters) => ipcRenderer.invoke(IPC_CHANNELS.listDealConfirmationTemplates, filters) as Promise<DealConfirmationTemplate[]>,
  getDealConfirmationTemplate: (id) => ipcRenderer.invoke(IPC_CHANNELS.getDealConfirmationTemplate, id) as Promise<DealConfirmationTemplate>,
  createDealConfirmationTemplate: (input) => ipcRenderer.invoke(IPC_CHANNELS.createDealConfirmationTemplate, input) as Promise<DealConfirmationTemplate>,
  updateDealConfirmationTemplate: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.updateDealConfirmationTemplate, { id, input }) as Promise<DealConfirmationTemplate>,
  duplicateDealConfirmationTemplate: (id) => ipcRenderer.invoke(IPC_CHANNELS.duplicateDealConfirmationTemplate, id) as Promise<DealConfirmationTemplate>,
  setDefaultDealConfirmationTemplate: (id) => ipcRenderer.invoke(IPC_CHANNELS.setDefaultDealConfirmationTemplate, id) as Promise<DealConfirmationTemplate>,
  activateDealConfirmationTemplate: (id) => ipcRenderer.invoke(IPC_CHANNELS.activateDealConfirmationTemplate, id) as Promise<DealConfirmationTemplate>,
  deactivateDealConfirmationTemplate: (id) => ipcRenderer.invoke(IPC_CHANNELS.deactivateDealConfirmationTemplate, id) as Promise<DealConfirmationTemplate>,
  previewDealConfirmationTemplate: (id) => ipcRenderer.invoke(IPC_CHANNELS.previewDealConfirmationTemplate, id) as Promise<DealConfirmationTemplate>,
  listDealClauseTemplates: (organizationId) => ipcRenderer.invoke(IPC_CHANNELS.listDealClauseTemplates, organizationId) as Promise<DealClauseTemplate[]>,
  getDealClauseTemplate: (id) => ipcRenderer.invoke(IPC_CHANNELS.getDealClauseTemplate, id) as Promise<DealClauseTemplate>,
  createDealClauseTemplate: (input) => ipcRenderer.invoke(IPC_CHANNELS.createDealClauseTemplate, input) as Promise<DealClauseTemplate>,
  updateDealClauseTemplate: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.updateDealClauseTemplate, { id, input }) as Promise<DealClauseTemplate>,
  duplicateDealClauseTemplate: (id) => ipcRenderer.invoke(IPC_CHANNELS.duplicateDealClauseTemplate, id) as Promise<DealClauseTemplate>,
  activateDealClauseTemplate: (id) => ipcRenderer.invoke(IPC_CHANNELS.activateDealClauseTemplate, id) as Promise<DealClauseTemplate>,
  deactivateDealClauseTemplate: (id) => ipcRenderer.invoke(IPC_CHANNELS.deactivateDealClauseTemplate, id) as Promise<DealClauseTemplate>,
  listDealDocumentVersions: (id) => ipcRenderer.invoke(IPC_CHANNELS.listDealDocumentVersions, id) as Promise<DealConfirmationDocumentVersion[]>,
  getDealDocumentVersion: (id) => ipcRenderer.invoke(IPC_CHANNELS.getDealDocumentVersion, id) as Promise<DealConfirmationDocumentVersion>,
  openDealDocument: (id) => ipcRenderer.invoke(IPC_CHANNELS.openDealDocument, id) as Promise<boolean>,
  revealDealDocumentFolder: (id) => ipcRenderer.invoke(IPC_CHANNELS.revealDealDocumentFolder, id) as Promise<boolean>,
  validateSignedDealPdf: (id) => ipcRenderer.invoke(IPC_CHANNELS.validateSignedDealPdf, id) as Promise<{ validPdfStored: boolean; cryptographicSignatureValidated: false; message: string }>,
  calculateDealDocumentHash: (id) => ipcRenderer.invoke(IPC_CHANNELS.calculateDealDocumentHash, id) as Promise<string>,
  previewDealConfirmationNumber: (organizationId, ownLegalEntityId) => ipcRenderer.invoke(IPC_CHANNELS.previewDealConfirmationNumber, { organizationId, ownLegalEntityId }) as Promise<string>,
  reserveDealConfirmationNumber: (organizationId, ownLegalEntityId) => ipcRenderer.invoke(IPC_CHANNELS.reserveDealConfirmationNumber, { organizationId, ownLegalEntityId }) as Promise<string>,
  generateConfirmationReport: (input) => ipcRenderer.invoke(IPC_CHANNELS.generateConfirmationReport, input) as Promise<ConfirmationReportGeneration>,
  getDealConfirmationSummary: (input) => ipcRenderer.invoke(IPC_CHANNELS.getDealConfirmationSummary, input) as Promise<DealConfirmationSummary>,
  selectSignedDealPdf: () => ipcRenderer.invoke(IPC_CHANNELS.selectSignedDealPdf) as Promise<{ token: string; fileName: string; sizeBytes: number } | null>
};

contextBridge.exposeInMainWorld("operationsCafe", api);
