import { z } from "zod";

export const appVariantSchema = z.enum(["villa", "grao", "multiempresa"]);
export const themeModeSchema = z.enum(["light", "dark"]);
export const locationTypeSchema = z.enum(["OFFICE", "BRANCH", "WAREHOUSE", "PROPERTY", "STORAGE", "OTHER"]);
export const userRoleSchema = z.enum(["ADMIN", "OPERATOR", "VIEWER"]);

const isoDateSchema = z.string().datetime();
const nullableText = z.string().trim().min(1).nullable();
const ufSchema = z.enum(["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"]);
const digits = (value: string): string => value.replace(/\D/g, "");

export const organizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).regex(/^[a-z0-9-]+$/),
  displayName: z.string().trim().min(1),
  appDisplayName: z.string().trim().min(1),
  logoPath: z.string().trim().min(1).nullable(),
  compactLogoPath: z.string().trim().min(1).nullable(),
  iconPath: z.string().trim().min(1).nullable(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  themeMode: themeModeSchema,
  isActive: z.boolean(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema
});

export const legalEntitySchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  legalName: z.string().trim().min(1),
  tradeName: z.string().trim().min(1),
  cnpj: z.string().regex(/^\d{14}$/).nullable(),
  stateRegistration: nullableText,
  municipalRegistration: nullableText,
  email: z.string().email().nullable(),
  phone: nullableText,
  addressLine: z.string().trim().min(1),
  addressNumber: z.string().trim().min(1),
  addressComplement: nullableText,
  district: z.string().trim().min(1),
  city: z.string().trim().min(1),
  state: ufSchema,
  postalCode: z.string().regex(/^\d{8}$/),
  documentPrefix: nullableText,
  defaultBankName: nullableText.optional().default(null),
  defaultBankCode: nullableText.optional().default(null),
  defaultBankAgency: nullableText.optional().default(null),
  defaultBankAccount: nullableText.optional().default(null),
  defaultPixKey: nullableText.optional().default(null),
  isDraft: z.boolean(),
  isActive: z.boolean(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema
});

export const locationSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  legalEntityId: z.string().uuid().nullable(),
  name: z.string().trim().min(1),
  type: locationTypeSchema,
  description: nullableText,
  addressLine: nullableText,
  addressNumber: nullableText,
  addressComplement: nullableText,
  district: nullableText,
  city: nullableText,
  state: ufSchema.nullable(),
  postalCode: z.string().regex(/^\d{8}$/).nullable(),
  isActive: z.boolean(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema
});

export const installationProfileSchema = z.object({
  id: z.string().uuid(),
  installationName: z.string().trim().min(1),
  appVariant: appVariantSchema,
  defaultOrganizationId: z.string().uuid().nullable(),
  defaultLegalEntityId: z.string().uuid().nullable(),
  allowOrganizationSwitch: z.boolean(),
  allowLegalEntitySwitch: z.boolean(),
  completedSetup: z.boolean(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema
});

export const saveInstallationProfileSchema = installationProfileSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const organizationInputSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).regex(/^[a-z0-9-]+$/),
  displayName: z.string().trim().min(1),
  appDisplayName: z.string().trim().min(1),
  description: z.string().trim().min(1).nullable().optional(),
  logoPath: z.string().trim().min(1).nullable().optional(),
  compactLogoPath: z.string().trim().min(1).nullable().optional(),
  iconPath: z.string().trim().min(1).nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  themeMode: themeModeSchema,
  isActive: z.boolean()
});

export const legalEntityInputSchema = z
  .object({
    organizationId: z.string().uuid(),
    legalName: z.string().trim().min(1),
    tradeName: z.string().trim().min(1),
    cnpj: z.string().transform(digits).pipe(z.string().length(14)).nullable(),
    stateRegistration: nullableText,
    municipalRegistration: nullableText,
    email: z.string().trim().email().nullable(),
    phone: z.string().transform(digits).pipe(z.string().min(8).max(13)).nullable(),
    addressLine: z.string().trim().min(1),
    addressNumber: z.string().trim().min(1),
    addressComplement: nullableText,
    district: z.string().trim().min(1),
    city: z.string().trim().min(1),
    state: ufSchema,
    postalCode: z.string().transform(digits).pipe(z.string().length(8)),
    documentPrefix: z.string().trim().regex(/^[A-Za-z0-9_.-]{1,20}$/).nullable(),
    defaultBankName: nullableText.optional().default(null),
    defaultBankCode: nullableText.optional().default(null),
    defaultBankAgency: nullableText.optional().default(null),
    defaultBankAccount: nullableText.optional().default(null),
    defaultBankAccountType: nullableText.optional().default(null),
    defaultBankHolderName: nullableText.optional().default(null),
    defaultBankHolderDocument: nullableText.optional().default(null),
    defaultPixKey: nullableText.optional().default(null),
    defaultPixKeyType: nullableText.optional().default(null),
    defaultPaymentTerms: nullableText.optional().default(null),
    defaultDeliveryTerms: nullableText.optional().default(null),
    defaultConfirmationNotes: nullableText.optional().default(null),
    isDraft: z.boolean(),
    isActive: z.boolean()
  })
  .refine((value) => value.isDraft || value.cnpj !== null, "CNPJ valido e obrigatorio para cadastro ativo.");

export const locationInputSchema = z.object({
  organizationId: z.string().uuid(),
  legalEntityId: z.string().uuid().nullable(),
  name: z.string().trim().min(1),
  type: locationTypeSchema,
  description: nullableText,
  addressLine: nullableText,
  addressNumber: nullableText,
  addressComplement: nullableText,
  district: nullableText,
  city: nullableText,
  state: ufSchema.nullable(),
  postalCode: z.string().transform(digits).pipe(z.string().length(8)).nullable(),
  isActive: z.boolean()
});

