export type AppVariant = "villa" | "grao" | "multiempresa";
export type ThemeMode = "light" | "dark";
export type LocationType = "OFFICE" | "BRANCH" | "WAREHOUSE" | "PROPERTY" | "STORAGE" | "OTHER";
export type UserRole = "ADMIN" | "OPERATOR" | "VIEWER";
export type ValueType = "string" | "number" | "boolean" | "json";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  displayName: string;
  appDisplayName: string;
  logoPath: string | null;
  compactLogoPath: string | null;
  iconPath: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  themeMode: ThemeMode;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LegalEntity {
  id: string;
  organizationId: string;
  legalName: string;
  tradeName: string;
  cnpj: string | null;
  stateRegistration: string | null;
  municipalRegistration: string | null;
  email: string | null;
  phone: string | null;
  addressLine: string;
  addressNumber: string;
  addressComplement: string | null;
  district: string;
  city: string;
  state: string;
  postalCode: string;
  documentPrefix: string | null;
  isDraft: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Location {
  id: string;
  organizationId: string;
  legalEntityId: string | null;
  name: string;
  type: LocationType;
  description: string | null;
  addressLine: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InstallationProfile {
  id: string;
  installationName: string;
  appVariant: AppVariant;
  defaultOrganizationId: string | null;
  defaultLegalEntityId: string | null;
  allowOrganizationSwitch: boolean;
  allowLegalEntitySwitch: boolean;
  completedSetup: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppSetting {
  id: string;
  key: string;
  value: string;
  valueType: ValueType;
  createdAt: string;
  updatedAt: string;
}

export interface AppDirectories {
  userData: string;
  databaseDir: string;
  databasePath: string;
  documentsDir: string;
  invoicesDir: string;
  confirmationsDir: string;
  chargesDir: string;
  attachmentsDir: string;
  accountsPayableDir: string;
  financialReportsDir: string;
  signedDir: string;
  spreadsheetImportsDir: string;
  xmlImportsDir: string;
  backupsDir: string;
  logsDir: string;
  settingsDir: string;
}

export interface BootstrapData {
  version: string;
  profile: InstallationProfile | null;
  organizations: Organization[];
  legalEntities: LegalEntity[];
  locations: Location[];
}

export interface OrganizationListItem extends Organization {
  legalEntityCount: number;
  locationCount: number;
}

export interface ActiveContext {
  organizationId: string | null;
  legalEntityId: string | null;
  appVariant: AppVariant | null;
  branding: {
    appDisplayName: string;
    logoPath: string | null;
    compactLogoPath: string | null;
    iconPath: string | null;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    themeMode: ThemeMode;
  } | null;
}

export type BrandingAssetKind = "logo" | "compactLogo" | "icon";

export type BusinessPartnerRole = "CLIENT" | "SUPPLIER" | "SELLER" | "BUYER" | "DESTINATION" | "CARRIER" | "SERVICE_PROVIDER" | "OTHER";
export type PreferredContactMethod = "PHONE" | "MOBILE" | "EMAIL" | "WHATSAPP" | "OTHER";
export type ProductCategory = "COFFEE_ARABICA" | "COFFEE_CONILON" | "COFFEE_OTHER" | "OTHER";
export type ProductUnit = "SACK" | "KG" | "TON" | "UNIT";
export type BillingPeriodicity = "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "CUSTOM";
export type OperationScope = "INTERNAL" | "EXTERNAL" | "ALL";
export type RateType = "PER_SACK";

export interface BusinessPartner {
  id: string;
  organizationId: string;
  displayName: string;
  notes: string | null;
  roles: BusinessPartnerRole[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessPartnerLegalEntity {
  id: string;
  businessPartnerId: string;
  legalName: string;
  tradeName: string;
  cnpj: string | null;
  stateRegistration: string | null;
  municipalRegistration: string | null;
  email: string | null;
  phone: string | null;
  addressLine: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  isPrimary: boolean;
  isActive: boolean;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerContact {
  id: string;
  businessPartnerId: string;
  partnerLegalEntityId: string | null;
  name: string;
  department: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  preferredContactMethod: PreferredContactMethod;
  isPrimary: boolean;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  organizationId: string;
  name: string;
  code: string | null;
  category: ProductCategory;
  defaultUnit: ProductUnit;
  defaultSackWeightKg: number | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientBillingProfile {
  id: string;
  organizationId: string;
  businessPartnerId: string;
  ownLegalEntityId: string | null;
  periodicity: BillingPeriodicity;
  closingWeekday: number | null;
  closingDayOfMonth: number | null;
  dueDaysAfterClosing: number;
  autoIncludeUnbilledOperations: boolean;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceRateRule {
  id: string;
  organizationId: string;
  businessPartnerId: string;
  ownLegalEntityId: string | null;
  productId: string | null;
  operationScope: OperationScope;
  rateType: RateType;
  rateValueCents: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  priority: number;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResolveRateResult {
  status: "found" | "missing" | "conflict";
  rule: ServiceRateRule | null;
  rateValueCents: number | null;
  origin: string;
  message: string | null;
}

export type FiscalDocumentType = "MANUAL_INVOICE";
export type FiscalDocumentStatus = "DRAFT" | "PENDING" | "CONFIRMED" | "CANCELED";
export type OperationType = "PURCHASE" | "SALE";
export type ImportSource = "MANUAL" | "SPREADSHEET" | "XML";
export type FiscalDocumentDirection = "INBOUND" | "OUTBOUND" | "UNKNOWN";
export type OperationBillingStatus = "UNBILLED" | "RESERVED" | "BILLED";

export interface FiscalDocument {
  id: string;
  organizationId: string;
  ownLegalEntityId: string;
  responsiblePartnerId: string;
  partnerLegalEntityId: string | null;
  documentType: FiscalDocumentType;
  accessKey: string | null;
  documentNumber: string;
  series: string | null;
  issueDate: string;
  totalAmountCents: number;
  status: FiscalDocumentStatus;
  hasPendingIssues: boolean;
  pendingNotes: string | null;
  duplicateWarning: string | null;
  notes: string | null;
  confirmedAt: string | null;
  canceledAt: string | null;
  cancelReason: string | null;
  source: ImportSource;
  importJobId: string | null;
  importRowId: string | null;
  xmlFilePath: string | null;
  xmlFileHash: string | null;
  protocolNumber: string | null;
  protocolDate: string | null;
  authorizationStatusCode: string | null;
  authorizationStatusMessage: string | null;
  xmlImportJobId: string | null;
  mergedFromSource: ImportSource | null;
  mergedAt: string | null;
  direction: FiscalDocumentDirection;
  fiscalSnapshotJson: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalDocumentItem {
  id: string;
  fiscalDocumentId: string;
  productId: string | null;
  description: string;
  quantity: string;
  unit: ProductUnit;
  unitPriceDecimal: string;
  totalAmountCents: number;
  sacksQuantity: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Operation {
  id: string;
  fiscalDocumentId: string;
  fiscalDocumentItemId: string | null;
  organizationId: string;
  ownLegalEntityId: string;
  responsiblePartnerId: string;
  productId: string | null;
  operationType: OperationType;
  operationScope: Exclude<OperationScope, "ALL">;
  operationDate: string;
  quantitySacks: string;
  serviceRateRuleId: string | null;
  appliedRateValueCents: number;
  serviceAmountCents: number;
  rateWasManuallyOverridden: boolean;
  manualRateValueCents: number | null;
  manualOverrideReason: string | null;
  notes: string | null;
  status: FiscalDocumentStatus;
  source: ImportSource;
  importJobId: string | null;
  importRowId: string | null;
  xmlImportJobId: string | null;
  classificationRuleId: string | null;
  billingStatus: OperationBillingStatus;
  clientChargeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalDocumentDetail {
  document: FiscalDocument;
  items: FiscalDocumentItem[];
  operations: Operation[];
  events?: FiscalDocumentEvent[];
  mergeHistory?: FiscalDocumentMergeHistory[];
}

export type SpreadsheetImportType = "GENERAL_SALES" | "CLIENT_INDIVIDUAL" | "CUSTOM";
export type SpreadsheetImportStatus = "DRAFT" | "VALIDATED" | "PROCESSING" | "COMPLETED" | "COMPLETED_WITH_ERRORS" | "CANCELLED" | "FAILED" | "REVERTED";
export type SpreadsheetImportRowStatus = "PENDING" | "VALID" | "WARNING" | "ERROR" | "DUPLICATE" | "IMPORTED" | "SKIPPED" | "REVERTED";

export interface SpreadsheetMappingTemplate {
  id: string;
  organizationId: string;
  name: string;
  importType: SpreadsheetImportType;
  sheetNamePattern: string | null;
  headerRow: number;
  columnMappingJson: string;
  defaultCommercialFlow: OperationType | null;
  defaultOperationScope: Operation["operationScope"] | null;
  defaultProductId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SpreadsheetImportJob {
  id: string;
  organizationId: string;
  ownLegalEntityId: string;
  mappingTemplateId: string | null;
  originalFileName: string;
  storedFilePath: string | null;
  selectedSheetName: string;
  importType: SpreadsheetImportType;
  status: SpreadsheetImportStatus;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  importedRows: number;
  duplicateRows: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdByUserId: string | null;
  settingsJson: string;
}

export interface SpreadsheetImportRow {
  id: string;
  importJobId: string;
  sheetName: string;
  sourceRowNumber: number;
  rawDataJson: string;
  normalizedDataJson: string | null;
  status: SpreadsheetImportRowStatus;
  fiscalDocumentId: string | null;
  operationId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  warningCodesJson: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerAlias {
  id: string;
  organizationId: string;
  businessPartnerId: string;
  partnerLegalEntityId: string | null;
  alias: string;
  normalizedAlias: string;
  source: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkbookInspection {
  token: string;
  fileName: string;
  sizeBytes: number;
  sheets: Array<{ name: string; rowCount: number }>;
}

export interface SheetPreview {
  headers: string[];
  rows: Array<Record<string, string>>;
  suggestedMapping: Record<string, string>;
}

export type XmlImportSourceType = "FILE" | "MULTIPLE_FILES" | "FOLDER" | "DRAG_DROP";
export type XmlImportStatus = "DRAFT" | "INSPECTING" | "VALIDATED" | "PROCESSING" | "COMPLETED" | "COMPLETED_WITH_ERRORS" | "CANCELLED" | "FAILED" | "REVERTED";
export type XmlImportFileStatus = "PENDING" | "VALID" | "WARNING" | "PENDING_REVIEW" | "DUPLICATE" | "ERROR" | "IMPORTED" | "SKIPPED" | "REVERTED";
export type XmlType = "NFE_PROC" | "NFE" | "EVENT_CANCELLATION" | "EVENT_CORRECTION_LETTER" | "EVENT_OTHER" | "UNKNOWN";
export type FiscalDocumentEventType = "CANCELLATION" | "CORRECTION_LETTER" | "OTHER";

export interface XmlFileInspection {
  token: string;
  originalFileName: string;
  fileSize: number;
  fileHash: string;
  xmlType: XmlType;
  accessKey: string | null;
  status: XmlImportFileStatus;
  warnings: string[];
  errorCode: string | null;
  errorMessage: string | null;
  extractedData: Record<string, unknown> | null;
}

export interface XmlImportJob {
  id: string;
  organizationId: string;
  status: XmlImportStatus;
  sourceType: XmlImportSourceType;
  selectedFolder: string | null;
  includeSubfolders: boolean;
  totalFiles: number;
  validFiles: number;
  warningFiles: number;
  duplicateFiles: number;
  errorFiles: number;
  importedNotes: number;
  importedEvents: number;
  createdOperations: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  revertedAt: string | null;
  settingsJson: string;
}

export interface XmlImportFile {
  id: string;
  importJobId: string;
  originalFileName: string;
  storedFilePath: string | null;
  fileHash: string;
  fileSize: number;
  xmlType: XmlType;
  accessKey: string | null;
  status: XmlImportFileStatus;
  fiscalDocumentId: string | null;
  fiscalDocumentEventId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  warningCodesJson: string | null;
  extractedDataJson: string | null;
  resolutionDataJson: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalDocumentEvent {
  id: string;
  organizationId: string;
  fiscalDocumentId: string | null;
  accessKey: string;
  eventType: FiscalDocumentEventType;
  sequenceNumber: string;
  eventDate: string | null;
  protocolNumber: string | null;
  statusCode: string | null;
  statusMessage: string | null;
  correctionText: string | null;
  xmlFilePath: string | null;
  fileHash: string;
  createdAt: string;
}

export interface ProductAlias {
  id: string;
  organizationId: string;
  productId: string;
  issuerPartnerLegalEntityId: string | null;
  sourceProductCode: string | null;
  sourceDescription: string;
  normalizedDescription: string;
  ncm: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OperationClassificationRule {
  id: string;
  organizationId: string;
  ownLegalEntityId: string | null;
  issuerPartnerLegalEntityId: string | null;
  recipientPartnerLegalEntityId: string | null;
  destinationPartnerId: string | null;
  productId: string | null;
  clientPartnerId: string;
  commercialFlow: OperationType | null;
  operationScope: Exclude<OperationScope, "ALL">;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalDocumentMergeHistory {
  id: string;
  organizationId: string;
  fiscalDocumentId: string;
  xmlImportJobId: string | null;
  previousSource: ImportSource | null;
  decision: string;
  differencesJson: string;
  createdAt: string;
}

export type ClientChargeStatus = "DRAFT" | "PENDING_REVIEW" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED" | "REPLACED";
export type ChargePeriodicity = BillingPeriodicity;
export type LedgerEntryType = "SERVICE_CHARGE" | "ADVANCE_RECEIVED" | "PAYMENT_RECEIVED" | "DISCOUNT" | "CREDIT" | "SURCHARGE" | "REIMBURSEMENT" | "PREVIOUS_BALANCE" | "MANUAL_ADJUSTMENT" | "REVERSAL" | "OTHER";
export type LedgerEffect = "INCREASE_RECEIVABLE" | "REDUCE_RECEIVABLE";
export type LedgerStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";
export type ChargeAdjustmentType = "ADVANCE" | "CREDIT" | "DISCOUNT" | "SURCHARGE" | "REIMBURSEMENT" | "PREVIOUS_BALANCE" | "MANUAL_ADJUSTMENT" | "OTHER";
export type PaymentMethod = "PIX" | "BANK_TRANSFER" | "CASH" | "CHECK" | "OFFSET" | "OTHER";
export type PaymentStatus = "CONFIRMED" | "CANCELLED";

export interface ClientCharge {
  id: string;
  organizationId: string;
  ownLegalEntityId: string;
  clientPartnerId: string;
  billingProfileId: string | null;
  chargeNumber: string | null;
  referenceCode: string | null;
  periodicity: ChargePeriodicity;
  periodStart: string;
  periodEnd: string;
  issueDate: string | null;
  dueDate: string | null;
  status: ClientChargeStatus;
  subtotalServicesCents: number;
  additionsCents: number;
  deductionsCents: number;
  finalAmountCents: number;
  paidAmountCents: number;
  openAmountCents: number;
  notes: string | null;
  internalNotes: string | null;
  pdfFilePath: string | null;
  pdfFileHash: string | null;
  excelFilePath: string | null;
  imageFilePath: string | null;
  snapshotJson: string | null;
  createdAt: string;
  updatedAt: string;
  issuedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  replacedByChargeId: string | null;
}

export interface ClientChargeOperation {
  id: string;
  clientChargeId: string;
  operationId: string;
  operationDateSnapshot: string;
  fiscalDocumentNumberSnapshot: string | null;
  fiscalDocumentSeriesSnapshot: string | null;
  issuerNameSnapshot: string | null;
  destinationNameSnapshot: string | null;
  productNameSnapshot: string | null;
  operationScopeSnapshot: Exclude<OperationScope, "ALL">;
  quantitySacksDecimalSnapshot: string;
  serviceRateCentsSnapshot: number;
  serviceAmountCentsSnapshot: number;
  releasedAt: string | null;
  createdAt: string;
}

export interface ClientChargeAdjustment {
  id: string;
  clientChargeId: string;
  ledgerEntryId: string | null;
  adjustmentType: ChargeAdjustmentType;
  effect: LedgerEffect;
  description: string;
  amountCents: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientLedgerEntry {
  id: string;
  organizationId: string;
  ownLegalEntityId: string;
  clientPartnerId: string;
  clientChargeId: string | null;
  entryType: LedgerEntryType;
  effect: LedgerEffect;
  amountCents: number;
  entryDate: string;
  description: string;
  referenceNumber: string | null;
  notes: string | null;
  attachmentPath: string | null;
  status: LedgerStatus;
  availableAmountCents: number | null;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
}

export interface ClientCreditAllocation {
  id: string;
  ledgerEntryId: string;
  clientChargeId: string;
  amountCents: number;
  allocatedAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
}

export interface ClientPayment {
  id: string;
  organizationId: string;
  ownLegalEntityId: string;
  clientPartnerId: string;
  paymentDate: string;
  amountCents: number;
  paymentMethod: PaymentMethod;
  bankAccountDescription: string | null;
  transactionReference: string | null;
  notes: string | null;
  attachmentPath: string | null;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
}

export interface ClientPaymentAllocation {
  id: string;
  clientPaymentId: string;
  clientChargeId: string;
  amountCents: number;
  allocatedAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
}

export interface DocumentSequence {
  id: string;
  organizationId: string;
  ownLegalEntityId: string;
  documentType: "CLIENT_CHARGE";
  year: number | null;
  prefix: string | null;
  currentNumber: number;
  padding: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChargeDocumentVersion {
  id: string;
  clientChargeId: string;
  version: number;
  pdfFilePath: string | null;
  pdfFileHash: string | null;
  excelFilePath: string | null;
  excelFileHash: string | null;
  imageFilePath: string | null;
  imageFileHash: string | null;
  createdAt: string;
}

export interface ClientChargeDetail {
  charge: ClientCharge;
  operations: ClientChargeOperation[];
  adjustments: ClientChargeAdjustment[];
  creditAllocations: ClientCreditAllocation[];
  payments: ClientPaymentAllocation[];
  documents: ChargeDocumentVersion[];
}

export interface BillingSummary {
  issuedCents: number;
  receivedCents: number;
  openCents: number;
  overdueCents: number;
  availableCreditsCents: number;
  unbilledOperations: number;
  unbilledSacks: string;
  billedSacks: string;
}

export type ExpenseNature = "FIXED" | "VARIABLE" | "TAX" | "PERSONNEL" | "FINANCIAL" | "INVESTMENT" | "OTHER";
export type FinancialAccountType = "BANK_ACCOUNT" | "CASH" | "DIGITAL_WALLET" | "OTHER";
export type AccountPayableSource = "MANUAL" | "RECURRING" | "INSTALLMENT" | "IMPORT";
export type PayableAmountStatus = "PENDING" | "ESTIMATED" | "CONFIRMED";
export type AccountPayableStatus = "DRAFT" | "SCHEDULED" | "OPEN" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CONTESTED" | "CANCELLED";
export type RecurringAmountMode = "FIXED" | "VARIABLE";
export type PayableFrequency = "MONTHLY" | "BIMONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL" | "CUSTOM";
export type InstallmentIntervalType = "MONTHLY" | "DAYS_30" | "CUSTOM";
export type PayablePaymentMethod = "PIX" | "BANK_TRANSFER" | "BOLETO" | "CASH" | "CHECK" | "CARD" | "DIRECT_DEBIT" | "OFFSET" | "OTHER";
export type PayablePaymentStatus = "CONFIRMED" | "CANCELLED";
export type PayableAttachmentType = "INVOICE" | "BILL" | "CONTRACT" | "RECEIPT" | "SUPPORTING_DOCUMENT" | "OTHER";
export type FinancialReportType = "ACCOUNTS_PAYABLE" | "OVERDUE_PAYABLES" | "PAYMENTS" | "BY_LEGAL_ENTITY" | "BY_LOCATION" | "BY_COST_CENTER" | "BY_CATEGORY" | "BY_SUPPLIER" | "FIXED_VARIABLE" | "RECURRING" | "INSTALLMENTS" | "PROJECTED_CASH_FLOW";
export type FinancialReportFormat = "PDF" | "EXCEL";

export interface ExpenseCategory {
  id: string;
  organizationId: string;
  parentCategoryId: string | null;
  name: string;
  code: string | null;
  expenseNature: ExpenseNature;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CostCenter {
  id: string;
  organizationId: string;
  ownLegalEntityId: string | null;
  locationId: string | null;
  parentCostCenterId: string | null;
  name: string;
  code: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialAccount {
  id: string;
  organizationId: string;
  ownLegalEntityId: string;
  name: string;
  accountType: FinancialAccountType;
  bankName: string | null;
  branch: string | null;
  accountIdentifierMasked: string | null;
  pixKeyDescription: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountPayable {
  id: string;
  organizationId: string;
  ownLegalEntityId: string;
  supplierPartnerId: string | null;
  supplierLegalEntityId: string | null;
  payeeNameSnapshot: string;
  payeeTaxIdSnapshot: string | null;
  categoryId: string;
  defaultCostCenterId: string | null;
  defaultLocationId: string | null;
  recurringTemplateId: string | null;
  installmentGroupId: string | null;
  installmentNumber: number | null;
  installmentCount: number | null;
  source: AccountPayableSource;
  description: string;
  documentType: string | null;
  documentNumber: string | null;
  competenceDate: string;
  issueDate: string | null;
  dueDate: string;
  originalAmountCents: number | null;
  discountCents: number;
  interestCents: number;
  penaltyCents: number;
  otherAdditionsCents: number;
  finalAmountCents: number | null;
  paidAmountCents: number;
  openAmountCents: number | null;
  amountStatus: PayableAmountStatus;
  status: AccountPayableStatus;
  notes: string | null;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  contestedAt: string | null;
  contestReason: string | null;
}

export interface AccountPayableAllocation {
  id: string;
  accountPayableId: string;
  costCenterId: string | null;
  locationId: string | null;
  allocationAmountCents: number;
  allocationBasisPoints: number | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayableRecurringTemplate {
  id: string;
  organizationId: string;
  ownLegalEntityId: string;
  supplierPartnerId: string | null;
  supplierLegalEntityId: string | null;
  payeeNameSnapshot: string;
  categoryId: string;
  defaultCostCenterId: string | null;
  defaultLocationId: string | null;
  description: string;
  amountMode: RecurringAmountMode;
  fixedAmountCents: number | null;
  estimatedAmountCents: number | null;
  frequency: PayableFrequency;
  dueDay: number;
  generationLeadDays: number;
  startDate: string;
  endDate: string | null;
  autoGenerateOnOpen: boolean;
  lastGeneratedCompetence: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PayableInstallmentGroup {
  id: string;
  organizationId: string;
  ownLegalEntityId: string;
  supplierPartnerId: string | null;
  description: string;
  totalAmountCents: number;
  installmentCount: number;
  firstDueDate: string;
  intervalType: InstallmentIntervalType;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
}

export interface PayablePayment {
  id: string;
  organizationId: string;
  ownLegalEntityId: string;
  financialAccountId: string | null;
  paymentDate: string;
  amountCents: number;
  paymentMethod: PayablePaymentMethod;
  transactionReference: string | null;
  payeeNameSnapshot: string;
  notes: string | null;
  attachmentPath: string | null;
  attachmentHash: string | null;
  status: PayablePaymentStatus;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
}

export interface PayablePaymentAllocation {
  id: string;
  payablePaymentId: string;
  accountPayableId: string;
  amountCents: number;
  allocatedAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
}

export interface PayableStatusHistory {
  id: string;
  accountPayableId: string;
  previousStatus: AccountPayableStatus | null;
  newStatus: AccountPayableStatus;
  reason: string | null;
  changedByUserId: string | null;
  changedAt: string;
}

export interface PayableDocumentAttachment {
  id: string;
  organizationId: string;
  ownLegalEntityId: string;
  accountPayableId: string | null;
  payablePaymentId: string | null;
  attachmentKind: "PAYABLE_DOCUMENT" | "PAYMENT_PROOF" | "OTHER";
  attachmentType: PayableAttachmentType;
  originalFileName: string;
  storedFilePath: string;
  fileHash: string;
  mimeType: string;
  fileExtension: string;
  fileSize: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  removedAt: string | null;
  removalReason: string | null;
}

export interface AccountPayableDetail {
  payable: AccountPayable;
  allocations: AccountPayableAllocation[];
  payments: PayablePaymentAllocation[];
  attachments: PayableDocumentAttachment[];
  history: PayableStatusHistory[];
}

export interface FinancialSummary {
  payableThisMonthCents: number;
  paidThisMonthCents: number;
  openCents: number;
  overdueCents: number;
  dueNext7DaysCents: number;
  fixedExpensesCents: number;
  variableExpensesCents: number;
  byCategory: Array<{ categoryId: string | null; label: string; amountCents: number }>;
  byLocation: Array<{ locationId: string | null; label: string; amountCents: number }>;
  byLegalEntity: Array<{ ownLegalEntityId: string; label: string; amountCents: number }>;
  projectedResultCents: number;
  receivableOpenCents: number;
  payableOpenCents: number;
}

export interface FinancialReportFilters {
  organizationId: string;
  ownLegalEntityId: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  categoryId: string | null;
  locationId: string | null;
  costCenterId: string | null;
  supplierPartnerId: string | null;
  status: string | null;
}

export interface FinancialReportPreview {
  reportType: FinancialReportType;
  filters: FinancialReportFilters;
  recordCount: number;
  totalFinalCents: number;
  totalPaidCents: number;
  totalOpenCents: number;
  totalOverdueCents: number;
}

export interface FinancialReportGeneration {
  id: string;
  organizationId: string;
  ownLegalEntityId: string | null;
  reportType: FinancialReportType;
  format: FinancialReportFormat;
  filtersJson: string;
  fileName: string;
  storedFilePath: string;
  fileHash: string;
  createdAt: string;
}

export type DealConfirmationStatus = "DRAFT" | "PENDING_REVIEW" | "ISSUED" | "SENT_FOR_SIGNATURE" | "SIGNED" | "CANCELLED" | "REPLACED";
export type DealSignatureStatus = "NOT_APPLICABLE" | "NOT_SENT" | "WAITING_SIGNATURE" | "PARTIALLY_SIGNED" | "SIGNED" | "REJECTED";
export type DealPartyRole = "ISSUER" | "BROKER" | "SELLER" | "BUYER" | "DELIVERY_RECIPIENT" | "OTHER";
export type DealSignerRole = "ISSUER" | "BROKER" | "SELLER" | "BUYER" | "WITNESS" | "OTHER";
export type DealSignerStatus = "PENDING" | "SIGNED_EXTERNALLY" | "REJECTED" | "NOT_REQUIRED";
export type DealTemplateLayoutMode = "STANDARD" | "COMPACT" | "DETAILED";
export type DealClauseCategory = "PAYMENT" | "DELIVERY" | "QUALITY" | "RESPONSIBILITY" | "CANCELLATION" | "GENERAL" | "OTHER";
export type DealDocumentType = "GENERATED_DRAFT" | "ISSUED_ORIGINAL" | "SIGNED_EXTERNAL" | "SUPPORTING_DOCUMENT" | "CANCELLED_COPY" | "REPLACEMENT_COPY";
export type ConfirmationReportType = "CONFIRMATIONS_PERIOD" | "BY_SELLER" | "BY_BUYER" | "BY_PRODUCT" | "BY_STATUS" | "BY_SIGNATURE" | "WITHOUT_FISCAL_DOCUMENT" | "WITHOUT_OPERATION";
export type ConfirmationReportFormat = "PDF" | "EXCEL";

export interface DealPartySnapshot {
  name: string;
  legalName: string | null;
  taxId: string | null;
  stateRegistration: string | null;
  addressLine: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  representativeName: string | null;
  role: DealPartyRole;
}

export interface DealConfirmation {
  id: string;
  organizationId: string;
  ownLegalEntityId: string;
  templateId: string | null;
  confirmationNumber: string | null;
  temporaryReference: string;
  confirmationDate: string;
  negotiationDate: string | null;
  status: DealConfirmationStatus;
  signatureStatus: DealSignatureStatus;
  currencyCode: string;
  totalQuantitySacksDecimal: string;
  totalCommercialAmountCents: number;
  deliveryLocationSnapshot: string | null;
  deliveryStartDate: string | null;
  deliveryEndDate: string | null;
  paymentTermsSnapshot: string | null;
  qualityTermsSnapshot: string | null;
  generalTermsSnapshot: string | null;
  publicNotes: string | null;
  internalNotes: string | null;
  templateSnapshotJson: string | null;
  pendingIssuesJson: string;
  issuedDocumentVersionId: string | null;
  signedDocumentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  issuedAt: string | null;
  sentForSignatureAt: string | null;
  signedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  replacedByConfirmationId: string | null;
}

export interface DealConfirmationParty {
  id: string;
  dealConfirmationId: string;
  partyRole: DealPartyRole;
  businessPartnerId: string | null;
  partnerLegalEntityId: string | null;
  ownLegalEntityId: string | null;
  manualName: string | null;
  snapshotJson: string;
  representativeName: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DealConfirmationItem {
  id: string;
  dealConfirmationId: string;
  sortOrder: number;
  productId: string | null;
  productNameSnapshot: string;
  productDescriptionSnapshot: string | null;
  cropSnapshot: string | null;
  qualitySnapshot: string | null;
  packagingSnapshot: string | null;
  originSnapshot: string | null;
  destinationSnapshot: string | null;
  quantitySacksDecimal: string;
  sackWeightKgDecimal: string;
  totalWeightKgDecimal: string | null;
  unitPriceDecimal: string;
  calculatedTotalAmountCents: number;
  totalAmountCents: number;
  totalWasManuallyOverridden: boolean;
  totalOverrideReason: string | null;
  deliveryStartDate: string | null;
  deliveryEndDate: string | null;
  deliveryLocationSnapshot: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DealConfirmationTemplate {
  id: string;
  organizationId: string;
  ownLegalEntityId: string | null;
  name: string;
  description: string | null;
  version: number;
  title: string;
  subtitle: string | null;
  layoutMode: DealTemplateLayoutMode;
  defaultPaymentTerms: string | null;
  defaultDeliveryTerms: string | null;
  defaultQualityTerms: string | null;
  defaultGeneralTerms: string | null;
  showBroker: boolean;
  showCommercialValues: boolean;
  showItemOrigins: boolean;
  showSignatureBlocks: boolean;
  signatureBlockCount: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DealConfirmationClause {
  id: string;
  dealConfirmationId: string;
  clauseNumber: string | null;
  title: string | null;
  clauseText: string;
  sortOrder: number;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DealClauseTemplate {
  id: string;
  organizationId: string;
  name: string;
  title: string | null;
  clauseText: string;
  category: DealClauseCategory;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DealPaymentTerm {
  id: string;
  dealConfirmationId: string;
  sortOrder: number;
  description: string;
  percentageBasisPoints: number | null;
  amountCents: number | null;
  dueDate: string | null;
  daysAfterEvent: number | null;
  eventReference: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DealConfirmationSigner {
  id: string;
  dealConfirmationId: string;
  partyRole: DealSignerRole;
  name: string;
  documentNumber: string | null;
  positionTitle: string | null;
  email: string | null;
  phone: string | null;
  signatureOrder: number;
  signatureStatus: DealSignerStatus;
  signedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DealConfirmationDocumentVersion {
  id: string;
  dealConfirmationId: string;
  versionNumber: number;
  documentType: DealDocumentType;
  originalFileName: string;
  storedFilePath: string;
  mimeType: string;
  fileSize: number;
  fileHash: string;
  generatedBySystem: boolean;
  isCurrent: boolean;
  notes: string | null;
  createdAt: string;
}

export interface DealConfirmationStatusHistory {
  id: string;
  dealConfirmationId: string;
  previousStatus: DealConfirmationStatus | null;
  newStatus: DealConfirmationStatus;
  reason: string | null;
  changedByUserId: string | null;
  changedAt: string;
}

export interface DealConfirmationDetail {
  confirmation: DealConfirmation;
  parties: DealConfirmationParty[];
  items: DealConfirmationItem[];
  operations: Operation[];
  fiscalDocuments: FiscalDocument[];
  clauses: DealConfirmationClause[];
  paymentTerms: DealPaymentTerm[];
  signers: DealConfirmationSigner[];
  documents: DealConfirmationDocumentVersion[];
  history: DealConfirmationStatusHistory[];
  pendingIssues: Array<{ code: string; severity: "critical" | "warning"; message: string }>;
}

export interface DealConfirmationSummary {
  confirmations: number;
  totalSacksDecimal: string;
  totalCommercialAmountCents: number;
  drafts: number;
  pendingReview: number;
  issued: number;
  waitingSignature: number;
  signed: number;
  cancelled: number;
  withoutFiscalDocument: number;
  withoutOperation: number;
}

export interface ConfirmationReportFilters {
  organizationId: string;
  ownLegalEntityId: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  sellerPartnerId: string | null;
  buyerPartnerId: string | null;
  productId: string | null;
  status: string | null;
  signatureStatus: string | null;
}

export interface ConfirmationReportGeneration {
  fileName: string;
  storedFilePath: string;
  fileHash: string;
  format: ConfirmationReportFormat;
}

export interface Diagnostics {
  appVersion: string;
  databasePath: string;
  documentsPath: string;
  activeVariant: AppVariant | null;
  activeOrganization: string | null;
  activeLegalEntity: string | null;
  currentMigration: string;
  databaseStatus: "ok" | "error";
}
