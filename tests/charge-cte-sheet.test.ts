import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildChargeCtePdf, buildChargeCteWorkbook } from "../electron/main/services/chargeDocuments";
import { chargeCteSheetRows } from "../electron/main/services/chargeCteSheet";
import { calculateChargeCte } from "../src/shared/utils/chargeCte";
import type { ClientChargeDetail } from "../src/shared/types/domain";

function operation(nf: string, sacks: string, date: string, amountCents: number, rateCents: number) {
  return {
    fiscalDocumentNumberSnapshot: nf,
    fiscalDocumentSeriesSnapshot: "1",
    operationDateSnapshot: date,
    ownLegalEntityNameSnapshot: "GRÃO E GRÃO",
    issuerShortLabel: "GRAO",
    destinationNameSnapshot: "VASSULER",
    productNameSnapshot: "CAFE",
    operationScopeSnapshot: "EXTERNAL",
    quantitySacksDecimalSnapshot: sacks,
    serviceAmountCentsSnapshot: amountCents,
    serviceRateCentsSnapshot: rateCents,
    contractNumberSnapshot: null,
    billingObservationsSnapshot: null
  };
}

function detailWithCte(): ClientChargeDetail {
  const cte = calculateChargeCte([
    { id: "a", number: "7438", company: "GRÃO E GRÃO", sacks: "500" },
    { id: "b", number: "7439", company: "GRÃO E GRÃO", sacks: "500" }
  ], 150);
  return {
    charge: {
      id: "charge-1", organizationId: "org-1", ownLegalEntityId: "own-1", clientPartnerId: "c1", periodicity: "MONTHLY",
      periodStart: "2026-10-01", periodEnd: "2026-10-31", dueDate: "2026-11-10", issueDate: "2026-11-03", createdAt: "2026-11-03T12:00:00.000Z",
      status: "PENDING_REVIEW", notes: null
    },
    operations: [
      operation("7439", "500", "2026-10-19T00:00:00.000Z", 75000, 150),
      operation("7438", "500", "2026-10-19T00:00:00.000Z", 75000, 150),
      operation("7438", "0", "2026-10-19T00:00:00.000Z", 1000, 500),
      operation("9999", "300", "2026-10-22T00:00:00.000Z", 45000, 150)
    ],
    adjustments: [{ description: cte.description, reason: cte.reason, amountCents: cte.amountCents, effect: "INCREASE_RECEIVABLE" }]
  } as unknown as ClientChargeDetail;
}

function documentsInput(detail: ClientChargeDetail) {
  return {
    directories: {} as never,
    organization: { id: "org-1", slug: "graonex", displayName: "Grão & Grão", appDisplayName: "Operações Café" } as never,
    ownLegalEntity: { tradeName: "GRÃO E GRÃO", legalName: "GRÃO E GRÃO LTDA", cnpj: "00000000000191" } as never,
    client: { displayName: "ABC", id: "c1" } as never,
    clientLegalEntity: null,
    detail,
    relatedOpenChargeDetails: [],
    relatedPaidChargeDetails: []
  };
}

describe("PHT (CT-e) da cobranca", () => {
  it("lista so as notas do CT-e, uma linha por NF, sem sacaria", () => {
    const data = chargeCteSheetRows(detailWithCte());
    expect(data).not.toBeNull();
    expect(data!.rows.map((row) => row.nf)).toEqual(["7438", "7439"]);
    expect(data!.rows.map((row) => row.sacks)).toEqual(["500", "500"]);
    expect(data!.unitValueCents).toBe(150);
  });

  it("planilha no padrao do site: titulo, cabecalho, linhas e total com formulas", async () => {
    const bytes = await buildChargeCteWorkbook(documentsInput(detailWithCte()) as never);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
    const sheet = workbook.getWorksheet("PHT")!;
    expect(sheet.getCell("A1").value).toBe("NOTAS DO CT-e (FRETE)");
    expect(sheet.getRow(4).values).toEqual([undefined, "DATA", "EMPRESA", "NF", "DESTINO", "SACAS"]);
    expect(sheet.getCell("B5").value).toBe("GRÃO E GRÃO");
    expect(sheet.getCell("D5").value).toBe("VASSULER");
    expect(sheet.getCell("C6").value).toBe(7439);
    expect((sheet.getCell("E8").value as { result: number }).result).toBe(1000);
    expect(sheet.getCell("E9").value).toBe(1.5);
    expect((sheet.getCell("E10").value as { result: number }).result).toBe(1500);
    expect(sheet.headerFooter.oddFooter).toContain("&RPagina");
  });

  it("gera o PDF PHT com as notas", async () => {
    const bytes = await buildChargeCtePdf(documentsInput(detailWithCte()) as never);
    expect(Buffer.from(bytes.slice(0, 4)).toString()).toBe("%PDF");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("nao gera quando a cobranca nao tem CT-e", async () => {
    const detail = { ...detailWithCte(), adjustments: [] } as unknown as ClientChargeDetail;
    await expect(buildChargeCteWorkbook(documentsInput(detail) as never)).rejects.toThrow(/nao tem CT-e/);
    await expect(buildChargeCtePdf(documentsInput(detail) as never)).rejects.toThrow(/nao tem CT-e/);
  });
});
