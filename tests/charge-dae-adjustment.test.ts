import { afterEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { PDFPage } from "pdf-lib";
import { isGeneratedDaeReason, parseChargeDaeAdjustment } from "../src/shared/utils/chargeDaeAdjustment";
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
        adjustments: [dae("1496"), dae("1448"), dae("1868", { reason: "Cliente pediu para cobrar junto" })]
      }
    } as unknown as ChargeDocumentsInput;
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    const bytes = await buildChargePdf(input);
    if (process.env.CHARGE_DAE_SAMPLE) writeFileSync(process.env.CHARGE_DAE_SAMPLE, bytes);
    const text = draw.mock.calls.map(([value]) => value).join(" | ");
    expect(text).toContain("DAE - 3 NOTAS");
    expect(text).toContain("DAE de frete - ref. FRETE 1496");
    expect(text).toContain("TOTAL DAE: 3 notas");
    expect(text).not.toContain("registrado na nota fiscal");
    expect(text).not.toContain("DAE DAE");
    expect(text).toContain("Obs.: Cliente pediu para cobrar junto");

    const workbook = new ExcelJS.Workbook();
    const buffer = await buildChargeWorkbook(input);
    if (process.env.CHARGE_DAE_XLSX) writeFileSync(process.env.CHARGE_DAE_XLSX, buffer);
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = workbook.getWorksheet("Ajustes")!;
    expect(sheet.getRow(1).values).toEqual([undefined, "Data", "NF", "Emitente", "Empresa", "Ajuste", "Referencia DAE", "Efeito", "Valor", "Observacoes"]);
    expect(sheet.getRow(2).values).toEqual([undefined, "2026-11-04", "1448", "VILLA ES", "FRANCA CAFE LTDA", "DAE de frete", "FRETE 1448", "Soma", 160, ""]);
    expect(sheet.getRow(4).getCell(9).value).toBe("Cliente pediu para cobrar junto");
    expect(sheet.getRow(5).getCell(1).value).toBe("Total");
    expect(sheet.getRow(5).getCell(8).value).toBe(480);
  });
});