export const updateInstallationProfileSchema = saveInstallationProfileSchema.extend({
  confirmVariantChange: z.boolean().optional()
});

export const brandingAssetKindSchema = z.enum(["logo", "compactLogo", "icon"]);

export const businessPartnerRoleSchema = z.enum(["CLIENT", "SUPPLIER", "SELLER", "BUYER", "DESTINATION", "CARRIER", "SERVICE_PROVIDER", "OTHER"]);
export const preferredContactMethodSchema = z.enum(["PHONE", "MOBILE", "EMAIL", "WHATSAPP", "OTHER"]);
export const productCategorySchema = z.enum(["COFFEE_ARABICA", "COFFEE_CONILON", "COFFEE_OTHER", "OTHER"]);
export const productUnitSchema = z.enum(["SACK", "KG", "TON", "UNIT"]);
export const billingPeriodicitySchema = z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "CUSTOM"]);
export const operationScopeSchema = z.enum(["INTERNAL", "EXTERNAL", "ALL"]);
export const rateTypeSchema = z.enum(["PER_SACK"]);

export const businessPartnerInputSchema = z.object({
  organizationId: z.string().uuid(),
  displayName: z.string().trim().min(1),
  notes: nullableText,
  roles: z.array(businessPartnerRoleSchema).min(1),
  isActive: z.boolean(),
  creditLimitCents: z.number().int().min(0).nullable().optional(),
  documentNumber: z.string().transform(digits).pipe(z.string().min(11).max(14)).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  phone: z.string().transform(digits).pipe(z.string().min(8).max(13)).nullable().optional(),
  mobile: z.string().transform(digits).pipe(z.string().min(8).max(13)).nullable().optional(),
  postalCode: z.string().transform(digits).pipe(z.string().length(8)).nullable().optional(),
  addressLine: nullableText.optional().default(null),
  addressNumber: nullableText.optional().default(null),
  addressComplement: nullableText.optional().default(null),
  district: nullableText.optional().default(null),
  city: nullableText.optional().default(null),
  state: ufSchema.nullable().optional().default(null)
});

export const partnerLegalEntityInputSchema = z
  .object({
    organizationId: z.string().uuid(),
    businessPartnerId: z.string().uuid().nullable(),
    legalName: z.string().trim().min(1),
    tradeName: z.string().trim().min(1),
    cnpj: z.string().transform(digits).pipe(z.string().length(14)).nullable(),
    stateRegistration: nullableText,
    municipalRegistration: nullableText,
    email: z.string().trim().email().nullable(),
    phone: z.string().transform(digits).pipe(z.string().min(8).max(13)).nullable(),
    addressLine: nullableText,
    addressNumber: nullableText,
    addressComplement: nullableText,
    district: nullableText,
    city: nullableText,
    state: ufSchema.nullable(),
    postalCode: z.string().transform(digits).pipe(z.string().length(8)).nullable(),
    isPrimary: z.boolean(),
    isActive: z.boolean(),
    isDraft: z.boolean()
  })
  .refine((value) => value.isDraft || value.cnpj !== null, "CNPJ valido e obrigatorio para cadastro ativo.")
  .refine((value) => !value.isPrimary || value.businessPartnerId !== null, "So' faz sentido marcar como principal depois de vincular a um cliente/corretor.");

export const mergeBusinessPartnerDuplicateInputSchema = z.object({
  canonicalPartnerId: z.string().uuid(),
  duplicatePartnerId: z.string().uuid(),
  matchedCnpj: z.string().nullable(),
  reason: nullableText
});

export const partnerContactInputSchema = z.object({
  businessPartnerId: z.string().uuid(),
  partnerLegalEntityId: z.string().uuid().nullable(),
  name: z.string().trim().min(1),
  department: nullableText,
  email: z.string().trim().email().nullable(),
  phone: z.string().transform(digits).pipe(z.string().min(8).max(13)).nullable(),
  mobile: z.string().transform(digits).pipe(z.string().min(8).max(13)).nullable(),
  preferredContactMethod: preferredContactMethodSchema,
  isPrimary: z.boolean(),
  notes: nullableText,
  isActive: z.boolean()
});

export const productInputSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(1),
  code: z.string().trim().min(1).nullable(),
  category: productCategorySchema,
  defaultUnit: productUnitSchema,
  defaultSackWeightKg: z.number().positive().nullable(),
  description: nullableText,
  isActive: z.boolean()
});

export const billingProfileInputSchema = z.object({
  organizationId: z.string().uuid(),
  businessPartnerId: z.string().uuid(),
  ownLegalEntityId: z.string().uuid().nullable(),
  periodicity: billingPeriodicitySchema,
  closingWeekday: z.number().int().min(0).max(6).nullable(),
  closingDayOfMonth: z.number().int().min(1).max(31).nullable(),
  dueDaysAfterClosing: z.number().int().min(0),
  autoIncludeUnbilledOperations: z.boolean(),
  notes: nullableText,
  isActive: z.boolean()
});

export const serviceRateRuleInputSchema = z
  .object({
    organizationId: z.string().uuid(),
    businessPartnerId: z.string().uuid(),
    ownLegalEntityId: z.string().uuid().nullable(),
    counterpartyPartnerLegalEntityId: z.string().uuid().nullable().optional().default(null),
    productId: z.string().uuid().nullable(),
    operationScope: operationScopeSchema,
    rateType: rateTypeSchema,
    rateValueCents: z.number().int().min(0),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    priority: z.number().int().min(0),
    notes: nullableText,
    isActive: z.boolean()
  })
  .refine((value) => !value.effectiveTo || value.effectiveTo >= value.effectiveFrom, "Data final deve ser posterior ou igual ao inicio.");

