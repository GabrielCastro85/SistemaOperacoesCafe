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
  signedDir: string;
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
