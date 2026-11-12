import { afterEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { PDFPage } from "pdf-lib";
import { chargeIssuerLabelFromNames, ownEntityShortLabel, thirdPartyShortName } from "../src/shared/utils/chargeIssuerLabel";
import { buildChargePdf, buildChargeSummarySvg, type ChargeDocumentsInput } from "../electron/main/services/chargeDocuments";

afterEach(() => vi.restoreAllMocks());

describe("emitente curto na cobranca", () => {
  it("empresas proprias viram marca + estado", () => {
    expect(ownEntityShortLabel({ tradeName: "Villa Coffee Minas Gerais", legalName: "VILLA COFFEE COMERCIO E EXP. LTDA", state: "MG" })).toBe("VILLA MG");
    expect(ownEntityShortLabel({ tradeName: "Villa Coffee Espírito Santo", legalName: "VILLA COFFEE COMERCIO E EXP. LTDA", state: "" })).toBe("VILLA ES");
    expect(ownEntityShortLabel({ tradeName: "Grão & Grão São Paulo", legalName: "GRAO & GRAO COMERCIO EXP LTDA", state: "SP" })).toBe("GRÃO SP");
    expect(ownEntityShortLabel({ tradeName: "Grão & Grão Minas Gerais", state: "mg" })).toBe("GRÃO MG");
  });

  it("terceiros viram o comeco do nome, sem COMERCIO/LTDA", () => {
    expect(thirdPartyShortName("PRIME COFFEE COMERCIO E EXPORTACAO DE CAFE LTDA")).toBe("PRIME COFFEE");
    expect(thirdPartyShortName("GARDINGO TRADE IMPORTACAO E EXPORTACAO LTDA")).toBe("GARDINGO TRADE");
    expect(thirdPartyShortName("COOPERATIVA AGROPECUARIA CENTRO SERRANA")).toBe("COOPERATIVA AGROPECUARIA");
    expect(thirdPartyShortName("BOM DO GRAOS EXPORTACAO E COMERCIALIZACAO LTDA")).toBe("BOM DO GRAOS");
    expect(thirdPartyShortName("MUNIZ COMERCIO DE GRAOS LTDA")).toBe("MUNIZ");
    expect(thirdPartyShortName("RODRIGUES ARMAZEM E COMERCIO LTDA")).toBe("RODRIGUES ARMAZEM");
    expect(chargeIssuerLabelFromNames("VILLA CEREAIS LTDA", "VILLA COFFEE COMERCIO E EXP. LTDA")).toBe("VILLA CEREAIS");
    expect(chargeIssuerLabelFromNames("VILLA COFFEE COMERCIO E EXP. LTDA", "Villa Coffee Minas Gerais")).toBe("VILLA MG");
  });

  it("o PDF mostra a coluna EMITENTE e nao tem mais o aviso do cadastro", async () => {
    const operation = (number: string, issuerShortLabel: string) => ({
      operationDateSnapshot: "2026-11-04", fiscalDocumentNumberSnapshot: number, fiscalDocumentSeriesSnapshot: "1", issuerNameSnapshot: "VILLA COFFEE COMERCIO E EXP. LTDA", destinationNameSnapshot: "COOPERATIVA AGROPECUARIA CENTRO SERRANA",
      ownLegalEntityNameSnapshot: "VILLA COFFEE COMERCIO E EXP. LTDA", issuerShortLabel, productNameSnapshot: "CAFE", operationScopeSnapshot: "INTERNAL", quantitySacksDecimalSnapshot: "600", serviceRateCentsSnapshot: 500,
      serviceAmountCentsSnapshot: 300000, contractNumberSnapshot: null, billingObservationsSnapshot: null
    });
    const input = {
      organization: { slug: "villa", displayName: "Villa Coffee", appDisplayName: "Villa Coffee Operacoes", logoPath: null },
      ownLegalEntity: { tradeName: "Villa Coffee Minas Gerais", legalName: "VILLA COFFEE COMERCIO E EXP. LTDA", cnpj: "44963370000523", defaultBankName: "Santander", defaultBankCode: "033", defaultBankAgency: "2479", defaultBankAccount: "13000793-9", defaultPixKey: "44.963.370/0004-42" },
      client: { displayName: "ALCA" },
      detail: {
        charge: { status: "DRAFT", notes: "PREVIA INTERNA", createdAt: "2026-11-12", dueDate: "2026-11-12", periodStart: "2026-11-01", periodEnd: "2026-11-12", periodicity: "MONTHLY", openAmountCents: 600000, finalAmountCents: 600000, subtotalServicesCents: 600000, additionsCents: 0, deductionsCents: 0, paidAmountCents: 0 },
        operations: [operation("1912", "VILLA MG"), operation("869", "VILLA ES")], payments: [], adjustments: []
      }
    } as unknown as ChargeDocumentsInput;
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    const bytes = await buildChargePdf(input);
    if (process.env.CHARGE_PDF_SAMPLE) writeFileSync(process.env.CHARGE_PDF_SAMPLE, bytes);
    const text = draw.mock.calls.map(([value]) => value).join(" | ");
    expect(text).toContain("EMITENTE");
    expect(text).toContain("VILLA MG");
    expect(text).toContain("VILLA ES");
    expect(text).not.toContain("Dados podem ser ajustados");
    expect(text).toContain("RESUMO POR EMITENTE");
    expect(text).toContain("RESUMO DA COBRANÇA");
    expect(text).toContain("PRÉVIA INTERNA - FECHAMENTO");
    // Favorecido e CNPJ da conta (PIX e CNPJ, entao vale o CNPJ do PIX).
    expect(text).toContain("Favorecido: VILLA COFFEE COMERCIO E EXP. LTDA");
    expect(text).toContain("CNPJ/CPF: 44.963.370/0004-42");
    expect(buildChargeSummarySvg(input).svg).toContain("VILLA ES");
  });

  it("notas ja pagas mostram quanto e quando foi pago; resumo conta as notas; TIPO some quando e tudo igual", async () => {
    const operation = (number: string) => ({
      operationDateSnapshot: "2026-11-02", fiscalDocumentNumberSnapshot: number, fiscalDocumentSeriesSnapshot: "1", issuerNameSnapshot: "VILLA COFFEE COMERCIO E EXP. LTDA", destinationNameSnapshot: "FRANCA CAFE LTDA",
      ownLegalEntityNameSnapshot: "VILLA COFFEE COMERCIO E EXP. LTDA", issuerShortLabel: "VILLA MG", productNameSnapshot: "CAFE", operationScopeSnapshot: "INTERNAL", quantitySacksDecimalSnapshot: "430", serviceRateCentsSnapshot: 500,
      serviceAmountCentsSnapshot: 215000, contractNumberSnapshot: null, billingObservationsSnapshot: null
    });
    const charge = (start: string, end: string, paid: number) => ({ status: paid ? "PAID" : "DRAFT", notes: paid ? null : "PREVIA INTERNA", createdAt: end, issueDate: end, dueDate: end, periodStart: start, periodEnd: end, periodicity: "WEEKLY", openAmountCents: paid ? 0 : 430000, finalAmountCents: 430000, subtotalServicesCents: 430000, additionsCents: 0, deductionsCents: 0, paidAmountCents: paid });
    const input = {
      organization: { slug: "villa", displayName: "Villa Coffee", appDisplayName: "Villa Coffee Operacoes", logoPath: null },
      ownLegalEntity: { tradeName: "Villa Coffee Minas Gerais", legalName: "VILLA COFFEE COMERCIO E EXP. LTDA", cnpj: "44963370000523" },
      client: { displayName: "ALCA" },
      detail: { charge: charge("2026-11-08", "2026-11-12", 0), operations: [operation("900"), operation("901")], payments: [], adjustments: [] },
      relatedPaidChargeDetails: [{ charge: charge("2026-11-01", "2026-11-07", 430000), operations: [operation("839"), operation("840")], adjustments: [], payments: [{ amountCents: 430000, paymentDate: "2026-11-10", allocatedAt: "2026-11-10T12:00:00Z" }] }]
    } as unknown as ChargeDocumentsInput;
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    const bytes = await buildChargePdf(input);
    if (process.env.CHARGE_PAID_SAMPLE) writeFileSync(process.env.CHARGE_PAID_SAMPLE, bytes);
    const texts = draw.mock.calls.map(([value]) => String(value));
    const text = texts.join(" | ");
    expect(text).toContain("pago em 10/11/2026");
    expect(text).toContain("TOTAL JÁ PAGO NO PERÍODO: R$ 4.300,00");
    expect(text).toContain("2 notas · 860 sacas");
    expect(texts).not.toContain("TIPO");
    expect(texts).not.toContain("Interno");
  });
});