export const resolveRateInputSchema = z.object({
  organizationId: z.string().uuid(),
  businessPartnerId: z.string().uuid(),
  ownLegalEntityId: z.string().uuid().nullable(),
  counterpartyPartnerLegalEntityId: z.string().uuid().nullable().optional().default(null),
  productId: z.string().uuid().nullable(),
  operationScope: operationScopeSchema.exclude(["ALL"]),
  operationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

// Mesma forma de service_rate_rules -- preco por saca que PAGAMOS ao
// fornecedor numa nota de entrada, em vez do que cobramos do cliente.
export const purchaseRateRuleInputSchema = z
  .object({
    organizationId: z.string().uuid(),
    businessPartnerId: z.string().uuid(),
    ownLegalEntityId: z.string().uuid().nullable(),
    counterpartyPartnerLegalEntityId: z.string().uuid().nullable().optional().default(null),
    productId: z.string().uuid().nullable(),
    operationScope: operationScopeSchema,
    rateType: rateTypeSchema,
    rateValueCents: z.number().int().min(0),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    priority: z.number().int().min(0),
    notes: nullableText,
    isActive: z.boolean()
  })
  .refine((value) => !value.effectiveTo || value.effectiveTo >= value.effectiveFrom, "Data final deve ser posterior ou igual ao inicio.");

export const resolvePurchaseRateInputSchema = z.object({
  organizationId: z.string().uuid(),
  businessPartnerId: z.string().uuid(),
  ownLegalEntityId: z.string().uuid().nullable(),
  counterpartyPartnerLegalEntityId: z.string().uuid().nullable().optional().default(null),
  productId: z.string().uuid().nullable(),
  operationScope: operationScopeSchema.exclude(["ALL"]),
  operationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

const decimalTextSchema = z.string().trim().regex(/^\d+(\.\d{1,6})?$/);
export const fiscalDocumentStatusSchema = z.enum(["DRAFT", "PENDING", "CONFIRMED", "CANCELED"]);
export const operationTypeSchema = z.enum(["PURCHASE", "SALE"]);

export const fiscalDocumentInputSchema = z.object({
  organizationId: z.string().uuid(),
  ownLegalEntityId: z.string().uuid(),
  responsiblePartnerId: z.string().uuid(),
  partnerLegalEntityId: z.string().uuid().nullable(),
  operationType: operationTypeSchema.default("SALE"),
  // Nota triangulada: segundo parceiro/tipo de operacao quando a mesma nota
  // representa uma compra de um fornecedor revendida a outro corretor/
  // cliente na mesma remessa (nenhum dos dois e' CNPJ proprio). Ver migration
  // 033_fiscal_document_secondary_partner.
  secondaryResponsiblePartnerId: z.string().uuid().nullable().optional(),
  secondaryOperationType: operationTypeSchema.nullable().optional(),
  accessKey: z.string().trim().regex(/^\d{44}$/).nullable(),
  documentNumber: z.string().trim().min(1),
  series: nullableText,
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalAmountCents: z.number().int().min(0),
  hasPendingIssues: z.boolean(),
  pendingNotes: nullableText,
  notes: nullableText
});

export const fiscalDocumentItemInputSchema = z.object({
  fiscalDocumentId: z.string().uuid(),
  productId: z.string().uuid().nullable(),
  description: z.string().trim().min(1),
  quantity: decimalTextSchema,
  unit: productUnitSchema,
  unitPriceDecimal: decimalTextSchema,
  totalAmountCents: z.number().int().min(0),
  sacksQuantity: decimalTextSchema.nullable()
});

export const operationInputSchema = z.object({
  fiscalDocumentId: z.string().uuid(),
  fiscalDocumentItemId: z.string().uuid().nullable(),
  ownLegalEntityId: z.string().uuid(),
  responsiblePartnerId: z.string().uuid(),
  productId: z.string().uuid().nullable(),
  operationType: operationTypeSchema,
  operationScope: operationScopeSchema.exclude(["ALL"]),
  operationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantitySacks: decimalTextSchema,
  manualRateValueCents: z.number().int().min(0).nullable(),
  manualOverrideReason: nullableText,
  notes: nullableText,
  // Por padrao a resolucao de preco usa a contraparte da propria nota fiscal
  // (fiscal_documents.partner_legal_entity_id). Numa nota triangulada, a
  // segunda perna (o outro lado da remessa) precisa resolver o preco contra
  // a empresa do PARCEIRO SECUNDARIO, nao contra a contraparte original --
  // por isso esse override existe, opcional pra nao afetar nenhuma chamada
  // existente.
  counterpartyPartnerLegalEntityId: z.string().uuid().nullable().optional()
});

export const fiscalDocumentTriangulationInputSchema = z.object({
  secondaryResponsiblePartnerId: z.string().uuid()
});

export const spreadsheetImportTypeSchema = z.enum(["GENERAL_SALES", "CLIENT_INDIVIDUAL", "CUSTOM"]);
export const spreadsheetImportStatusSchema = z.enum(["DRAFT", "VALIDATED", "PROCESSING", "COMPLETED", "COMPLETED_WITH_ERRORS", "CANCELLED", "FAILED", "REVERTED"]);
export const spreadsheetImportRowStatusSchema = z.enum(["PENDING", "VALID", "WARNING", "ERROR", "DUPLICATE", "IMPORTED", "SKIPPED", "REVERTED"]);

export const spreadsheetMappingTemplateInputSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(1),
  importType: spreadsheetImportTypeSchema,
  sheetNamePattern: nullableText,
  headerRow: z.number().int().min(1),
  columnMapping: z.record(z.string(), z.string()),
  defaultCommercialFlow: operationTypeSchema.nullable(),
  defaultOperationScope: operationScopeSchema.exclude(["ALL"]).nullable(),
  defaultProductId: z.string().uuid().nullable(),
  isActive: z.boolean()
});

export const spreadsheetImportJobInputSchema = z.object({
  organizationId: z.string().uuid(),
  ownLegalEntityId: z.string().uuid(),
  mappingTemplateId: z.string().uuid().nullable(),
  originalFileName: z.string().trim().min(1),
  storedFilePath: z.string().trim().min(1).nullable(),
  selectedSheetName: z.string().trim().min(1),
  importType: spreadsheetImportTypeSchema,
  settings: z.record(z.string(), z.unknown())
});

export const spreadsheetImportRowInputSchema = z.object({
  importJobId: z.string().uuid(),
  sheetName: z.string().trim().min(1),
  sourceRowNumber: z.number().int().min(1),
  rawData: z.record(z.string(), z.unknown()),
  normalizedData: z.record(z.string(), z.unknown()).nullable(),
  status: spreadsheetImportRowStatusSchema,
  errorCode: nullableText,
  errorMessage: nullableText,
  warningCodes: z.array(z.string())
});

export const partnerAliasInputSchema = z.object({
  organizationId: z.string().uuid(),
  businessPartnerId: z.string().uuid(),
  partnerLegalEntityId: z.string().uuid().nullable(),
  alias: z.string().trim().min(1),
  source: z.string().trim().min(1),
  isActive: z.boolean()
});

export const xmlImportSourceTypeSchema = z.enum(["FILE", "MULTIPLE_FILES", "FOLDER", "DRAG_DROP"]);
export const xmlImportStatusSchema = z.enum(["DRAFT", "INSPECTING", "VALIDATED", "PROCESSING", "COMPLETED", "COMPLETED_WITH_ERRORS", "CANCELLED", "FAILED", "REVERTED"]);
export const xmlImportFileStatusSchema = z.enum(["PENDING", "VALID", "WARNING", "PENDING_REVIEW", "DUPLICATE", "ERROR", "IMPORTED", "SKIPPED", "REVERTED"]);
export const xmlTypeSchema = z.enum(["NFE_PROC", "NFE", "EVENT_CANCELLATION", "EVENT_CORRECTION_LETTER", "EVENT_OTHER", "UNKNOWN"]);
export const fiscalDocumentEventTypeSchema = z.enum(["CANCELLATION", "CORRECTION_LETTER", "OTHER"]);

export const xmlImportJobInputSchema = z.object({
  organizationId: z.string().uuid(),
  sourceType: xmlImportSourceTypeSchema,
  selectedFolder: nullableText,
  includeSubfolders: z.boolean(),
  settings: z.record(z.string(), z.unknown())
});

export const xmlImportFileInputSchema = z.object({
  importJobId: z.string().uuid(),
  originalFileName: z.string().trim().min(1),
  fileHash: z.string().trim().regex(/^[a-f0-9]{64}$/),
  fileSize: z.number().int().min(0),
  xmlType: xmlTypeSchema,
  accessKey: z.string().trim().regex(/^\d{44}$/).nullable(),
  status: xmlImportFileStatusSchema,
  errorCode: nullableText,
  errorMessage: nullableText,
  warningCodes: z.array(z.string()),
  extractedData: z.record(z.string(), z.unknown()).nullable(),
  resolutionData: z.record(z.string(), z.unknown()).nullable()
});

export const xmlImportResolutionSchema = z.object({
  clientPartnerId: z.string().uuid().nullable().optional(),
  ownLegalEntityId: z.string().uuid().nullable().optional(),
  operationType: operationTypeSchema.nullable().optional(),
  operationScope: operationScopeSchema.exclude(["ALL"]).nullable().optional(),
  productId: z.string().uuid().nullable().optional(),
  createOperations: z.boolean().optional(),
  manualSacks: decimalTextSchema.nullable().optional(),
  manualRateValueCents: z.number().int().min(0).nullable().optional(),
  manualOverrideReason: nullableText.optional(),
  // Nota triangulada: segundo parceiro (papel oposto ao de clientPartnerId)
  // pra revisao manual quando a nota nao foi reconhecida automaticamente.
  secondaryPartnerId: z.string().uuid().nullable().optional(),
  ignore: z.boolean().optional()
});

export const productAliasInputSchema = z.object({
  organizationId: z.string().uuid(),
  productId: z.string().uuid(),
  issuerPartnerLegalEntityId: z.string().uuid().nullable(),
  sourceProductCode: nullableText,
  sourceDescription: z.string().trim().min(1),
  ncm: nullableText,
  isActive: z.boolean()
});

export const operationClassificationRuleInputSchema = z.object({
  organizationId: z.string().uuid(),
  ownLegalEntityId: z.string().uuid().nullable(),
  issuerPartnerLegalEntityId: z.string().uuid().nullable(),
  recipientPartnerLegalEntityId: z.string().uuid().nullable(),
  destinationPartnerId: z.string().uuid().nullable(),
  productId: z.string().uuid().nullable(),
  clientPartnerId: z.string().uuid(),
  commercialFlow: operationTypeSchema.nullable(),
  operationScope: operationScopeSchema.exclude(["ALL"]),
  priority: z.number().int().min(0),
  isActive: z.boolean()
});

export const operationBillingStatusSchema = z.enum(["UNBILLED", "RESERVED", "BILLED"]);
export const clientChargeStatusSchema = z.enum(["DRAFT", "PENDING_REVIEW", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED", "REPLACED"]);
export const ledgerEntryTypeSchema = z.enum(["SERVICE_CHARGE", "ADVANCE_RECEIVED", "PAYMENT_RECEIVED", "DISCOUNT", "CREDIT", "SURCHARGE", "REIMBURSEMENT", "PREVIOUS_BALANCE", "MANUAL_ADJUSTMENT", "REVERSAL", "OTHER"]);
export const ledgerEffectSchema = z.enum(["INCREASE_RECEIVABLE", "REDUCE_RECEIVABLE"]);
export const chargeAdjustmentTypeSchema = z.enum(["ADVANCE", "CREDIT", "DISCOUNT", "SURCHARGE", "REIMBURSEMENT", "PREVIOUS_BALANCE", "MANUAL_ADJUSTMENT", "OTHER"]);
export const paymentMethodSchema = z.enum(["PIX", "BANK_TRANSFER", "CASH", "CHECK", "OFFSET", "OTHER"]);

export const suggestChargePeriodsInputSchema = z.object({
  organizationId: z.string().uuid(),
  clientPartnerId: z.string().uuid(),
  ownLegalEntityId: z.string().uuid().nullable().optional(),
  periodicity: billingPeriodicitySchema.optional(),
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export const eligibleOperationsInputSchema = z.object({
  organizationId: z.string().uuid(),
  ownLegalEntityId: z.string().uuid().nullable().optional(),
  clientPartnerId: z.string().uuid(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  includeAllCompanies: z.boolean().optional()
});

export const partnerRateSummaryInputSchema = z.object({
  organizationId: z.string().uuid(),
  ownLegalEntityId: z.string().uuid().nullable().optional(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  includeAlreadyBilled: z.boolean().optional(),
  includeAllCompanies: z.boolean().optional()
});

export const eligiblePurchaseOperationsInputSchema = z.object({
  organizationId: z.string().uuid(),
  ownLegalEntityId: z.string().uuid().nullable().optional(),
  supplierPartnerId: z.string().uuid(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  includeAllCompanies: z.boolean().optional()
});

export const supplierPurchaseSummaryInputSchema = z.object({
  organizationId: z.string().uuid(),
  ownLegalEntityId: z.string().uuid().nullable().optional(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  includeAlreadySettled: z.boolean().optional(),
  includeAllCompanies: z.boolean().optional()
});

export const generatePurchaseSettlementInputSchema = z.object({
  organizationId: z.string().uuid(),
  ownLegalEntityId: z.string().uuid(),
  supplierPartnerId: z.string().uuid(),
  operationIds: z.array(z.string().uuid()).min(1),
  categoryId: z.string().uuid(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: nullableText
});

export const clientChargeDraftInputSchema = z.object({
  organizationId: z.string().uuid(),
  ownLegalEntityId: z.string().uuid(),
  clientPartnerId: z.string().uuid(),
  billingProfileId: z.string().uuid().nullable(),
  periodicity: billingPeriodicitySchema,
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  notes: nullableText,
  internalNotes: nullableText,
  operationIds: z.array(z.string().uuid())
});

export const clientChargeAdjustmentInputSchema = z.object({
  clientChargeId: z.string().uuid(),
  ledgerEntryId: z.string().uuid().nullable(),
  adjustmentType: chargeAdjustmentTypeSchema,
  effect: ledgerEffectSchema,
  description: z.string().trim().min(1),
  amountCents: z.number().int().positive(),
  sortOrder: z.number().int().min(0),
  reason: nullableText.optional()
});

export const clientLedgerEntryInputSchema = z.object({
  organizationId: z.string().uuid(),
  ownLegalEntityId: z.string().uuid(),
  clientPartnerId: z.string().uuid(),
  clientChargeId: z.string().uuid().nullable(),
  entryType: ledgerEntryTypeSchema,
  effect: ledgerEffectSchema,
  amountCents: z.number().int().positive(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().min(1),
  referenceNumber: nullableText,
  notes: nullableText,
  attachmentPath: nullableText,
  availableAmountCents: z.number().int().min(0).nullable(),
  // Por padrao um lancamento ja entra confirmado (conta no saldo na hora).
  // Um adiantamento/emprestimo pode ser criado como DRAFT quando o dono
  // desmarca "ja abater do saldo agora" -- fica registrado no historico mas
  // so' passa a contar no saldo quando for confirmado depois.
  status: z.enum(["DRAFT", "CONFIRMED"]).optional().default("CONFIRMED")
});

export const creditAllocationInputSchema = z.object({
  ledgerEntryId: z.string().uuid(),
  clientChargeId: z.string().uuid(),
  amountCents: z.number().int().positive()
});

export const clientPaymentInputSchema = z.object({
  organizationId: z.string().uuid(),
  ownLegalEntityId: z.string().uuid(),
  clientPartnerId: z.string().uuid(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCents: z.number().int().positive(),
  paymentMethod: paymentMethodSchema,
  bankAccountDescription: nullableText,
  transactionReference: nullableText,
  notes: nullableText,
  attachmentPath: nullableText
});

export const paymentAllocationInputSchema = z.object({
  clientPaymentId: z.string().uuid(),
  clientChargeId: z.string().uuid(),
  amountCents: z.number().int().positive()
});

export const expenseNatureSchema = z.enum(["FIXED", "VARIABLE", "TAX", "PERSONNEL", "FINANCIAL", "INVESTMENT", "OTHER"]);
export const financialAccountTypeSchema = z.enum(["BANK_ACCOUNT", "CASH", "DIGITAL_WALLET", "OTHER"]);
export const accountPayableSourceSchema = z.enum(["MANUAL", "RECURRING", "INSTALLMENT", "IMPORT"]);
export const payableAmountStatusSchema = z.enum(["PENDING", "ESTIMATED", "CONFIRMED"]);
export const accountPayableStatusSchema = z.enum(["DRAFT", "SCHEDULED", "OPEN", "PARTIALLY_PAID", "PAID", "OVERDUE", "CONTESTED", "CANCELLED"]);
export const recurringAmountModeSchema = z.enum(["FIXED", "VARIABLE"]);
export const payableFrequencySchema = z.enum(["MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "CUSTOM"]);
export const installmentIntervalTypeSchema = z.enum(["MONTHLY", "DAYS_30", "CUSTOM"]);
export const payablePaymentMethodSchema = z.enum(["PIX", "BANK_TRANSFER", "BOLETO", "CASH", "CHECK", "CARD", "DIRECT_DEBIT", "OFFSET", "OTHER"]);

const payableDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nonNegativeCents = z.number().int().min(0);

export const expenseCategoryInputSchema = z.object({
  organizationId: z.string().uuid(),
  parentCategoryId: z.string().uuid().nullable(),
  name: z.string().trim().min(1),
  code: nullableText,
  expenseNature: expenseNatureSchema,
  description: nullableText,
  isActive: z.boolean()
});

export const costCenterInputSchema = z.object({
  organizationId: z.string().uuid(),
  ownLegalEntityId: z.string().uuid().nullable(),
  locationId: z.string().uuid().nullable(),
  parentCostCenterId: z.string().uuid().nullable(),
  name: z.string().trim().min(1),
  code: nullableText,
  description: nullableText,
  isActive: z.boolean()
});

export const financialAccountInputSchema = z.object({
  organizationId: z.string().uuid(),
  ownLegalEntityId: z.string().uuid(),
  name: z.string().trim().min(1),
  accountType: financialAccountTypeSchema,
  bankName: nullableText,
  branch: nullableText,
  accountIdentifierMasked: nullableText,
  pixKeyDescription: nullableText,
  notes: nullableText,
  isActive: z.boolean()
});

export const accountPayableInputSchema = z.object({
  organizationId: z.string().uuid(),
  ownLegalEntityId: z.string().uuid(),
  supplierPartnerId: z.string().uuid().nullable(),
  supplierLegalEntityId: z.string().uuid().nullable(),
  payeeNameSnapshot: z.string().trim().min(1),
  payeeTaxIdSnapshot: nullableText,
  categoryId: z.string().uuid(),
  defaultCostCenterId: z.string().uuid().nullable(),
  defaultLocationId: z.string().uuid().nullable(),
  source: accountPayableSourceSchema.default("MANUAL"),
  description: z.string().trim().min(1),
  documentType: nullableText,
  documentNumber: nullableText,
  competenceDate: payableDate,
  issueDate: payableDate.nullable(),
  dueDate: payableDate,
  originalAmountCents: nonNegativeCents.nullable(),
  discountCents: nonNegativeCents,
  interestCents: nonNegativeCents,
  penaltyCents: nonNegativeCents,
  otherAdditionsCents: nonNegativeCents,
  amountStatus: payableAmountStatusSchema,
  notes: nullableText,
  internalNotes: nullableText
});

export const accountPayableAllocationInputSchema = z.object({
  accountPayableId: z.string().uuid(),
  costCenterId: z.string().uuid().nullable(),
  locationId: z.string().uuid().nullable(),
  allocationAmountCents: nonNegativeCents,
  allocationBasisPoints: z.number().int().min(0).max(10000).nullable(),
  description: nullableText
});

export const payableRecurringTemplateInputSchema = z.object({
  organizationId: z.string().uuid(),
  ownLegalEntityId: z.string().uuid(),
  supplierPartnerId: z.string().uuid().nullable(),
  supplierLegalEntityId: z.string().uuid().nullable(),
  payeeNameSnapshot: z.string().trim().min(1),
  categoryId: z.string().uuid(),
  defaultCostCenterId: z.string().uuid().nullable(),
  defaultLocationId: z.string().uuid().nullable(),
  description: z.string().trim().min(1),
  amountMode: recurringAmountModeSchema,
  fixedAmountCents: nonNegativeCents.nullable(),
  estimatedAmountCents: nonNegativeCents.nullable(),
  frequency: payableFrequencySchema,
  dueDay: z.number().int().min(1).max(31),
  generationLeadDays: z.number().int().min(0).max(370),
  startDate: payableDate,
  endDate: payableDate.nullable(),
  autoGenerateOnOpen: z.boolean(),
  isActive: z.boolean()
});

export const payableInstallmentGroupInputSchema = z.object({
  organizationId: z.string().uuid(),
  ownLegalEntityId: z.string().uuid(),
  supplierPartnerId: z.string().uuid().nullable(),
  supplierLegalEntityId: z.string().uuid().nullable(),
  payeeNameSnapshot: z.string().trim().min(1),
  categoryId: z.string().uuid(),
  defaultCostCenterId: z.string().uuid().nullable(),
  defaultLocationId: z.string().uuid().nullable(),
  description: z.string().trim().min(1),
  totalAmountCents: z.number().int().positive(),
  installmentCount: z.number().int().positive().max(120),
  firstDueDate: payableDate,
  intervalType: installmentIntervalTypeSchema
});

export const payablePaymentInputSchema = z.object({
  organizationId: z.string().uuid(),
  ownLegalEntityId: z.string().uuid(),
  financialAccountId: z.string().uuid().nullable(),
  paymentDate: payableDate,
  amountCents: z.number().int().positive(),
  paymentMethod: payablePaymentMethodSchema,
  transactionReference: nullableText,
  payeeNameSnapshot: z.string().trim().min(1),
  notes: nullableText,
  attachmentPath: nullableText,
  attachmentHash: nullableText
});

export const payablePaymentAllocationInputSchema = z.object({
  payablePaymentId: z.string().uuid(),
  accountPayableId: z.string().uuid(),
  amountCents: z.number().int().positive()
});

export const payableAttachmentTypeSchema = z.enum(["INVOICE", "BILL", "CONTRACT", "RECEIPT", "SUPPORTING_DOCUMENT", "OTHER"]);
export const financialReportTypeSchema = z.enum(["ACCOUNTS_PAYABLE", "OVERDUE_PAYABLES", "PAYMENTS", "BY_LEGAL_ENTITY", "BY_LOCATION", "BY_COST_CENTER", "BY_CATEGORY", "BY_SUPPLIER", "FIXED_VARIABLE", "RECURRING", "INSTALLMENTS", "PROJECTED_CASH_FLOW"]);
export const financialReportFormatSchema = z.enum(["PDF", "EXCEL"]);

export const addPayableAttachmentInputSchema = z.object({
  token: z.string().uuid().optional(),
  sourcePath: z.string().min(1).optional(),
  accountPayableId: z.string().uuid(),
  attachmentType: payableAttachmentTypeSchema,
  description: nullableText
}).refine((data) => Boolean(data.token || data.sourcePath), "Informe token ou caminho de origem.");

export const addPayablePaymentAttachmentInputSchema = z.object({
  token: z.string().uuid().optional(),
  sourcePath: z.string().min(1).optional(),
  payablePaymentId: z.string().uuid(),
  attachmentType: payableAttachmentTypeSchema,
  description: nullableText
}).refine((data) => Boolean(data.token || data.sourcePath), "Informe token ou caminho de origem.");

export const financialReportFiltersSchema = z.object({
  organizationId: z.string().uuid(),
  ownLegalEntityId: z.string().uuid().nullable(),
  dateStart: payableDate.nullable(),
  dateEnd: payableDate.nullable(),
  categoryId: z.string().uuid().nullable(),
  locationId: z.string().uuid().nullable(),
  costCenterId: z.string().uuid().nullable(),
  supplierPartnerId: z.string().uuid().nullable(),
  status: nullableText
});

export const financialReportInputSchema = z.object({
  reportType: financialReportTypeSchema,
  format: financialReportFormatSchema,
  filters: financialReportFiltersSchema
});

export const dealConfirmationStatusSchema = z.enum(["DRAFT", "PENDING_REVIEW", "ISSUED", "SENT_FOR_SIGNATURE", "SIGNED", "CANCELLED", "REPLACED"]);
export const dealSignatureStatusSchema = z.enum(["NOT_APPLICABLE", "NOT_SENT", "WAITING_SIGNATURE", "PARTIALLY_SIGNED", "SIGNED", "REJECTED"]);
export const dealPartyRoleSchema = z.enum(["ISSUER", "BROKER", "SELLER", "BUYER", "DELIVERY_RECIPIENT", "OTHER"]);
export const dealSignerRoleSchema = z.enum(["ISSUER", "BROKER", "SELLER", "BUYER", "WITNESS", "OTHER"]);
export const dealSignerStatusSchema = z.enum(["PENDING", "SIGNED_EXTERNALLY", "REJECTED", "NOT_REQUIRED"]);
export const dealTemplateLayoutModeSchema = z.enum(["STANDARD", "COMPACT", "DETAILED"]);
export const dealClauseCategorySchema = z.enum(["PAYMENT", "DELIVERY", "QUALITY", "RESPONSIBILITY", "CANCELLATION", "GENERAL", "OTHER"]);
export const dealDocumentTypeSchema = z.enum(["GENERATED_DRAFT", "ISSUED_ORIGINAL", "SIGNED_EXTERNAL", "SUPPORTING_DOCUMENT", "CANCELLED_COPY", "REPLACEMENT_COPY"]);
export const confirmationReportTypeSchema = z.enum(["CONFIRMATIONS_PERIOD", "BY_SELLER", "BY_BUYER", "BY_PRODUCT", "BY_STATUS", "BY_SIGNATURE", "WITHOUT_FISCAL_DOCUMENT", "WITHOUT_OPERATION"]);
export const confirmationReportFormatSchema = z.enum(["PDF", "EXCEL"]);

const positiveDecimalTextSchema = decimalTextSchema.refine((value) => BigInt(value.split(".")[0]) > 0n || !/^0(?:\.0{1,6})?$/.test(value), "Decimal deve ser maior que zero.");

const dealConfirmationDraftInputBaseSchema = z.object({
  organizationId: z.string().uuid(),
  ownLegalEntityId: z.string().uuid(),
  templateId: z.string().uuid().nullable().optional(),
  confirmationDate: payableDate,
  negotiationDate: payableDate.nullable().optional(),
  deliveryLocationSnapshot: nullableText.optional(),
  deliveryStartDate: payableDate.nullable().optional(),
  deliveryEndDate: payableDate.nullable().optional(),
  paymentTermsSnapshot: nullableText.optional(),
  qualityTermsSnapshot: nullableText.optional(),
  generalTermsSnapshot: nullableText.optional(),
  publicNotes: nullableText.optional(),
  internalNotes: nullableText.optional(),
  brokeragePercentageBasisPoints: z.number().int().min(0).max(100_00).nullable().optional(),
  bankName: nullableText.optional(),
  bankCode: nullableText.optional(),
  bankAgency: nullableText.optional(),
  bankAccount: nullableText.optional(),
  bankAccountType: nullableText.optional(),
  bankHolderName: nullableText.optional(),
  bankHolderDocument: nullableText.optional(),
  pixKey: nullableText.optional(),
  pixKeyType: nullableText.optional()
});

export const dealConfirmationDraftInputSchema = dealConfirmationDraftInputBaseSchema.refine((data) => !data.deliveryStartDate || !data.deliveryEndDate || data.deliveryEndDate >= data.deliveryStartDate, "Periodo de entrega invalido.");

export const dealConfirmationUpdateSchema = dealConfirmationDraftInputBaseSchema.omit({ organizationId: true, ownLegalEntityId: true }).partial();

export const dealConfirmationPartyInputSchema = z.object({
  dealConfirmationId: z.string().uuid(),
  partyRole: dealPartyRoleSchema,
  businessPartnerId: z.string().uuid().nullable().optional(),
  partnerLegalEntityId: z.string().uuid().nullable().optional(),
  ownLegalEntityId: z.string().uuid().nullable().optional(),
  manualName: nullableText.optional(),
  representativeName: nullableText.optional(),
  sortOrder: z.number().int().min(0).default(0)
}).refine((data) => Boolean(data.ownLegalEntityId || data.businessPartnerId || data.manualName), "Informe cadastro ou participante manual.");

export const dealConfirmationItemInputSchema = z.object({
  dealConfirmationId: z.string().uuid(),
  sortOrder: z.number().int().min(0),
  productId: z.string().uuid().nullable(),
  productNameSnapshot: z.string().trim().min(1),
  productDescriptionSnapshot: nullableText,
  cropSnapshot: nullableText,
  qualitySnapshot: nullableText,
  packagingSnapshot: nullableText,
  originSnapshot: nullableText,
  destinationSnapshot: nullableText,
  quantitySacksDecimal: positiveDecimalTextSchema,
  sackWeightKgDecimal: positiveDecimalTextSchema,
  unitPriceDecimal: decimalTextSchema,
  totalAmountCents: z.number().int().min(0).nullable().optional(),
  totalOverrideReason: nullableText.optional(),
  deliveryStartDate: payableDate.nullable(),
  deliveryEndDate: payableDate.nullable(),
  deliveryLocationSnapshot: nullableText,
  notes: nullableText
}).refine((data) => !data.totalAmountCents || data.totalOverrideReason, "Override de total exige justificativa.");

export const dealConfirmationTemplateInputSchema = z.object({
  organizationId: z.string().uuid(),
  ownLegalEntityId: z.string().uuid().nullable(),
  name: z.string().trim().min(1),
  description: nullableText,
  title: z.string().trim().min(1),
  subtitle: nullableText,
  layoutMode: dealTemplateLayoutModeSchema,
  defaultPaymentTerms: nullableText,
  defaultDeliveryTerms: nullableText,
  defaultQualityTerms: nullableText,
  defaultGeneralTerms: nullableText,
  showBroker: z.boolean(),
  showCommercialValues: z.boolean(),
  showItemOrigins: z.boolean(),
  showSignatureBlocks: z.boolean(),
  signatureBlockCount: z.number().int().min(0).max(8),
  isDefault: z.boolean(),
  isActive: z.boolean()
});

export const dealClauseTemplateInputSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(1),
  title: nullableText,
  clauseText: z.string().trim().min(1).max(8000),
  category: dealClauseCategorySchema,
  isActive: z.boolean()
});

export const dealConfirmationClauseInputSchema = z.object({
  dealConfirmationId: z.string().uuid(),
  clauseNumber: nullableText,
  title: nullableText,
  clauseText: z.string().trim().min(1).max(8000),
  sortOrder: z.number().int().min(0),
  isVisible: z.boolean()
});

export const dealPaymentTermInputSchema = z.object({
  dealConfirmationId: z.string().uuid(),
  sortOrder: z.number().int().min(0),
  description: z.string().trim().min(1),
  percentageBasisPoints: z.number().int().min(0).max(10000).nullable(),
  amountCents: z.number().int().min(0).nullable(),
  dueDate: payableDate.nullable(),
  daysAfterEvent: z.number().int().min(0).nullable(),
  eventReference: nullableText
});

export const dealConfirmationSignerInputSchema = z.object({
  dealConfirmationId: z.string().uuid(),
  partyRole: dealSignerRoleSchema,
  name: z.string().trim().min(1),
  documentNumber: nullableText,
  positionTitle: nullableText,
  email: z.string().trim().email().nullable(),
  phone: nullableText,
  signatureOrder: z.number().int().min(0),
  signatureStatus: dealSignerStatusSchema,
  signedAt: z.string().datetime().nullable().optional(),
  notes: nullableText
});

export const dealConfirmationListFiltersSchema = z.object({
  organizationId: z.string().uuid().optional(),
  ownLegalEntityId: z.string().uuid().optional(),
  search: z.string().optional(),
  status: dealConfirmationStatusSchema.or(z.literal("all")).optional(),
  signatureStatus: dealSignatureStatusSchema.or(z.literal("all")).optional(),
  productId: z.string().uuid().optional(),
  withFiscalDocument: z.boolean().optional(),
  withOperation: z.boolean().optional(),
  dateStart: payableDate.optional(),
  dateEnd: payableDate.optional()
});

export const dealConfirmationSourceInputSchema = z.object({
  organizationId: z.string().uuid(),
  ownLegalEntityId: z.string().uuid(),
  operationIds: z.array(z.string().uuid()).default([]),
  fiscalDocumentIds: z.array(z.string().uuid()).default([])
});

export const signedDealDocumentInputSchema = z.object({
  token: z.string().uuid().optional(),
  sourcePath: z.string().min(1).optional(),
  notes: nullableText.optional()
}).refine((data) => Boolean(data.token || data.sourcePath), "Informe token ou caminho do PDF assinado.");

export const confirmationReportFiltersSchema = z.object({
  organizationId: z.string().uuid(),
  ownLegalEntityId: z.string().uuid().nullable(),
  dateStart: payableDate.nullable(),
  dateEnd: payableDate.nullable(),
  sellerPartnerId: z.string().uuid().nullable(),
  buyerPartnerId: z.string().uuid().nullable(),
  productId: z.string().uuid().nullable(),
  status: nullableText,
  signatureStatus: nullableText
});

export const confirmationReportInputSchema = z.object({
  reportType: confirmationReportTypeSchema,
  format: confirmationReportFormatSchema,
  filters: confirmationReportFiltersSchema
});
