import type {
  BusinessPartner,
  BusinessPartnerLegalEntity,
  ClientBillingProfile,
  InstallationProfile,
  LegalEntity,
  Location,
  PartnerContact,
  Product,
  ServiceRateRule,
  PurchaseRateRule,
  AccountPayableOperation,
  OperationRateHistoryEntry,
  FiscalDocument,
  FiscalDocumentItem,
  Operation,
  SpreadsheetImportJob,
  SpreadsheetImportRow,
  SpreadsheetMappingTemplate,
  PartnerAlias,
  XmlImportJob,
  XmlImportFile,
  FiscalDocumentEvent,
  ProductAlias,
  OperationClassificationRule,
  FiscalDocumentMergeHistory,
  ClientCharge,
  ClientChargeOperation,
  ClientChargeAdjustment,
  ClientLedgerEntry,
  ClientCreditAllocation,
  ClientPayment,
  ClientPaymentAllocation,
  DocumentSequence,
  ChargeDocumentVersion,
  ExpenseCategory,
  CostCenter,
  FinancialAccount,
  AccountPayable,
  AccountPayableAllocation,
  PayableRecurringTemplate,
  PayableInstallmentGroup,
  PayablePayment,
  PayablePaymentAllocation,
  PayableStatusHistory,
  PayableDocumentAttachment,
  FinancialReportGeneration,
  DealClauseTemplate,
  DealConfirmation,
  DealConfirmationClause,
  DealConfirmationDocumentVersion,
  DealConfirmationItem,
  DealConfirmationParty,
  DealConfirmationSigner,
  DealConfirmationStatusHistory,
  DealConfirmationTemplate,
  DealPaymentTerm,
  Organization
} from "../../../src/shared/types/domain.js";

type DbRecord = Record<string, unknown>;

const bool = (value: unknown): boolean => value === 1;
const textOrNull = (value: unknown): string | null => (typeof value === "string" ? value : null);

