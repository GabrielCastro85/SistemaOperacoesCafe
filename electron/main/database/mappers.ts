import type { InstallationProfile, LegalEntity, Location, Organization } from "../../../src/shared/types/domain.js";

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
