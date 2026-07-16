import { z } from "zod";

export const appVariantSchema = z.enum(["villa", "grao", "multiempresa"]);
export const themeModeSchema = z.enum(["light", "dark"]);
export const locationTypeSchema = z.enum(["OFFICE", "BRANCH", "WAREHOUSE", "PROPERTY", "STORAGE", "OTHER"]);
export const userRoleSchema = z.enum(["ADMIN", "OPERATOR", "VIEWER"]);

const isoDateSchema = z.string().datetime();
const nullableText = z.string().trim().min(1).nullable();

export const organizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).regex(/^[a-z0-9-]+$/),
  displayName: z.string().trim().min(1),
  appDisplayName: z.string().trim().min(1),
  logoPath: z.string().trim().min(1).nullable(),
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
  state: z.string().trim().length(2),
  postalCode: z.string().regex(/^\d{8}$/),
  documentPrefix: nullableText,
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
  state: z.string().trim().length(2).nullable(),
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
