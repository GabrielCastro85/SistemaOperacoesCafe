import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildChargeControlPrintHtml, buildChargeControlWorkbook } from "../electron/main/services/chargeControlWorkbook.js";
import type { ClientCharge } from "../src/shared/types/domain.js";

describe("controle interno de cobrancas", () => {
  it("gera duas linhas para preencher pagamentos de cada cobranca", async () => {
    const charge = {
      id: "charge-1",
      chargeNumber: "COB-001",
      referenceCode: "OUT-2026",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-15",
      issueDate: "2026-10-16",
      dueDate: "2026-10-20",
      status: "PARTIALLY_PAID",
      finalAmountCents: 150_000,
      paidAmountCents: 50_000,
      openAmountCents: 100_000
    } as ClientCharge;
    const paidCharge = {
      ...charge,
      id: "charge-paid",
      status: "PAID",
      paidAmountCents: 150_000,
      openAmountCents: 0
    } as ClientCharge;

    const input = {
      rows: [{
        charge,
        clientName: "Cliente & Teste",
        companyName: "Empresa Teste Ltda",
        payments: []
      }, {
        charge: paidCharge,
        clientName: "Cliente quitado",
        companyName: "Empresa Teste Ltda",
        payments: []
      }],
      generatedAt: new Date("2026-10-21T12:00:00-03:00")
    };
    const buffer = await buildChargeControlWorkbook(input);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const control = workbook.getWorksheet("Controle para impressao");

    expect(workbook.worksheets).toHaveLength(1);
    expect(control?.getCell("A5").value).toBe("Cliente & Teste");
    expect(control?.getCell("B5").value).toBe("01/10/2026 a 15/10/2026");
    expect(control?.getCell("C5").value).toBe(1000);
    expect(control?.getCell("D5").value).toBe("1º pagamento: __________________");
    expect(control?.getCell("D6").value).toBe("2º pagamento: __________________");
    expect(control?.getCell("E5").value).toBe("");
    expect(control?.getCell("F6").value).toBe("☐");
    expect(control?.getCell("A5").isMerged).toBe(true);
    expect(control?.rowCount).toBe(6);
    expect(control?.pageSetup.orientation).toBe("portrait");

    const html = buildChargeControlPrintHtml({ ...input, filterDescription: "Período escolhido" });
    expect(html).toContain("Cliente &amp; Teste");
    expect(html).toContain("<span>1º:</span>");
    expect(html).toContain("<span>2º:</span>");
    expect(html).toContain("Período escolhido");
    expect(html).not.toContain("Empresa Teste Ltda");
    expect(html).not.toContain("Cliente quitado");
    expect(html).toContain("A4 portrait");
  });
});
