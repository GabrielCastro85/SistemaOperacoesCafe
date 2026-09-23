import type { LegalEntityLite, OrganizationLite } from "./types";

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function selectDefaultOrganization(organizations: OrganizationLite[]): OrganizationLite | undefined {
  return organizations.find((organization) => {
    const identity = normalize(`${organization.slug} ${organization.displayName} ${organization.appDisplayName}`);
    return identity.includes("grao");
  }) ?? organizations[0];
}

export function selectDefaultLegalEntity(
  legalEntities: LegalEntityLite[],
  organizationId: string
): LegalEntityLite | undefined {
  const candidates = legalEntities.filter((entity) => entity.organizationId === organizationId);
  return candidates.find((entity) => {
    const name = normalize(entity.tradeName);
    return name.includes("grao") && (name.includes(" mg") || normalize(entity.state) === "mg");
  })
    ?? candidates.find((entity) => normalize(entity.state) === "mg")
    ?? candidates[0];
}
