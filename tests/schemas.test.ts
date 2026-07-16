import { describe, expect, it } from "vitest";
import { legalEntitySchema, locationSchema, organizationSchema } from "../src/shared/schemas/domainSchemas";

const now = new Date().toISOString();

describe("domain schemas", () => {
  it("validates Organization", () => {
    expect(
      organizationSchema.parse({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "Demo",
        slug: "demo",
        displayName: "Demo",
        appDisplayName: "Demo Operacoes",
        logoPath: null,
        compactLogoPath: null,
        iconPath: null,
        primaryColor: "#111111",
        secondaryColor: "#222222",
        accentColor: "#333333",
        themeMode: "light",
        isActive: true,
        createdAt: now,
        updatedAt: now
      }).slug
    ).toBe("demo");
  });

  it("validates LegalEntity with unformatted CNPJ", () => {
    const entity = legalEntitySchema.parse({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      legalName: "Empresa Demo",
      tradeName: "Demo MG",
      cnpj: "00000000000000",
      stateRegistration: null,
      municipalRegistration: null,
      email: null,
      phone: null,
      addressLine: "Pendente",
      addressNumber: "S/N",
      addressComplement: null,
      district: "Pendente",
      city: "Pendente",
      state: "MG",
      postalCode: "00000000",
      documentPrefix: null,
      isDraft: false,
      isActive: true,
      createdAt: now,
      updatedAt: now
    });
    expect(entity.cnpj).toBe("00000000000000");
  });

  it("validates Location types", () => {
    const location = locationSchema.parse({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      legalEntityId: null,
      name: "Armazem",
      type: "WAREHOUSE",
      description: null,
      addressLine: null,
      addressNumber: null,
      addressComplement: null,
      district: null,
      city: null,
      state: null,
      postalCode: null,
      isActive: true,
      createdAt: now,
      updatedAt: now
    });
    expect(location.type).toBe("WAREHOUSE");
  });
});
