import { describe, expect, it } from "vitest";
import { paymentHasUserInput } from "../src/renderer/pages/transferReconciliations/TransferReconciliationsPage";

const blankPayment = {
  beneficiaryName: "",
  beneficiaryDocument: "",
  description: "",
  paymentDate: "2026-10-26",
  amount: "",
  notes: ""
};

describe("inclusao de pagamentos usando Tab", () => {
  it("nao considera a data preenchida automaticamente como um pagamento iniciado", () => {
    expect(paymentHasUserInput(blankPayment)).toBe(false);
  });

  it("reconhece uma linha depois que algum dado do pagamento foi preenchido", () => {
    expect(paymentHasUserInput({ ...blankPayment, beneficiaryName: "Fornecedor" })).toBe(true);
    expect(paymentHasUserInput({ ...blankPayment, amount: "1.500,00" })).toBe(true);
    expect(paymentHasUserInput({ ...blankPayment, notes: "Segunda parcela" })).toBe(true);
  });

  it("ignora campos que contenham apenas espacos", () => {
    expect(paymentHasUserInput({ ...blankPayment, description: "   " })).toBe(false);
  });
});