export function mapOrganization(row: DbRecord): Organization {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    displayName: String(row.display_name),
    appDisplayName: String(row.app_display_name),
    description: textOrNull(row.description),
    logoPath: textOrNull(row.logo_path),
    compactLogoPath: textOrNull(row.compact_logo_path),
    iconPath: textOrNull(row.icon_path),
    primaryColor: String(row.primary_color),
    secondaryColor: String(row.secondary_color),
    accentColor: String(row.accent_color),
    themeMode: row.theme_mode === "dark" ? "dark" : "light",
    isActive: bool(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapLegalEntity(row: DbRecord): LegalEntity {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    legalName: String(row.legal_name),
    tradeName: String(row.trade_name),
    cnpj: textOrNull(row.cnpj),
    stateRegistration: textOrNull(row.state_registration),
    municipalRegistration: textOrNull(row.municipal_registration),
    email: textOrNull(row.email),
    phone: textOrNull(row.phone),
    addressLine: String(row.address_line),
    addressNumber: String(row.address_number),
    addressComplement: textOrNull(row.address_complement),
    district: String(row.district),
    city: String(row.city),
    state: String(row.state),
    postalCode: String(row.postal_code),
    documentPrefix: textOrNull(row.document_prefix),
    defaultBankName: textOrNull(row.default_bank_name),
    defaultBankCode: textOrNull(row.default_bank_code),
    defaultBankAgency: textOrNull(row.default_bank_agency),
    defaultBankAccount: textOrNull(row.default_bank_account),
    defaultBankAccountType: textOrNull(row.default_bank_account_type),
    defaultBankHolderName: textOrNull(row.default_bank_holder_name),
    defaultBankHolderDocument: textOrNull(row.default_bank_holder_document),
    defaultPixKey: textOrNull(row.default_pix_key),
    defaultPixKeyType: textOrNull(row.default_pix_key_type),
    defaultPaymentTerms: textOrNull(row.default_payment_terms),
    defaultDeliveryTerms: textOrNull(row.default_delivery_terms),
    defaultConfirmationNotes: textOrNull(row.default_confirmation_notes),
    isDraft: bool(row.is_draft),
    isActive: bool(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapLocation(row: DbRecord): Location {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    legalEntityId: textOrNull(row.legal_entity_id),
    name: String(row.name),
    type: String(row.type) as Location["type"],
    description: textOrNull(row.description),
    addressLine: textOrNull(row.address_line),
    addressNumber: textOrNull(row.address_number),
    addressComplement: textOrNull(row.address_complement),
    district: textOrNull(row.district),
    city: textOrNull(row.city),
    state: textOrNull(row.state),
    postalCode: textOrNull(row.postal_code),
    isActive: bool(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapInstallationProfile(row: DbRecord): InstallationProfile {
  return {
    id: String(row.id),
    installationName: String(row.installation_name),
    appVariant: String(row.app_variant) as InstallationProfile["appVariant"],
    defaultOrganizationId: textOrNull(row.default_organization_id),
    defaultLegalEntityId: textOrNull(row.default_legal_entity_id),
    allowOrganizationSwitch: bool(row.allow_organization_switch),
    allowLegalEntitySwitch: bool(row.allow_legal_entity_switch),
    completedSetup: bool(row.completed_setup),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapBusinessPartner(row: DbRecord, roles: BusinessPartner["roles"] = []): BusinessPartner {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    displayName: String(row.display_name),
    notes: textOrNull(row.notes),
    roles,
    isActive: bool(row.is_active),
    creditLimitCents: row.credit_limit_cents == null ? null : Number(row.credit_limit_cents),
    documentNumber: textOrNull(row.document_number),
    email: textOrNull(row.email),
    phone: textOrNull(row.phone),
    mobile: textOrNull(row.mobile),
    postalCode: textOrNull(row.postal_code),
    addressLine: textOrNull(row.address_line),
    addressNumber: textOrNull(row.address_number),
    addressComplement: textOrNull(row.address_complement),
    district: textOrNull(row.district),
    city: textOrNull(row.city),
    state: textOrNull(row.state),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapBusinessPartnerLegalEntity(row: DbRecord): BusinessPartnerLegalEntity {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    businessPartnerId: row.business_partner_id === null || row.business_partner_id === undefined ? null : String(row.business_partner_id),
    legalName: String(row.legal_name),
    tradeName: String(row.trade_name),
    cnpj: textOrNull(row.cnpj),
    stateRegistration: textOrNull(row.state_registration),
    municipalRegistration: textOrNull(row.municipal_registration),
    email: textOrNull(row.email),
    phone: textOrNull(row.phone),
    addressLine: textOrNull(row.address_line),
    addressNumber: textOrNull(row.address_number),
    addressComplement: textOrNull(row.address_complement),
    district: textOrNull(row.district),
    city: textOrNull(row.city),
    state: textOrNull(row.state),
    postalCode: textOrNull(row.postal_code),
    isPrimary: bool(row.is_primary),
    isActive: bool(row.is_active),
    isDraft: bool(row.is_draft),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapPartnerContact(row: DbRecord): PartnerContact {
  return {
    id: String(row.id),
    businessPartnerId: String(row.business_partner_id),
    partnerLegalEntityId: textOrNull(row.partner_legal_entity_id),
    name: String(row.name),
    department: textOrNull(row.department),
    email: textOrNull(row.email),
    phone: textOrNull(row.phone),
    mobile: textOrNull(row.mobile),
    preferredContactMethod: String(row.preferred_contact_method) as PartnerContact["preferredContactMethod"],
    isPrimary: bool(row.is_primary),
    notes: textOrNull(row.notes),
    isActive: bool(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapProduct(row: DbRecord): Product {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    code: textOrNull(row.code),
    category: String(row.category) as Product["category"],
    defaultUnit: String(row.default_unit) as Product["defaultUnit"],
    defaultSackWeightKg: typeof row.default_sack_weight_kg === "number" ? row.default_sack_weight_kg : null,
    description: textOrNull(row.description),
    isActive: bool(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapClientBillingProfile(row: DbRecord): ClientBillingProfile {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    businessPartnerId: String(row.business_partner_id),
    ownLegalEntityId: textOrNull(row.own_legal_entity_id),
    periodicity: String(row.periodicity) as ClientBillingProfile["periodicity"],
    closingWeekday: typeof row.closing_weekday === "number" ? row.closing_weekday : null,
    closingDayOfMonth: typeof row.closing_day_of_month === "number" ? row.closing_day_of_month : null,
    dueDaysAfterClosing: Number(row.due_days_after_closing),
    autoIncludeUnbilledOperations: bool(row.auto_include_unbilled_operations),
    notes: textOrNull(row.notes),
    isActive: bool(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapServiceRateRule(row: DbRecord): ServiceRateRule {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    businessPartnerId: String(row.business_partner_id),
    ownLegalEntityId: textOrNull(row.own_legal_entity_id),
    counterpartyPartnerLegalEntityId: textOrNull(row.counterparty_partner_legal_entity_id),
    productId: textOrNull(row.product_id),
    operationScope: String(row.operation_scope) as ServiceRateRule["operationScope"],
    rateType: String(row.rate_type) as ServiceRateRule["rateType"],
    rateValueCents: Number(row.rate_value_cents),
    effectiveFrom: String(row.effective_from),
    effectiveTo: textOrNull(row.effective_to),
    priority: Number(row.priority),
    notes: textOrNull(row.notes),
    isActive: bool(row.is_active),
    conflictWarning: textOrNull(row.conflict_warning),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapPurchaseRateRule(row: DbRecord): PurchaseRateRule {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    businessPartnerId: String(row.business_partner_id),
    ownLegalEntityId: textOrNull(row.own_legal_entity_id),
    counterpartyPartnerLegalEntityId: textOrNull(row.counterparty_partner_legal_entity_id),
    productId: textOrNull(row.product_id),
    operationScope: String(row.operation_scope) as PurchaseRateRule["operationScope"],
    rateType: String(row.rate_type) as PurchaseRateRule["rateType"],
    rateValueCents: Number(row.rate_value_cents),
    effectiveFrom: String(row.effective_from),
    effectiveTo: textOrNull(row.effective_to),
    priority: Number(row.priority),
    notes: textOrNull(row.notes),
    isActive: bool(row.is_active),
    conflictWarning: textOrNull(row.conflict_warning),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapAccountPayableOperation(row: DbRecord): AccountPayableOperation {
  return {
    id: String(row.id),
    accountPayableId: String(row.account_payable_id),
    operationId: String(row.operation_id),
    ownLegalEntityIdSnapshot: textOrNull(row.own_legal_entity_id_snapshot),
    ownLegalEntityNameSnapshot: textOrNull(row.own_legal_entity_name_snapshot),
    supplierPartnerIdSnapshot: textOrNull(row.supplier_partner_id_snapshot),
    operationDateSnapshot: String(row.operation_date_snapshot),
    fiscalDocumentNumberSnapshot: textOrNull(row.fiscal_document_number_snapshot),
    fiscalDocumentSeriesSnapshot: textOrNull(row.fiscal_document_series_snapshot),
    productNameSnapshot: textOrNull(row.product_name_snapshot),
    operationScopeSnapshot: String(row.operation_scope_snapshot) as AccountPayableOperation["operationScopeSnapshot"],
    quantitySacksDecimalSnapshot: String(row.quantity_sacks_decimal_snapshot),
    purchaseRateCentsSnapshot: Number(row.purchase_rate_cents_snapshot),
    purchaseAmountCentsSnapshot: Number(row.purchase_amount_cents_snapshot),
    releasedAt: textOrNull(row.released_at),
    createdAt: String(row.created_at)
  };
}

export function mapOperationRateHistory(row: DbRecord): OperationRateHistoryEntry {
  return {
    id: String(row.id),
    operationId: String(row.operation_id),
    previousServiceRateRuleId: textOrNull(row.previous_service_rate_rule_id),
    previousRateValueCents: row.previous_rate_value_cents === null || row.previous_rate_value_cents === undefined ? null : Number(row.previous_rate_value_cents),
    previousServiceAmountCents: row.previous_service_amount_cents === null || row.previous_service_amount_cents === undefined ? null : Number(row.previous_service_amount_cents),
    newServiceRateRuleId: textOrNull(row.new_service_rate_rule_id),
    newRateValueCents: row.new_rate_value_cents === null || row.new_rate_value_cents === undefined ? null : Number(row.new_rate_value_cents),
    newServiceAmountCents: row.new_service_amount_cents === null || row.new_service_amount_cents === undefined ? null : Number(row.new_service_amount_cents),
    reason: textOrNull(row.reason),
    changedAt: String(row.changed_at)
  };
}

export function mapFiscalDocument(row: DbRecord): FiscalDocument {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    ownLegalEntityId: String(row.own_legal_entity_id),
    responsiblePartnerId: String(row.responsible_partner_id),
    partnerLegalEntityId: textOrNull(row.partner_legal_entity_id),
    secondaryResponsiblePartnerId: textOrNull(row.secondary_responsible_partner_id),
    secondaryOperationType: textOrNull(row.secondary_operation_type) as FiscalDocument["secondaryOperationType"],
    documentType: "MANUAL_INVOICE",
    accessKey: textOrNull(row.access_key),
    documentNumber: String(row.document_number),
    series: textOrNull(row.series),
    issueDate: String(row.issue_date),
    totalAmountCents: Number(row.total_amount_cents),
    status: String(row.status) as FiscalDocument["status"],
    hasPendingIssues: bool(row.has_pending_issues),
    pendingNotes: textOrNull(row.pending_notes),
    duplicateWarning: textOrNull(row.duplicate_warning),
    notes: textOrNull(row.notes),
    confirmedAt: textOrNull(row.confirmed_at),
    canceledAt: textOrNull(row.canceled_at),
    cancelReason: textOrNull(row.cancel_reason),
    source: (textOrNull(row.source) ?? "MANUAL") as FiscalDocument["source"],
    importJobId: textOrNull(row.import_job_id),
    importRowId: textOrNull(row.import_row_id),
    xmlFilePath: textOrNull(row.xml_file_path),
    xmlFileHash: textOrNull(row.xml_file_hash),
    protocolNumber: textOrNull(row.protocol_number),
    protocolDate: textOrNull(row.protocol_date),
    authorizationStatusCode: textOrNull(row.authorization_status_code),
    authorizationStatusMessage: textOrNull(row.authorization_status_message),
    xmlImportJobId: textOrNull(row.xml_import_job_id),
    mergedFromSource: textOrNull(row.merged_from_source) as FiscalDocument["mergedFromSource"],
    mergedAt: textOrNull(row.merged_at),
    direction: (textOrNull(row.direction) ?? "UNKNOWN") as FiscalDocument["direction"],
    fiscalSnapshotJson: textOrNull(row.fiscal_snapshot_json),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapFiscalDocumentItem(row: DbRecord): FiscalDocumentItem {
  return {
    id: String(row.id),
    fiscalDocumentId: String(row.fiscal_document_id),
    productId: textOrNull(row.product_id),
    description: String(row.description),
    quantity: String(row.quantity_decimal),
    unit: String(row.unit) as FiscalDocumentItem["unit"],
    unitPriceDecimal: String(row.unit_price_decimal),
    totalAmountCents: Number(row.total_amount_cents),
    sacksQuantity: textOrNull(row.sacks_quantity_decimal),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapOperation(row: DbRecord): Operation {
  return {
    id: String(row.id),
    fiscalDocumentId: String(row.fiscal_document_id),
    fiscalDocumentItemId: textOrNull(row.fiscal_document_item_id),
    organizationId: String(row.organization_id),
    ownLegalEntityId: String(row.own_legal_entity_id),
    responsiblePartnerId: String(row.responsible_partner_id),
    productId: textOrNull(row.product_id),
    operationType: String(row.operation_type) as Operation["operationType"],
    operationScope: String(row.operation_scope) as Operation["operationScope"],
    operationDate: String(row.operation_date),
    quantitySacks: String(row.quantity_sacks_decimal),
    serviceRateRuleId: textOrNull(row.service_rate_rule_id),
    appliedRateValueCents: Number(row.applied_rate_value_cents),
    serviceAmountCents: Number(row.service_amount_cents),
    rateWasManuallyOverridden: bool(row.rate_was_manually_overridden),
    manualRateValueCents: typeof row.manual_rate_value_cents === "number" ? row.manual_rate_value_cents : null,
    manualOverrideReason: textOrNull(row.manual_override_reason),
    notes: textOrNull(row.notes),
    status: String(row.status) as Operation["status"],
    source: (textOrNull(row.source) ?? "MANUAL") as Operation["source"],
    importJobId: textOrNull(row.import_job_id),
    importRowId: textOrNull(row.import_row_id),
    xmlImportJobId: textOrNull(row.xml_import_job_id),
    classificationRuleId: textOrNull(row.classification_rule_id),
    billingStatus: (textOrNull(row.billing_status) ?? "UNBILLED") as Operation["billingStatus"],
    clientChargeId: textOrNull(row.client_charge_id),
    purchaseSettlementStatus: (textOrNull(row.purchase_settlement_status) ?? "UNSETTLED") as Operation["purchaseSettlementStatus"],
    accountPayableId: textOrNull(row.account_payable_id),
    purchaseRateRuleId: textOrNull(row.purchase_rate_rule_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapSpreadsheetMappingTemplate(row: DbRecord): SpreadsheetMappingTemplate {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    importType: String(row.import_type) as SpreadsheetMappingTemplate["importType"],
    sheetNamePattern: textOrNull(row.sheet_name_pattern),
    headerRow: Number(row.header_row),
    columnMappingJson: String(row.column_mapping_json),
    defaultCommercialFlow: textOrNull(row.default_commercial_flow) as SpreadsheetMappingTemplate["defaultCommercialFlow"],
    defaultOperationScope: textOrNull(row.default_operation_scope) as SpreadsheetMappingTemplate["defaultOperationScope"],
    defaultProductId: textOrNull(row.default_product_id),
    isActive: bool(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapSpreadsheetImportJob(row: DbRecord): SpreadsheetImportJob {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    ownLegalEntityId: String(row.own_legal_entity_id),
    mappingTemplateId: textOrNull(row.mapping_template_id),
    originalFileName: String(row.original_file_name),
    storedFilePath: textOrNull(row.stored_file_path),
    selectedSheetName: String(row.selected_sheet_name),
    importType: String(row.import_type) as SpreadsheetImportJob["importType"],
    status: String(row.status) as SpreadsheetImportJob["status"],
    totalRows: Number(row.total_rows),
    validRows: Number(row.valid_rows),
    warningRows: Number(row.warning_rows),
    errorRows: Number(row.error_rows),
    importedRows: Number(row.imported_rows),
    duplicateRows: Number(row.duplicate_rows),
    createdAt: String(row.created_at),
    startedAt: textOrNull(row.started_at),
    completedAt: textOrNull(row.completed_at),
    cancelledAt: textOrNull(row.cancelled_at),
    createdByUserId: textOrNull(row.created_by_user_id),
    settingsJson: String(row.settings_json)
  };
}

export function mapSpreadsheetImportRow(row: DbRecord): SpreadsheetImportRow {
  return {
    id: String(row.id),
    importJobId: String(row.import_job_id),
    sheetName: String(row.sheet_name),
    sourceRowNumber: Number(row.source_row_number),
    rawDataJson: String(row.raw_data_json),
    normalizedDataJson: textOrNull(row.normalized_data_json),
    status: String(row.status) as SpreadsheetImportRow["status"],
    fiscalDocumentId: textOrNull(row.fiscal_document_id),
    operationId: textOrNull(row.operation_id),
    errorCode: textOrNull(row.error_code),
    errorMessage: textOrNull(row.error_message),
    warningCodesJson: textOrNull(row.warning_codes_json),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapPartnerAlias(row: DbRecord): PartnerAlias {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    businessPartnerId: String(row.business_partner_id),
    partnerLegalEntityId: textOrNull(row.partner_legal_entity_id),
    alias: String(row.alias),
    normalizedAlias: String(row.normalized_alias),
    source: String(row.source),
    isActive: bool(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapXmlImportJob(row: DbRecord): XmlImportJob {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    status: String(row.status) as XmlImportJob["status"],
    sourceType: String(row.source_type) as XmlImportJob["sourceType"],
    selectedFolder: textOrNull(row.selected_folder),
    includeSubfolders: bool(row.include_subfolders),
    totalFiles: Number(row.total_files),
    validFiles: Number(row.valid_files),
    warningFiles: Number(row.warning_files),
    duplicateFiles: Number(row.duplicate_files),
    errorFiles: Number(row.error_files),
    importedNotes: Number(row.imported_notes),
    importedEvents: Number(row.imported_events),
    createdOperations: Number(row.created_operations),
    itemsWithoutOperation: Number(row.items_without_operation ?? 0),
    createdAt: String(row.created_at),
    startedAt: textOrNull(row.started_at),
    completedAt: textOrNull(row.completed_at),
    cancelledAt: textOrNull(row.cancelled_at),
    revertedAt: textOrNull(row.reverted_at),
    settingsJson: String(row.settings_json)
  };
}

export function mapXmlImportFile(row: DbRecord): XmlImportFile {
  return {
    id: String(row.id),
    importJobId: String(row.import_job_id),
    originalFileName: String(row.original_file_name),
    storedFilePath: textOrNull(row.stored_file_path),
    fileHash: String(row.file_hash),
    fileSize: Number(row.file_size),
    xmlType: String(row.xml_type) as XmlImportFile["xmlType"],
    accessKey: textOrNull(row.access_key),
    status: String(row.status) as XmlImportFile["status"],
    fiscalDocumentId: textOrNull(row.fiscal_document_id),
    fiscalDocumentEventId: textOrNull(row.fiscal_document_event_id),
    errorCode: textOrNull(row.error_code),
    errorMessage: textOrNull(row.error_message),
    warningCodesJson: textOrNull(row.warning_codes_json),
    extractedDataJson: textOrNull(row.extracted_data_json),
    resolutionDataJson: textOrNull(row.resolution_data_json),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapFiscalDocumentEvent(row: DbRecord): FiscalDocumentEvent {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    fiscalDocumentId: textOrNull(row.fiscal_document_id),
    accessKey: String(row.access_key),
    eventType: String(row.event_type) as FiscalDocumentEvent["eventType"],
    sequenceNumber: String(row.sequence_number),
    eventDate: textOrNull(row.event_date),
    protocolNumber: textOrNull(row.protocol_number),
    statusCode: textOrNull(row.status_code),
    statusMessage: textOrNull(row.status_message),
    correctionText: textOrNull(row.correction_text),
    xmlFilePath: textOrNull(row.xml_file_path),
    fileHash: String(row.file_hash),
    createdAt: String(row.created_at)
  };
}

export function mapProductAlias(row: DbRecord): ProductAlias {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    productId: String(row.product_id),
    issuerPartnerLegalEntityId: textOrNull(row.issuer_partner_legal_entity_id),
    sourceProductCode: textOrNull(row.source_product_code),
    sourceDescription: String(row.source_description),
    normalizedDescription: String(row.normalized_description),
    ncm: textOrNull(row.ncm),
    isActive: bool(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapOperationClassificationRule(row: DbRecord): OperationClassificationRule {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    ownLegalEntityId: textOrNull(row.own_legal_entity_id),
    issuerPartnerLegalEntityId: textOrNull(row.issuer_partner_legal_entity_id),
    recipientPartnerLegalEntityId: textOrNull(row.recipient_partner_legal_entity_id),
    destinationPartnerId: textOrNull(row.destination_partner_id),
    productId: textOrNull(row.product_id),
    clientPartnerId: String(row.client_partner_id),
    commercialFlow: textOrNull(row.commercial_flow) as OperationClassificationRule["commercialFlow"],
    operationScope: String(row.operation_scope) as OperationClassificationRule["operationScope"],
    priority: Number(row.priority),
    isActive: bool(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapFiscalDocumentMergeHistory(row: DbRecord): FiscalDocumentMergeHistory {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    fiscalDocumentId: String(row.fiscal_document_id),
    xmlImportJobId: textOrNull(row.xml_import_job_id),
    previousSource: textOrNull(row.previous_source) as FiscalDocumentMergeHistory["previousSource"],
    decision: String(row.decision),
    differencesJson: String(row.differences_json),
    createdAt: String(row.created_at)
  };
}

export function mapClientCharge(row: DbRecord): ClientCharge {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    ownLegalEntityId: String(row.own_legal_entity_id),
    clientPartnerId: String(row.client_partner_id),
    billingProfileId: textOrNull(row.billing_profile_id),
    chargeNumber: textOrNull(row.charge_number),
    referenceCode: textOrNull(row.reference_code),
    periodicity: String(row.periodicity) as ClientCharge["periodicity"],
    periodStart: String(row.period_start),
    periodEnd: String(row.period_end),
    issueDate: textOrNull(row.issue_date),
    dueDate: textOrNull(row.due_date),
    status: String(row.status) as ClientCharge["status"],
    subtotalServicesCents: Number(row.subtotal_services_cents),
    additionsCents: Number(row.additions_cents),
    deductionsCents: Number(row.deductions_cents),
    finalAmountCents: Number(row.final_amount_cents),
    paidAmountCents: Number(row.paid_amount_cents),
    openAmountCents: Number(row.open_amount_cents),
    notes: textOrNull(row.notes),
    internalNotes: textOrNull(row.internal_notes),
    pdfFilePath: textOrNull(row.pdf_file_path),
    pdfFileHash: textOrNull(row.pdf_file_hash),
    excelFilePath: textOrNull(row.excel_file_path),
    imageFilePath: textOrNull(row.image_file_path),
    snapshotJson: textOrNull(row.snapshot_json),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    issuedAt: textOrNull(row.issued_at),
    cancelledAt: textOrNull(row.cancelled_at),
    cancellationReason: textOrNull(row.cancellation_reason),
    replacedByChargeId: textOrNull(row.replaced_by_charge_id)
  };
}

export function mapClientChargeOperation(row: DbRecord): ClientChargeOperation {
  return {
    id: String(row.id),
    clientChargeId: String(row.client_charge_id),
    operationId: String(row.operation_id),
    ownLegalEntityIdSnapshot: textOrNull(row.own_legal_entity_id_snapshot),
    ownLegalEntityNameSnapshot: textOrNull(row.own_legal_entity_name_snapshot),
    operationDateSnapshot: String(row.operation_date_snapshot),
    fiscalDocumentNumberSnapshot: textOrNull(row.fiscal_document_number_snapshot),
    fiscalDocumentSeriesSnapshot: textOrNull(row.fiscal_document_series_snapshot),
    issuerNameSnapshot: textOrNull(row.issuer_name_snapshot),
    destinationNameSnapshot: textOrNull(row.destination_name_snapshot),
    productNameSnapshot: textOrNull(row.product_name_snapshot),
    operationScopeSnapshot: String(row.operation_scope_snapshot) as ClientChargeOperation["operationScopeSnapshot"],
    quantitySacksDecimalSnapshot: String(row.quantity_sacks_decimal_snapshot),
    serviceRateCentsSnapshot: Number(row.service_rate_cents_snapshot),
    serviceAmountCentsSnapshot: Number(row.service_amount_cents_snapshot),
    releasedAt: textOrNull(row.released_at),
    createdAt: String(row.created_at)
  };
}

export function mapClientChargeAdjustment(row: DbRecord): ClientChargeAdjustment {
  return {
    id: String(row.id),
    clientChargeId: String(row.client_charge_id),
    ledgerEntryId: textOrNull(row.ledger_entry_id),
    ledgerEntryDate: textOrNull(row.ledger_entry_date),
    adjustmentType: String(row.adjustment_type) as ClientChargeAdjustment["adjustmentType"],
    effect: String(row.effect) as ClientChargeAdjustment["effect"],
    description: String(row.description),
    amountCents: Number(row.amount_cents),
    sortOrder: Number(row.sort_order),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapClientLedgerEntry(row: DbRecord): ClientLedgerEntry {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    ownLegalEntityId: String(row.own_legal_entity_id),
    clientPartnerId: String(row.client_partner_id),
    clientChargeId: textOrNull(row.client_charge_id),
    entryType: String(row.entry_type) as ClientLedgerEntry["entryType"],
    effect: String(row.effect) as ClientLedgerEntry["effect"],
    amountCents: Number(row.amount_cents),
    entryDate: String(row.entry_date),
    description: String(row.description),
    referenceNumber: textOrNull(row.reference_number),
    notes: textOrNull(row.notes),
    attachmentPath: textOrNull(row.attachment_path),
    status: String(row.status) as ClientLedgerEntry["status"],
    availableAmountCents: typeof row.available_amount_cents === "number" ? row.available_amount_cents : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    cancelledAt: textOrNull(row.cancelled_at),
    cancellationReason: textOrNull(row.cancellation_reason)
  };
}

export function mapClientCreditAllocation(row: DbRecord): ClientCreditAllocation {
  return {
    id: String(row.id),
    ledgerEntryId: String(row.ledger_entry_id),
    clientChargeId: String(row.client_charge_id),
    amountCents: Number(row.amount_cents),
    allocatedAt: String(row.allocated_at),
    cancelledAt: textOrNull(row.cancelled_at),
    cancellationReason: textOrNull(row.cancellation_reason)
  };
}

export function mapClientPayment(row: DbRecord): ClientPayment {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    ownLegalEntityId: String(row.own_legal_entity_id),
    clientPartnerId: String(row.client_partner_id),
    paymentDate: String(row.payment_date),
    amountCents: Number(row.amount_cents),
    paymentMethod: String(row.payment_method) as ClientPayment["paymentMethod"],
    bankAccountDescription: textOrNull(row.bank_account_description),
    transactionReference: textOrNull(row.transaction_reference),
    notes: textOrNull(row.notes),
    attachmentPath: textOrNull(row.attachment_path),
    status: String(row.status) as ClientPayment["status"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    cancelledAt: textOrNull(row.cancelled_at),
    cancellationReason: textOrNull(row.cancellation_reason)
  };
}

export function mapClientPaymentAllocation(row: DbRecord): ClientPaymentAllocation {
  return {
    id: String(row.id),
    clientPaymentId: String(row.client_payment_id),
    clientChargeId: String(row.client_charge_id),
    amountCents: Number(row.amount_cents),
    allocatedAt: String(row.allocated_at),
    cancelledAt: textOrNull(row.cancelled_at),
    cancellationReason: textOrNull(row.cancellation_reason)
  };
}

export function mapDocumentSequence(row: DbRecord): DocumentSequence {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    ownLegalEntityId: String(row.own_legal_entity_id),
    documentType: row.document_type === "DEAL_CONFIRMATION" ? "DEAL_CONFIRMATION" : "CLIENT_CHARGE",
    year: typeof row.year === "number" ? row.year : null,
    prefix: textOrNull(row.prefix),
    currentNumber: Number(row.current_number),
    padding: Number(row.padding),
    isActive: bool(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapChargeDocumentVersion(row: DbRecord): ChargeDocumentVersion {
  return {
    id: String(row.id),
    clientChargeId: String(row.client_charge_id),
    version: Number(row.version),
    pdfFilePath: textOrNull(row.pdf_file_path),
    pdfFileHash: textOrNull(row.pdf_file_hash),
    excelFilePath: textOrNull(row.excel_file_path),
    excelFileHash: textOrNull(row.excel_file_hash),
    imageFilePath: textOrNull(row.image_file_path),
    imageFileHash: textOrNull(row.image_file_hash),
    pdfStorageObjectPath: textOrNull(row.pdf_storage_object_path),
    excelStorageObjectPath: textOrNull(row.excel_storage_object_path),
    createdAt: String(row.created_at)
  };
}

export function mapExpenseCategory(row: DbRecord): ExpenseCategory {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    parentCategoryId: textOrNull(row.parent_category_id),
    name: String(row.name),
    code: textOrNull(row.code),
    expenseNature: String(row.expense_nature) as ExpenseCategory["expenseNature"],
    description: textOrNull(row.description),
    isActive: bool(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapCostCenter(row: DbRecord): CostCenter {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    ownLegalEntityId: textOrNull(row.own_legal_entity_id),
    locationId: textOrNull(row.location_id),
    parentCostCenterId: textOrNull(row.parent_cost_center_id),
    name: String(row.name),
    code: textOrNull(row.code),
    description: textOrNull(row.description),
    isActive: bool(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapFinancialAccount(row: DbRecord): FinancialAccount {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    ownLegalEntityId: String(row.own_legal_entity_id),
    name: String(row.name),
    accountType: String(row.account_type) as FinancialAccount["accountType"],
    bankName: textOrNull(row.bank_name),
    branch: textOrNull(row.branch),
    accountIdentifierMasked: textOrNull(row.account_identifier_masked),
    pixKeyDescription: textOrNull(row.pix_key_description),
    notes: textOrNull(row.notes),
    isActive: bool(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapAccountPayable(row: DbRecord): AccountPayable {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    ownLegalEntityId: String(row.own_legal_entity_id),
    supplierPartnerId: textOrNull(row.supplier_partner_id),
    supplierLegalEntityId: textOrNull(row.supplier_legal_entity_id),
    payeeNameSnapshot: String(row.payee_name_snapshot),
    payeeTaxIdSnapshot: textOrNull(row.payee_tax_id_snapshot),
    categoryId: String(row.category_id),
    defaultCostCenterId: textOrNull(row.default_cost_center_id),
    defaultLocationId: textOrNull(row.default_location_id),
    recurringTemplateId: textOrNull(row.recurring_template_id),
    installmentGroupId: textOrNull(row.installment_group_id),
    installmentNumber: typeof row.installment_number === "number" ? row.installment_number : null,
    installmentCount: typeof row.installment_count === "number" ? row.installment_count : null,
    source: String(row.source) as AccountPayable["source"],
    description: String(row.description),
    documentType: textOrNull(row.document_type),
    documentNumber: textOrNull(row.document_number),
    competenceDate: String(row.competence_date),
    issueDate: textOrNull(row.issue_date),
    dueDate: String(row.due_date),
    originalAmountCents: typeof row.original_amount_cents === "number" ? row.original_amount_cents : null,
    discountCents: Number(row.discount_cents),
    interestCents: Number(row.interest_cents),
    penaltyCents: Number(row.penalty_cents),
    otherAdditionsCents: Number(row.other_additions_cents),
    finalAmountCents: typeof row.final_amount_cents === "number" ? row.final_amount_cents : null,
    paidAmountCents: Number(row.paid_amount_cents),
    openAmountCents: typeof row.open_amount_cents === "number" ? row.open_amount_cents : null,
    amountStatus: String(row.amount_status) as AccountPayable["amountStatus"],
    status: String(row.status) as AccountPayable["status"],
    notes: textOrNull(row.notes),
    internalNotes: textOrNull(row.internal_notes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    confirmedAt: textOrNull(row.confirmed_at),
    cancelledAt: textOrNull(row.cancelled_at),
    cancellationReason: textOrNull(row.cancellation_reason),
    contestedAt: textOrNull(row.contested_at),
    contestReason: textOrNull(row.contest_reason)
  };
}

export function mapAccountPayableAllocation(row: DbRecord): AccountPayableAllocation {
  return {
    id: String(row.id),
    accountPayableId: String(row.account_payable_id),
    costCenterId: textOrNull(row.cost_center_id),
    locationId: textOrNull(row.location_id),
    allocationAmountCents: Number(row.allocation_amount_cents),
    allocationBasisPoints: typeof row.allocation_basis_points === "number" ? row.allocation_basis_points : null,
    description: textOrNull(row.description),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapPayableRecurringTemplate(row: DbRecord): PayableRecurringTemplate {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    ownLegalEntityId: String(row.own_legal_entity_id),
    supplierPartnerId: textOrNull(row.supplier_partner_id),
    supplierLegalEntityId: textOrNull(row.supplier_legal_entity_id),
    payeeNameSnapshot: String(row.payee_name_snapshot),
    categoryId: String(row.category_id),
    defaultCostCenterId: textOrNull(row.default_cost_center_id),
    defaultLocationId: textOrNull(row.default_location_id),
    description: String(row.description),
    amountMode: String(row.amount_mode) as PayableRecurringTemplate["amountMode"],
    fixedAmountCents: typeof row.fixed_amount_cents === "number" ? row.fixed_amount_cents : null,
    estimatedAmountCents: typeof row.estimated_amount_cents === "number" ? row.estimated_amount_cents : null,
    frequency: String(row.frequency) as PayableRecurringTemplate["frequency"],
    dueDay: Number(row.due_day),
    generationLeadDays: Number(row.generation_lead_days),
    startDate: String(row.start_date),
    endDate: textOrNull(row.end_date),
    autoGenerateOnOpen: bool(row.auto_generate_on_open),
    lastGeneratedCompetence: textOrNull(row.last_generated_competence),
    isActive: bool(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapPayableInstallmentGroup(row: DbRecord): PayableInstallmentGroup {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    ownLegalEntityId: String(row.own_legal_entity_id),
    supplierPartnerId: textOrNull(row.supplier_partner_id),
    description: String(row.description),
    totalAmountCents: Number(row.total_amount_cents),
    installmentCount: Number(row.installment_count),
    firstDueDate: String(row.first_due_date),
    intervalType: String(row.interval_type) as PayableInstallmentGroup["intervalType"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    cancelledAt: textOrNull(row.cancelled_at),
    cancellationReason: textOrNull(row.cancellation_reason)
  };
}

export function mapPayablePayment(row: DbRecord): PayablePayment {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    ownLegalEntityId: String(row.own_legal_entity_id),
    financialAccountId: textOrNull(row.financial_account_id),
    paymentDate: String(row.payment_date),
    amountCents: Number(row.amount_cents),
    paymentMethod: String(row.payment_method) as PayablePayment["paymentMethod"],
    transactionReference: textOrNull(row.transaction_reference),
    payeeNameSnapshot: String(row.payee_name_snapshot),
    notes: textOrNull(row.notes),
    attachmentPath: textOrNull(row.attachment_path),
    attachmentHash: textOrNull(row.attachment_hash),
    status: String(row.status) as PayablePayment["status"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    cancelledAt: textOrNull(row.cancelled_at),
    cancellationReason: textOrNull(row.cancellation_reason)
  };
}

export function mapPayablePaymentAllocation(row: DbRecord): PayablePaymentAllocation {
  return {
    id: String(row.id),
    payablePaymentId: String(row.payable_payment_id),
    accountPayableId: String(row.account_payable_id),
    amountCents: Number(row.amount_cents),
    allocatedAt: String(row.allocated_at),
    cancelledAt: textOrNull(row.cancelled_at),
    cancellationReason: textOrNull(row.cancellation_reason)
  };
}

export function mapPayableStatusHistory(row: DbRecord): PayableStatusHistory {
  return {
    id: String(row.id),
    accountPayableId: String(row.account_payable_id),
    previousStatus: textOrNull(row.previous_status) as PayableStatusHistory["previousStatus"],
    newStatus: String(row.new_status) as PayableStatusHistory["newStatus"],
    reason: textOrNull(row.reason),
    changedByUserId: textOrNull(row.changed_by_user_id),
    changedAt: String(row.changed_at)
  };
}

export function mapPayableDocumentAttachment(row: DbRecord): PayableDocumentAttachment {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    ownLegalEntityId: String(row.own_legal_entity_id),
    accountPayableId: textOrNull(row.account_payable_id),
    payablePaymentId: textOrNull(row.payable_payment_id),
    attachmentKind: String(row.attachment_kind) as PayableDocumentAttachment["attachmentKind"],
    attachmentType: String(row.attachment_type ?? "OTHER") as PayableDocumentAttachment["attachmentType"],
    originalFileName: String(row.original_file_name),
    storedFilePath: String(row.stored_file_path),
    fileHash: String(row.file_hash),
    mimeType: String(row.mime_type),
    fileExtension: String(row.file_extension ?? ""),
    fileSize: Number(row.file_size),
    description: textOrNull(row.description),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at ?? row.created_at),
    removedAt: textOrNull(row.removed_at),
    removalReason: textOrNull(row.removal_reason)
  };
}

export function mapFinancialReportGeneration(row: DbRecord): FinancialReportGeneration {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    ownLegalEntityId: textOrNull(row.own_legal_entity_id),
    reportType: String(row.report_type) as FinancialReportGeneration["reportType"],
    format: String(row.format) as FinancialReportGeneration["format"],
    filtersJson: String(row.filters_json),
    fileName: String(row.file_name),
    storedFilePath: String(row.stored_file_path),
    fileHash: String(row.file_hash),
    createdAt: String(row.created_at)
  };
}

export function mapDealConfirmation(row: DbRecord): DealConfirmation {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    ownLegalEntityId: String(row.own_legal_entity_id),
    templateId: textOrNull(row.template_id),
    confirmationNumber: textOrNull(row.confirmation_number),
    temporaryReference: String(row.temporary_reference),
    confirmationDate: String(row.confirmation_date),
    negotiationDate: textOrNull(row.negotiation_date),
    status: row.status as DealConfirmation["status"],
    signatureStatus: row.signature_status as DealConfirmation["signatureStatus"],
    currencyCode: String(row.currency_code),
    totalQuantitySacksDecimal: String(row.total_quantity_sacks_decimal),
    totalCommercialAmountCents: Number(row.total_commercial_amount_cents),
    deliveryLocationSnapshot: textOrNull(row.delivery_location_snapshot),
    deliveryStartDate: textOrNull(row.delivery_start_date),
    deliveryEndDate: textOrNull(row.delivery_end_date),
    paymentTermsSnapshot: textOrNull(row.payment_terms_snapshot),
    qualityTermsSnapshot: textOrNull(row.quality_terms_snapshot),
    generalTermsSnapshot: textOrNull(row.general_terms_snapshot),
    publicNotes: textOrNull(row.public_notes),
    internalNotes: textOrNull(row.internal_notes),
    brokeragePercentageBasisPoints: row.brokerage_percentage_basis_points == null ? null : Number(row.brokerage_percentage_basis_points),
    bankName: textOrNull(row.bank_name),
    bankCode: textOrNull(row.bank_code),
    bankAgency: textOrNull(row.bank_agency),
    bankAccount: textOrNull(row.bank_account),
    bankAccountType: textOrNull(row.bank_account_type),
    bankHolderName: textOrNull(row.bank_holder_name),
    bankHolderDocument: textOrNull(row.bank_holder_document),
    pixKey: textOrNull(row.pix_key),
    pixKeyType: textOrNull(row.pix_key_type),
    templateSnapshotJson: textOrNull(row.template_snapshot_json),
    pendingIssuesJson: String(row.pending_issues_json ?? "[]"),
    issuedDocumentVersionId: textOrNull(row.issued_document_version_id),
    signedDocumentVersionId: textOrNull(row.signed_document_version_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    issuedAt: textOrNull(row.issued_at),
    sentForSignatureAt: textOrNull(row.sent_for_signature_at),
    signedAt: textOrNull(row.signed_at),
    cancelledAt: textOrNull(row.cancelled_at),
    cancellationReason: textOrNull(row.cancellation_reason),
    replacedByConfirmationId: textOrNull(row.replaced_by_confirmation_id)
  };
}

export function mapDealConfirmationParty(row: DbRecord): DealConfirmationParty {
  return {
    id: String(row.id),
    dealConfirmationId: String(row.deal_confirmation_id),
    partyRole: row.party_role as DealConfirmationParty["partyRole"],
    businessPartnerId: textOrNull(row.business_partner_id),
    partnerLegalEntityId: textOrNull(row.partner_legal_entity_id),
    ownLegalEntityId: textOrNull(row.own_legal_entity_id),
    manualName: textOrNull(row.manual_name),
    snapshotJson: String(row.snapshot_json),
    representativeName: textOrNull(row.representative_name),
    sortOrder: Number(row.sort_order),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapDealConfirmationItem(row: DbRecord): DealConfirmationItem {
  return {
    id: String(row.id),
    dealConfirmationId: String(row.deal_confirmation_id),
    sortOrder: Number(row.sort_order),
    productId: textOrNull(row.product_id),
    productNameSnapshot: String(row.product_name_snapshot),
    productDescriptionSnapshot: textOrNull(row.product_description_snapshot),
    cropSnapshot: textOrNull(row.crop_snapshot),
    qualitySnapshot: textOrNull(row.quality_snapshot),
    packagingSnapshot: textOrNull(row.packaging_snapshot),
    originSnapshot: textOrNull(row.origin_snapshot),
    destinationSnapshot: textOrNull(row.destination_snapshot),
    quantitySacksDecimal: String(row.quantity_sacks_decimal),
    sackWeightKgDecimal: String(row.sack_weight_kg_decimal),
    totalWeightKgDecimal: textOrNull(row.total_weight_kg_decimal),
    unitPriceDecimal: String(row.unit_price_decimal),
    calculatedTotalAmountCents: Number(row.calculated_total_amount_cents),
    totalAmountCents: Number(row.total_amount_cents),
    totalWasManuallyOverridden: bool(row.total_was_manually_overridden),
    totalOverrideReason: textOrNull(row.total_override_reason),
    deliveryStartDate: textOrNull(row.delivery_start_date),
    deliveryEndDate: textOrNull(row.delivery_end_date),
    deliveryLocationSnapshot: textOrNull(row.delivery_location_snapshot),
    notes: textOrNull(row.notes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapDealConfirmationTemplate(row: DbRecord): DealConfirmationTemplate {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    ownLegalEntityId: textOrNull(row.own_legal_entity_id),
    name: String(row.name),
    description: textOrNull(row.description),
    version: Number(row.version),
    title: String(row.title),
    subtitle: textOrNull(row.subtitle),
    layoutMode: row.layout_mode as DealConfirmationTemplate["layoutMode"],
    defaultPaymentTerms: textOrNull(row.default_payment_terms),
    defaultDeliveryTerms: textOrNull(row.default_delivery_terms),
    defaultQualityTerms: textOrNull(row.default_quality_terms),
    defaultGeneralTerms: textOrNull(row.default_general_terms),
    showBroker: bool(row.show_broker),
    showCommercialValues: bool(row.show_commercial_values),
    showItemOrigins: bool(row.show_item_origins),
    showSignatureBlocks: bool(row.show_signature_blocks),
    signatureBlockCount: Number(row.signature_block_count),
    isDefault: bool(row.is_default),
    isActive: bool(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapDealConfirmationClause(row: DbRecord): DealConfirmationClause {
  return {
    id: String(row.id),
    dealConfirmationId: String(row.deal_confirmation_id),
    clauseNumber: textOrNull(row.clause_number),
    title: textOrNull(row.title),
    clauseText: String(row.clause_text),
    sortOrder: Number(row.sort_order),
    isVisible: bool(row.is_visible),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapDealClauseTemplate(row: DbRecord): DealClauseTemplate {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    title: textOrNull(row.title),
    clauseText: String(row.clause_text),
    category: row.category as DealClauseTemplate["category"],
    isActive: bool(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapDealPaymentTerm(row: DbRecord): DealPaymentTerm {
  return {
    id: String(row.id),
    dealConfirmationId: String(row.deal_confirmation_id),
    sortOrder: Number(row.sort_order),
    description: String(row.description),
    percentageBasisPoints: row.percentage_basis_points === null || row.percentage_basis_points === undefined ? null : Number(row.percentage_basis_points),
    amountCents: row.amount_cents === null || row.amount_cents === undefined ? null : Number(row.amount_cents),
    dueDate: textOrNull(row.due_date),
    daysAfterEvent: row.days_after_event === null || row.days_after_event === undefined ? null : Number(row.days_after_event),
    eventReference: textOrNull(row.event_reference),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapDealConfirmationSigner(row: DbRecord): DealConfirmationSigner {
  return {
    id: String(row.id),
    dealConfirmationId: String(row.deal_confirmation_id),
    partyRole: row.party_role as DealConfirmationSigner["partyRole"],
    name: String(row.name),
    documentNumber: textOrNull(row.document_number),
    positionTitle: textOrNull(row.position_title),
    email: textOrNull(row.email),
    phone: textOrNull(row.phone),
    signatureOrder: Number(row.signature_order),
    signatureStatus: row.signature_status as DealConfirmationSigner["signatureStatus"],
    signedAt: textOrNull(row.signed_at),
    notes: textOrNull(row.notes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapDealConfirmationDocumentVersion(row: DbRecord): DealConfirmationDocumentVersion {
  return {
    id: String(row.id),
    dealConfirmationId: String(row.deal_confirmation_id),
    versionNumber: Number(row.version_number),
    documentType: row.document_type as DealConfirmationDocumentVersion["documentType"],
    originalFileName: String(row.original_file_name),
    storedFilePath: String(row.stored_file_path),
    mimeType: String(row.mime_type),
    fileSize: Number(row.file_size),
    fileHash: String(row.file_hash),
    generatedBySystem: bool(row.generated_by_system),
    isCurrent: bool(row.is_current),
    notes: textOrNull(row.notes),
    storageObjectPath: textOrNull(row.storage_object_path),
    createdAt: String(row.created_at)
  };
}

export function mapDealConfirmationStatusHistory(row: DbRecord): DealConfirmationStatusHistory {
  return {
    id: String(row.id),
    dealConfirmationId: String(row.deal_confirmation_id),
    previousStatus: row.previous_status ? (row.previous_status as DealConfirmationStatusHistory["previousStatus"]) : null,
    newStatus: row.new_status as DealConfirmationStatusHistory["newStatus"],
    reason: textOrNull(row.reason),
    changedByUserId: textOrNull(row.changed_by_user_id),
    changedAt: String(row.changed_at)
  };
}
