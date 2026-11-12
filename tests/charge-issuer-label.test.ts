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
      ownLegalEntity: { tradeName: "Villa Coffee Minas Gerais", legalName: "VILLA COFFEE COMERCIO E EXP. LTDA", cnpj: "44963370000523", defaultBankName: "Santander", defaultPixKey: "44.963.370/0004-42" },
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
    expect(buildChargeSummarySvg(input).svg).toContain("VILLA ES");
  });
});
