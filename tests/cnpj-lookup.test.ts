import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupCnpj } from "../electron/main/services/cnpjLookupService";

describe("cnpj lookup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes BrasilAPI company data for partner registration", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        cnpj: "12.345.678/0001-90",
        razao_social: "DIAMANTE EXPORTACAO E IMPORTACAO LTDA",
        nome_fantasia: "DIAMANTE",
        descricao_situacao_cadastral: "ATIVA",
        email: "contato@diamante.com.br",
        ddd_telefone_1: "3533334444",
        logradouro: "AVENIDA CENTRAL",
        numero: "100",
        complemento: "SALA 2",
        bairro: "CENTRO",
        municipio: "VARGINHA",
        uf: "MG",
        cep: "37000-000"
      })
    }));

    const result = await lookupCnpj("12.345.678/0001-90");

    expect(result).toMatchObject({
      cnpj: "12345678000190",
      legalName: "DIAMANTE EXPORTACAO E IMPORTACAO LTDA",
      tradeName: "DIAMANTE",
      city: "VARGINHA",
      state: "MG",
      postalCode: "37000000",
      source: "BRASIL_API"
    });
  });

  it("rejects invalid CNPJ before calling the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(lookupCnpj("123")).rejects.toThrow("14 digitos");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses ReceitaWS when BrasilAPI does not find the CNPJ", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "CNPJ nao encontrado" })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "OK",
          cnpj: "12.345.678/0001-90",
          nome: "DIAMANTE EXPORTACAO E IMPORTACAO LTDA",
          fantasia: "DIAMANTE",
          situacao: "ATIVA",
          email: "contato@diamante.com.br",
          telefone: "(35) 3333-4444 / (35) 99999-0000",
          logradouro: "AVENIDA CENTRAL",
          numero: "100",
          complemento: "SALA 2",
          bairro: "CENTRO",
          municipio: "VARGINHA",
          uf: "MG",
          cep: "37.000-000"
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupCnpj("12.345.678/0001-90");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      cnpj: "12345678000190",
      legalName: "DIAMANTE EXPORTACAO E IMPORTACAO LTDA",
      phone: "3533334444",
      source: "RECEITA_WS"
    });
  });

  it("explains when all public CNPJ lookups fail", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "CNPJ nao encontrado" })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "ERROR", message: "Too many requests" })
      }));

    await expect(lookupCnpj("12.345.678/0001-90")).rejects.toThrow("consultas publicas gratuitas");
  });
});
