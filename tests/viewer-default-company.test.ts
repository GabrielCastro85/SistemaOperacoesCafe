import { describe, expect, it } from "vitest";
import { selectDefaultLegalEntity, selectDefaultOrganization } from "../mobile-viewer/src/defaultCompany";
import type { LegalEntityLite, OrganizationLite } from "../mobile-viewer/src/types";

const organizations: OrganizationLite[] = [
  { id: "villa", slug: "villa", displayName: "Villa Coffee", appDisplayName: "Villa", logoPath: null, primaryColor: "", secondaryColor: "", accentColor: "" },
  { id: "grao", slug: "grao-e-grao", displayName: "Grão & Grão", appDisplayName: "Grão & Grão Operações", logoPath: null, primaryColor: "", secondaryColor: "", accentColor: "" }
];

const legalEntities: LegalEntityLite[] = [
  { id: "grao-sp", organizationId: "grao", tradeName: "Grão & Grão SP", cnpj: null, state: "SP" },
  { id: "villa-mg", organizationId: "villa", tradeName: "Villa MG", cnpj: null, state: "MG" },
  { id: "grao-mg", organizationId: "grao", tradeName: "Grão & Grão MG", cnpj: null, state: "MG" }
];

describe("empresa inicial do site", () => {
  it("abre a organização Grão na empresa de Minas Gerais", () => {
    const organization = selectDefaultOrganization(organizations);
    expect(organization?.id).toBe("grao");
    expect(selectDefaultLegalEntity(legalEntities, organization?.id ?? "")?.id).toBe("grao-mg");
  });

  it("usa a primeira empresa acessível quando Grão MG não está disponível", () => {
    expect(selectDefaultOrganization([organizations[0]])?.id).toBe("villa");
    expect(selectDefaultLegalEntity(legalEntities, "villa")?.id).toBe("villa-mg");
  });
});
