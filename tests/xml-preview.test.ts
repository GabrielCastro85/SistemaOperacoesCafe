import { describe, expect, it } from "vitest";
import { classifyWarehouseXml, parseNfeExtractedPreview, resolveOwnAndCounterparty, sortXmlQueueByCompanyAndNumber } from "../src/renderer/pages/operations/xmlPreview";
import type { LegalEntity } from "../src/shared/types/domain";

function legalEntity(overrides: Partial<LegalEntity>): LegalEntity {
  return {
    id: "id",
    organizationId: "org",
    legalName: "Empresa",
    tradeName: "Empresa",
    cnpj: "11111111111111",
    stateRegistration: null,
    municipalRegistration: null,
    email: null,
    phone: null,
    addressLine: "Rua Exemplo",
    addressNumber: "1",
    addressComplement: null,
    district: "Centro",
    city: "Cidade",
    state: "MG",
    postalCode: "00000000",
    documentPrefix: null,
    defaultBankName: null,
    defaultBankCode: null,
    defaultBankAgency: null,
    defaultBankAccount: null,
    defaultBankAccountType: null,
    defaultBankHolderName: null,
    defaultBankHolderDocument: null,
    defaultPixKey: null,
    defaultPixKeyType: null,
    defaultPaymentTerms: null,
    defaultDeliveryTerms: null,
    defaultConfirmationNotes: null,
    isDraft: false,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

describe("resolveOwnAndCounterparty", () => {
  it("does not treat a previously auto-created third-party (TERC-XML) legal entity as one of the own companies", () => {
    const thirdParty = legalEntity({ id: "third", cnpj: "22222222222222", legalName: "CEREAIS MINEIRA LTDA", documentPrefix: "TERC-XML" });
    const own = legalEntity({ id: "own", cnpj: "33333333333333", legalName: "Villa Coffee Minas Gerais" });
    const result = resolveOwnAndCounterparty(
      {
        accessKey: null,
        model: null,
        series: null,
        number: null,
        nature: null,
        issuedAt: null,
        issuer: { legalName: "CEREAIS MINEIRA LTDA", tradeName: null, cnpjCpf: "22222222222222", state: "MG" },
        recipient: { legalName: "MINASFE COM. IMPORTACAO E EXPORTACAO LTDA", tradeName: null, cnpjCpf: "44444444444444", state: "MG" },
        transportCarrierName: null,
        items: [],
        productsAmountCents: null
      },
      [thirdParty, own]
    );
    expect(result.isThirdPartyOrigin).toBe(true);
    expect(result.ownEntityLabel).toBeNull();
    expect(result.originLabel).toBe("CEREAIS MINEIRA LTDA");
  });

  it("still recognizes a genuine own legal entity as the origin", () => {
    const own = legalEntity({ id: "own", cnpj: "33333333333333", legalName: "Villa Coffee Minas Gerais" });
    const result = resolveOwnAndCounterparty(
      {
        accessKey: null,
        model: null,
        series: null,
        number: null,
        nature: null,
        issuedAt: null,
        issuer: { legalName: "Villa Coffee Minas Gerais", tradeName: null, cnpjCpf: "33333333333333", state: "MG" },
        recipient: { legalName: "Cliente Externo", tradeName: null, cnpjCpf: "55555555555555", state: "MG" },
        transportCarrierName: null,
        items: [],
        productsAmountCents: null
      },
      [own]
    );
    expect(result.isThirdPartyOrigin).toBe(false);
    expect(result.ownEntityLabel).toBe("Villa Coffee Minas Gerais");
  });
});

describe("classifyWarehouseXml", () => {
  it("recognizes a physical warehouse return without requiring a commercial supplier", () => {
    const preview = parseNfeExtractedPreview({
      nature: "RETORNO DE MERCADORIA DEPOSITADA EM ARMAZEM GERAL",
      items: [{ cfop: "5906", description: "CAFE", commercialQuantity: "500", commercialUnit: "SC" }]
    });
    expect(classifyWarehouseXml(preview)).toEqual({
      movementType: "RETURN",
      movementKind: "PHYSICAL",
      cfops: ["5906"]
    });
  });

  it("does not classify an ordinary purchase as a warehouse movement", () => {
    const preview = parseNfeExtractedPreview({
      items: [{ cfop: "5102", description: "CAFE", commercialQuantity: "500", commercialUnit: "SC" }]
    });
    expect(classifyWarehouseXml(preview)).toBeNull();
  });
});

describe("ordem da fila de XMLs", () => {
  const entities = [
    legalEntity({ id: "grao-sp", tradeName: "Grão & Grão SP", legalName: "GRAO E GRAO", cnpj: "40000000000004", state: "SP" }),
    legalEntity({ id: "villa-es", tradeName: "Villa Coffee ES", legalName: "VILLA COFFEE", cnpj: "20000000000002", state: "ES" }),
    legalEntity({ id: "grao-mg", tradeName: "Grão & Grão MG", legalName: "GRAO E GRAO", cnpj: "30000000000003", state: "MG" }),
    legalEntity({ id: "villa-mg", tradeName: "Villa Coffee MG", legalName: "VILLA COFFEE", cnpj: "10000000000001", state: "MG" })
  ];
  const file = (name: string, issuer: string, number: string, status = "VALID") => ({
    status,
    originalFileName: name,
    extractedData: { number, issuer: { cnpjCpf: issuer }, recipient: { cnpjCpf: "99999999000199" } }
  });

  it("separa por empresa (Villa MG, ES, Grao MG, SP) e ordena o numero crescente", () => {
    const sorted = sortXmlQueueByCompanyAndNumber([
      file("a", "40000000000004", "5"),
      file("b", "10000000000001", "2448"),
      file("c", "20000000000002", "964"),
      file("d", "10000000000001", "2447"),
      file("e", "30000000000003", "12"),
      file("f", "20000000000002", "963"),
      file("g", "88888888000188", "1"),
      file("h", "10000000000001", "", "ERROR")
    ], entities);
    expect(sorted.map((item) => item.originalFileName)).toEqual(["d", "b", "f", "c", "e", "a", "g", "h"]);
  });
});
