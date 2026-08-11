import { describe, expect, it } from "vitest";
import { resolveOwnAndCounterparty } from "../src/renderer/pages/operations/xmlPreview";
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
