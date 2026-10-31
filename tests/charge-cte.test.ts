import { afterEach, describe, expect, it, vi } from "vitest";
import { PDFDocument, PDFPage } from "pdf-lib";
import { calculateChargeCte, defaultsToCte, readChargeCte } from "../src/shared/utils/chargeCte";
import { buildChargePdf, type ChargeDocumentsInput } from "../electron/main/services/chargeDocuments";

afterEach(() => vi.restoreAllMocks());

describe("CT-e por saca", () => {
  it("soma as sacas das oito notas em vez de contar transportes", () => {
    const notes = Array.from({ length: 8 }, (_, index) => ({ id: `${index}`, number: `${101 + index}`, company: "VASSULER", sacks: "500" }));
    const result = calculateChargeCte(notes, 150);
    expect(result.sacks).toBe("4000");
    expect(result.amountCents).toBe(600_000);
    expect(5_868_000 + result.amountCents).toBe(6_468_000);
    notes.forEach((note) => expect(result.reason).toContain(`NF ${note.number} - VASSULER (500 sacas)`));
    expect(result.description).toContain("4000 sacas");
    expect(result.reason).not.toContain("transporte(s)");
  });

  it("preserva fracao de saca e arredonda somente o total em centavos", () => {
    const result = calculateChargeCte([
      { id: "1", number: "1", company: "Teste", sacks: "0.003334" },
      { id: "2", number: "2", company: "Teste", sacks: "0.003334" }
    ], 150);
    expect(result.sacks).toBe("0.006668");
    expect(result.amountCents).toBe(1);
    expect(calculateChargeCte([], 150).amountCents).toBe(0);
  });

  it("seleciona Vassuler por padrao sem incluir outras empresas", () => {
    expect(defaultsToCte("VASSULER COMERCIO DE ADUBO E CAFE LTDA")).toBe(true);
    expect(defaultsToCte("Vassuler")).toBe(true);
    expect(defaultsToCte("ATLAS COMERCIO E INDUSTRIA LTDA")).toBe(false);
    expect(defaultsToCte("Vassuleria")).toBe(false);
  });

  it("le ajustes existentes sem alterar quantidades, tarifa ou valor", () => {
    const cte = calculateChargeCte([{ id: "1", number: "101", company: "EMPRESA (MG)", sacks: "1234.5678" }], 150);
    const parsed = readChargeCte({ ...cte, effect: "INCREASE_RECEIVABLE" });
    expect(parsed?.sacks).toBe("1234.5678");
    expect(parsed?.unitValueCents).toBe(150);
    expect(parsed?.notes[0].company).toBe("EMPRESA (MG)");
    expect(readChargeCte({ ...cte, effect: "INCREASE_RECEIVABLE", amountCents: cte.amountCents + 1 })).toBeNull();
    expect(readChargeCte({ ...cte, effect: "REDUCE_RECEIVABLE" })).toBeNull();
    expect(readChargeCte({ ...cte, effect: "INCREASE_RECEIVABLE", description: "CT-e (4 x R$ 1,50)", reason: "4 transportes" })).toBeNull();
  });

  it("imprime todas as referencias no PDF mesmo quando ocupam varias paginas", async () => {
    const notes = Array.from({ length: 120 }, (_, index) => ({ id: `${index}`, number: `${10001 + index}`, company: "VASSULER EMPRESA DE TESTE", sacks: "500" }));
    const cte = calculateChargeCte(notes, 150);
    const input = {
      organization: { slug: "teste", displayName: "Teste", appDisplayName: "Teste", logoPath: null },
      ownLegalEntity: { tradeName: "Teste", legalName: "Empresa Teste", cnpj: "00000000000000" },
      client: { displayName: "Cliente Teste" },
      detail: {
        charge: { status: "DRAFT", notes: "PREVIA INTERNA", createdAt: "2026-10-30", dueDate: "2026-10-30", periodStart: "2026-10-01", periodEnd: "2026-10-30", periodicity: "MONTHLY", openAmountCents: cte.amountCents, finalAmountCents: cte.amountCents, subtotalServicesCents: 0, additionsCents: cte.amountCents, deductionsCents: 0, paidAmountCents: 0 },
        operations: [], payments: [], adjustments: [{ ...cte, adjustmentType: "SURCHARGE", effect: "INCREASE_RECEIVABLE" }]
      }
    } as unknown as ChargeDocumentsInput;
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    const pdf = await PDFDocument.load(await buildChargePdf(input));
    const text = draw.mock.calls.map(([value]) => value).join(" ");
    notes.forEach((note) => expect(text).toContain(`NF ${note.number}`));
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(text).toContain("CT-e | TRANSPORTE POR SACA");
    expect(text).toContain("NOTAS VINCULADAS");
    expect(text).toContain("VALOR POR SACA");
    expect(text).not.toContain("Notas de referencia:");
    expect(text.match(/VASSULER EMPRESA DE TESTE/g)?.length).toBeLessThan(10);
    draw.mock.calls.forEach(([, options]) => {
      expect(options?.y).toBeGreaterThanOrEqual(0);
      expect(options?.y).toBeLessThan(842);
    });
  });
});
