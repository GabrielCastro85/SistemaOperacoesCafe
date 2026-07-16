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
  isActive: z.boolean()
});

export const partnerLegalEntityInputSchema = z
  .object({
    businessPartnerId: z.string().uuid(),
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
  .refine((value) => value.isDraft || value.cnpj !== null, "CNPJ valido e obrigatorio para cadastro ativo.");

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
  productId: z.string().uuid().nullable(),
  operationScope: operationScopeSchema.exclude(["ALL"]),
  operationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});
