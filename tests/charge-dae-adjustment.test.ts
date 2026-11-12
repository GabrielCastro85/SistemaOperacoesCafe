import { afterEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { PDFPage } from "pdf-lib";
import { chargeDaeLines, isGeneratedDaeReason, parseChargeDaeAdjustment } from "../src/shared/utils/chargeDaeAdjustment";
import { buildChargePdf, buildChargeWorkbook, type ChargeDocumentsInput } from "../electron/main/services/chargeDocuments";

afterEach(() => vi.restoreAllMocks());

const dae = (number: string, overrides: Record<string, unknown> = {}) => ({
  adjustmentType: "SURCHARGE", effect: "INCREASE_RECEIVABLE", amountCents: 16000, ledgerEntryDate: null,
  description: `DAE de frete referente a NF ${number} - DAE DAE FRETE ${number}`,
  reason: `Valor de DAE de frete registrado na nota fiscal ${number}.`, ...overrides
});

describe("DAE na cobranca sem repeticao", () => {
  it("le os tres formatos gravados", () => {
    expect(parseChargeDaeAdjustment(dae("1496"))).toEqual({ documentNumber: "1496", kind: "FREIGHT", label: "DAE de frete", references: ["FRETE 1496"] });
    expect(parseChargeDaeAdjustment({ description: "DAE referente a NF 77 - DAE 555", reason: null })).toMatchObject({ documentNumber: "77", kind: "INVOICE", references: ["555"] });
    expect(parseChargeDaeAdjustment({ description: "DAE de frete e DAE da nota referentes a NF 80", reason: "DAE registrado na nota fiscal 80: frete (DAE 11) R$ 160,00 + nota fiscal (DAE 22) R$ 50,00." }))
      .toMatchObject({ documentNumber: "80", kind: "BOTH", label: "DAE de frete + nota", references: ["11", "22"] });
    expect(parseChargeDaeAdjustment({ description: "Desconto combinado", reason: null })).toBeNull();
    expect(isGeneratedDaeReason("Valor de DAE de frete registrado na nota fiscal 1496.")).toBe(true);
    expect(isGeneratedDaeReason("Cliente pediu para cobrar junto")).toBe(false);
  });

  it("separa DAE da nota e DAE de frete, cada um com o proprio valor", () => {
    expect(chargeDaeLines({ description: "DAE de frete e DAE da nota referentes a NF 2059", amountCents: 11578, reason: "DAE registrado na nota fiscal 2059: frete (DAE FRETE 2059) R$ 80,00 + nota fiscal (DAE 2059) R$ 35,78." }))
      .toEqual([{ kind: "INVOICE", label: "DAE 2059", amountCents: 3578 }, { kind: "FREIGHT", label: "DAE FRETE 2059", amountCents: 8000 }]);
    expect(chargeDaeLines({ ...dae("1496"), amountCents: 16000 })).toEqual([{ kind: "FREIGHT", label: "DAE FRETE 1496", amountCents: 16000 }]);
    expect(chargeDaeLines({ description: "DAE referente a NF 2084 - DAE 2084", amountCents: 5789, reason: null })).toEqual([{ kind: "INVOICE", label: "DAE 2084", amountCents: 5789 }]);
    // Valores do motivo nao batem com o total: nao inventa, fica uma linha so'.
    expect(chargeDaeLines({ description: "DAE de frete e DAE da nota referentes a NF 9", amountCents: 100, reason: "texto livre" })).toEqual([{ kind: "BOTH", label: "DAE + DAE FRETE 9", amountCents: 100 }]);
  });

  it("PDF e planilha mostram um bloco de DAE com total, sem a frase repetida", async () => {
    const operation = (number: string) => ({
      operationDateSnapshot: "2026-11-04", fiscalDocumentNumberSnapshot: number, fiscalDocumentSeriesSnapshot: "1", issuerNameSnapshot: "VILLA COFFEE COMERCIO E EXP. LTDA", destinationNameSnapshot: "FRANCA CAFE LTDA",
      ownLegalEntityNameSnapshot: "VILLA COFFEE COMERCIO E EXP. LTDA", issuerShortLabel: "VILLA ES", productNameSnapshot: "CAFE", operationScopeSnapshot: "INTERNAL", quantitySacksDecimalSnapshot: "430", serviceRateCentsSnapshot: 500,
      serviceAmountCentsSnapshot: 215000, contractNumberSnapshot: null, billingObservationsSnapshot: null
    });
    const input = {
      organization: { slug: "villa", displayName: "Villa Coffee", appDisplayName: "Villa Coffee Operacoes", logoPath: null },
      ownLegalEntity: { tradeName: "Villa Coffee Espirito Santo", legalName: "VILLA COFFEE COMERCIO E EXP. LTDA", cnpj: "44963370000280" },
      client: { displayName: "ALCA" },
      detail: {
        charge: { status: "DRAFT", notes: "PREVIA INTERNA", createdAt: "2026-11-12", dueDate: "2026-11-12", periodStart: "2026-11-01", periodEnd: "2026-11-12", periodicity: "MONTHLY", openAmountCents: 478000, finalAmountCents: 478000, subtotalServicesCents: 430000, additionsCents: 48000, deductionsCents: 0, paidAmountCents: 0 },
        operations: [operation("1448"), operation("1496")], payments: [],
        adjustments: [dae("1496"), dae("1448"), dae("1868", { reason: "Cliente pediu para cobrar junto" }),
          { adjustmentType: "SURCHARGE", effect: "INCREASE_RECEIVABLE", amountCents: 11578, ledgerEntryDate: null, description: "DAE de frete e DAE da nota referentes a NF 1500", reason: "DAE registrado na nota fiscal 1500: frete (DAE FRETE 1500) R$ 80,00 + nota fiscal (DAE 1500) R$ 35,78." }]
      }
    } as unknown as ChargeDocumentsInput;
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    const bytes = await buildChargePdf(input);
    if (process.env.CHARGE_DAE_SAMPLE) writeFileSync(process.env.CHARGE_DAE_SAMPLE, bytes);
    const text = draw.mock.calls.map(([value]) => value).join(" | ");
    expect(text).toContain("DAE - 4 NOTAS");
    expect(text).toContain("DAE FRETE 1496");
    expect(text).toContain("DAE 1500 | 01/11/2026".replace(" | 01/11/2026", ""));
    expect(text).toContain("R$ 35,78");
    expect(text).toContain("R$ 80,00");
    expect(text).not.toContain("ref.");
    expect(text).toContain("TOTAL DAE: 4 notas");
    expect(text).toContain("R$ 595,78");
    expect(text).not.toContain("registrado na nota fiscal");
    expect(text).not.toContain("DAE DAE");
    expect(text).toContain("Obs.: Cliente pediu para cobrar junto");

    const workbook = new ExcelJS.Workbook();
    const buffer = await buildChargeWorkbook(input);
    if (process.env.CHARGE_DAE_XLSX) writeFileSync(process.env.CHARGE_DAE_XLSX, buffer);
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = workbook.getWorksheet("Ajustes")!;
    expect(sheet.getRow(1).values).toEqual([undefined, "Data", "NF", "Emitente", "Empresa", "Ajuste", "Efeito", "Valor", "Observacoes"]);
    expect(sheet.getRow(2).values).toEqual([undefined, "2026-11-04", "1448", "VILLA ES", "FRANCA CAFE LTDA", "DAE FRETE 1448", "Soma", 160, ""]);
    expect(sheet.getRow(4).getCell(5).value).toBe("DAE 1500");
    expect(sheet.getRow(4).getCell(7).value).toBe(35.78);
    expect(sheet.getRow(5).getCell(5).value).toBe("DAE FRETE 1500");
    expect(sheet.getRow(5).getCell(7).value).toBe(80);
    expect(sheet.getRow(6).getCell(8).value).toBe("Cliente pediu para cobrar junto");
    expect(sheet.getRow(7).getCell(1).value).toBe("Total");
    expect(sheet.getRow(7).getCell(7).value).toBeCloseTo(595.78, 2);
  });
});
