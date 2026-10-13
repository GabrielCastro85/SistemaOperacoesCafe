import ExcelJS from "exceljs";
import type { ClientCharge, ClientPayment } from "../../../src/shared/types/domain.js";

export interface ChargeControlPaymentAllocation {
  payment: ClientPayment;
  allocatedAmountCents: number;
}

export interface ChargeControlRow {
  charge: ClientCharge;
  clientName: string;
  companyName: string;
  payments: ChargeControlPaymentAllocation[];
}

export interface ChargeControlWorkbookInput {
  rows: ChargeControlRow[];
  filterDescription?: string | null;
  generatedAt?: Date;
}

const darkGreen = "063F2E";
const paleGreen = "EFF8F2";
const cream = "FBF6EB";
const gold = "C9A66B";
const ink = "261D16";
const muted = "6E5D50";
const border = "CDBEAA";

export async function buildChargeControlWorkbook(input: ChargeControlWorkbookInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const generatedAt = input.generatedAt ?? new Date();
  const rows = openChargeRows(input.rows);
  workbook.creator = "Sistema de Operacoes de Cafe";
  workbook.created = generatedAt;
  workbook.modified = generatedAt;

  const sheet = workbook.addWorksheet("Controle para impressao", {
    views: [{ state: "frozen", ySplit: 4, activeCell: "A5" }],
    pageSetup: {
      orientation: "portrait",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.15, right: 0.15, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.15 }
    }
  });

  sheet.columns = [
    { width: 25 },
    { width: 20 },
    { width: 15 },
    { width: 18 },
    { width: 17 },
    { width: 11 }
  ];

  sheet.mergeCells("A1:F1");
  const title = sheet.getCell("A1");
  title.value = "CONTROLE INTERNO DE PAGAMENTOS";
  title.font = { name: "Aptos Display", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  title.fill = solidFill(darkGreen);
  title.alignment = { vertical: "middle", horizontal: "center" };
  sheet.getRow(1).height = 27;

  sheet.mergeCells("A2:F2");
  const subtitle = sheet.getCell("A2");
  subtitle.value = `Preencha o valor e a data de cada pagamento. Gerado em ${formatDateTimeBr(generatedAt)}.`;
  subtitle.font = { name: "Aptos", size: 10, italic: true, color: { argb: `FF${muted}` } };
  subtitle.fill = solidFill(cream);
  subtitle.alignment = { vertical: "middle", horizontal: "center" };
  sheet.getRow(2).height = 18;

  sheet.addRow([]);
  const header = sheet.addRow([
    "Cliente/corretor",
    "Periodo da planilha",
    "Saldo em aberto",
    "Valor pago (R$)",
    "Data do pagamento",
    "Conferido"
  ]);
  styleHeaderRow(header);

  rows.forEach((item, index) => {
    const firstRowNumber = sheet.rowCount + 1;
    const first = sheet.addRow([
      item.clientName,
      `${formatDateOnlyBr(item.charge.periodStart)} a ${formatDateOnlyBr(item.charge.periodEnd)}`,
      item.charge.openAmountCents / 100,
      "1º pagamento: __________________",
      "",
      "☐"
    ]);
    const second = sheet.addRow(["", "", "", "2º pagamento: __________________", "", "☐"]);
    const secondRowNumber = sheet.rowCount;

    sheet.mergeCells(`A${firstRowNumber}:A${secondRowNumber}`);
    sheet.mergeCells(`B${firstRowNumber}:B${secondRowNumber}`);
    sheet.mergeCells(`C${firstRowNumber}:C${secondRowNumber}`);
    stylePaymentPair(first, second, index % 2 === 0);
  });

  const lastRow = Math.max(4, sheet.rowCount);
  sheet.autoFilter = { from: "A4", to: "F4" };
  sheet.pageSetup.printArea = `A1:F${lastRow}`;
  sheet.pageSetup.printTitlesRow = "1:4";
  sheet.headerFooter.oddFooter = "Página &P de &N";
  sheet.headerFooter.evenFooter = "Página &P de &N";
  sheet.properties.defaultRowHeight = 20;

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function buildChargeControlPrintHtml(input: ChargeControlWorkbookInput): string {
  const generatedAt = input.generatedAt ?? new Date();
  const rows = openChargeRows(input.rows).map((item, index) => {
    const client = escapeHtml(item.clientName);
    const period = escapeHtml(`${formatDateOnlyBr(item.charge.periodStart)} a ${formatDateOnlyBr(item.charge.periodEnd)}`);
    const amount = escapeHtml(formatCurrencyBr(item.charge.openAmountCents));
    const pairClass = index % 2 === 0 ? "pair alternate" : "pair";
    return `
      <tbody class="${pairClass}">
        <tr>
          <td rowspan="2" class="client">${client}</td>
          <td rowspan="2">${period}</td>
          <td rowspan="2" class="money">${amount}</td>
          <td class="write"><span>1º:</span></td>
          <td class="write"></td>
          <td class="check">☐</td>
        </tr>
        <tr>
          <td class="write"><span>2º:</span></td>
          <td class="write"></td>
          <td class="check">☐</td>
        </tr>
      </tbody>`;
  }).join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Controle interno de pagamentos</title>
  <style>
    @page { size: A4 portrait; margin: 6mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #261d16; font-family: Arial, sans-serif; font-size: 7.5pt; }
    h1 { margin: 0; padding: 5px 8px; background: #063f2e; color: white; font-size: 13pt; text-align: center; }
    .meta { margin: 0 0 5px; padding: 3px 6px; background: #fbf6eb; color: #6e5d50; text-align: center; font-size: 7pt; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    thead { display: table-header-group; }
    tbody.pair { break-inside: avoid; page-break-inside: avoid; }
    th { padding: 4px 3px; background: #063f2e; color: white; border: 1px solid #c9a66b; font-size: 7pt; text-align: center; }
    td { height: 22px; padding: 3px; border: 1px solid #cdbeaa; text-align: center; vertical-align: middle; }
    tbody.alternate td { background: #eff8f2; }
    td.client { font-weight: 700; text-align: left; }
    td.money { font-weight: 700; font-size: 8pt; white-space: nowrap; }
    td.write { text-align: left; }
    td.write span { font-weight: 700; }
    td.check { font-size: 12pt; }
    .client-col { width: 27%; }
    .period-col { width: 22%; }
    .amount-col { width: 15%; }
    .paid-col { width: 17%; }
    .date-col { width: 13%; }
    .check-col { width: 6%; }
  </style>
</head>
<body>
  <h1>CONTROLE INTERNO DE PAGAMENTOS</h1>
  <p class="meta">${escapeHtml(input.filterDescription ?? "Todas as cobranças selecionadas")} · Gerado em ${escapeHtml(formatDateTimeBr(generatedAt))}</p>
  <table>
    <thead>
      <tr>
        <th class="client-col">Cliente/corretor</th>
        <th class="period-col">Período da planilha</th>
        <th class="amount-col">Saldo em aberto</th>
        <th class="paid-col">Valor pago (R$)</th>
        <th class="date-col">Data do pagamento</th>
        <th class="check-col">Conferido</th>
      </tr>
    </thead>
    ${rows}
  </table>
</body>
</html>`;
}

function openChargeRows(rows: ChargeControlRow[]): ChargeControlRow[] {
  return rows.filter((item) => item.charge.openAmountCents > 0 && !["DRAFT", "CANCELLED", "REPLACED", "PAID"].includes(item.charge.status));
}

function styleHeaderRow(row: ExcelJS.Row): void {
  row.height = 28;
  row.eachCell((cell) => {
    cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = solidFill(darkGreen);
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = thinBorder(gold);
  });
}

function stylePaymentPair(first: ExcelJS.Row, second: ExcelJS.Row, highlighted: boolean): void {
  const fill = solidFill(highlighted ? paleGreen : "FFFDF8");
  [first, second].forEach((row) => {
    row.height = 23;
    for (let column = 1; column <= 6; column += 1) {
      const cell = row.getCell(column);
      cell.font = { name: "Aptos", size: 8, color: { argb: `FF${ink}` } };
      cell.fill = fill;
      cell.alignment = {
        vertical: "middle",
        horizontal: column === 1 ? "left" : "center",
        wrapText: true
      };
      cell.border = thinBorder(border);
    }
  });
  first.getCell(1).font = { name: "Aptos", size: 8, bold: true, color: { argb: `FF${ink}` } };
  first.getCell(3).font = { name: "Aptos", size: 9, bold: true, color: { argb: `FF${ink}` } };
  first.getCell(3).numFmt = 'R$ #,##0.00;[Red]-R$ #,##0.00';
  first.getCell(6).font = { name: "Aptos", size: 13, color: { argb: `FF${darkGreen}` } };
  second.getCell(6).font = { name: "Aptos", size: 13, color: { argb: `FF${darkGreen}` } };
}

function solidFill(color: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb: `FF${color}` } };
}

function thinBorder(color: string): Partial<ExcelJS.Borders> {
  const side = { style: "thin" as const, color: { argb: `FF${color}` } };
  return { top: side, left: side, bottom: side, right: side };
}

function formatDateOnlyBr(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function formatDateTimeBr(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(value);
}

function formatCurrencyBr(valueCents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valueCents / 100);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
