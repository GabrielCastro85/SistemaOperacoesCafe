import { getBrandingConfig } from "../../../shared/branding/branding";
import type { AppVariant, LegalEntity, Location, Organization } from "../../../shared/types/domain";

export const locationLabels: Record<Location["type"], string> = {
  OFFICE: "Escritorio",
  BRANCH: "Filial",
  WAREHOUSE: "Armazem",
  PROPERTY: "Imovel",
  STORAGE: "Deposito",
  OTHER: "Outro"
};

export const blankOrg = (variant: AppVariant): Omit<Organization, "id" | "createdAt" | "updatedAt"> => {
  const branding = getBrandingConfig(variant);
  return { name: "", slug: "", displayName: "", appDisplayName: "", description: null, logoPath: null, compactLogoPath: null, iconPath: null, primaryColor: branding.colors.primary, secondaryColor: branding.colors.secondary, accentColor: branding.colors.accent, themeMode: "light", isActive: true };
};

export const blankEntity = (organizationId: string): Omit<LegalEntity, "id" | "createdAt" | "updatedAt"> => ({ organizationId, legalName: "", tradeName: "", cnpj: null, stateRegistration: null, municipalRegistration: null, email: null, phone: null, addressLine: "Endereco pendente", addressNumber: "S/N", addressComplement: null, district: "Pendente", city: "Pendente", state: "MG", postalCode: "00000000", documentPrefix: null, isDraft: false, isActive: true });

export const blankLocation = (organizationId: string): Omit<Location, "id" | "createdAt" | "updatedAt"> => ({ organizationId, legalEntityId: null, name: "", type: "OFFICE", description: null, addressLine: null, addressNumber: null, addressComplement: null, district: null, city: null, state: null, postalCode: null, isActive: true });
