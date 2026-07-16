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
