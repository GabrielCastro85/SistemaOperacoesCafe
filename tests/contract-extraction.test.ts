import { describe, expect, it } from "vitest";
import { extractContractNumber } from "../electron/main/services/xmlNfeService";

describe("referencia de contrato no XML", () => {
  it("reconhece rotulos completos e referencias alfanumericas", () => {
    expect(extractContractNumber(["Contrato número: AB-123/2026"])).toBe("AB-123/2026");
    expect(extractContractNumber(["CONTRATO N° 123", "Contrato: 123"])).toBe("123");
  });

  it("deixa referencias conflitantes e texto sem numero para revisao", () => {
    expect(extractContractNumber(["Contrato 123; contrato 456"])).toBeNull();
    expect(extractContractNumber(["Contrato nao informado; pedido 123"])).toBeNull();
    expect(extractContractNumber(["Pedido de compra 123"])).toBeNull();
  });
});
