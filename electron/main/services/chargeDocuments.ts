import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";
import type { AppDirectories, ClientChargeDetail, LegalEntity, Organization, BusinessPartner } from "../../../src/shared/types/domain.js";

export interface ChargeDocumentResult {
  pdfFilePath: string;
  pdfFileHash: string;
  excelFilePath: string;
  excelFileHash: string;
  imageFilePath: string;
  imageFileHash: string;
}

export async function generateChargeDocuments(input: {
  directories: AppDirectories;
  organization: Organization;
  ownLegalEntity: LegalEntity;
  client: BusinessPartner;
  detail: ClientChargeDetail;
}): Promise<ChargeDocumentResult> {
  const number = sanitizeSegment(input.detail.charge.chargeNumber ?? input.detail.charge.id);
  const year = (input.detail.charge.issueDate ?? input.detail.charge.createdAt).slice(0, 4);
  const baseDir = join(input.directories.chargesDir, input.organization.id, input.ownLegalEntity.id, year, number);
  mkdirSync(baseDir, { recursive: true });
  const version = input.detail.documents.length + 1;
  const pdfFilePath = join(baseDir, `cobranca-v${version}.pdf`);
  const excelFilePath = join(baseDir, `cobranca-v${version}.xlsx`);
  const imageFilePath = join(baseDir, `resumo-v${version}.png`);
  writeSimplePdf(pdfFilePath, buildChargeLines(input));
  await writeChargeWorkbook(excelFilePath, input);
  writeSummaryPng(imageFilePath, input);
  return {
    pdfFilePath,
    pdfFileHash: hashFile(pdfFilePath),
    excelFilePath,
    excelFileHash: hashFile(excelFilePath),
    imageFilePath,
    imageFileHash: hashFile(imageFilePath)
  };
}

function buildChargeLines(input: { organization: Organization; ownLegalEntity: LegalEntity; client: BusinessPartner; detail: ClientChargeDetail }): string[] {
  const charge = input.detail.charge;
  return [
    "Fechamento de Servicos",
    `Numero: ${charge.chargeNumber ?? "Rascunho"}`,
    `Organizacao: ${input.organization.displayName}`,
    `CNPJ proprio: ${input.ownLegalEntity.tradeName}`,
    `Cliente: ${input.client.displayName}`,
    `Periodo: ${charge.periodStart} a ${charge.periodEnd}`,
    `Vencimento: ${charge.dueDate ?? "-"}`,
    "",
    "Operacoes",
    ...input.detail.operations.map((item) => `${item.operationDateSnapshot} NF ${item.fiscalDocumentNumberSnapshot ?? "-"} ${item.productNameSnapshot ?? "-"} ${item.operationScopeSnapshot} ${item.quantitySacksDecimalSnapshot} sacas R$ ${formatCents(item.serviceRateCentsSnapshot)}/saca Total R$ ${formatCents(item.serviceAmountCentsSnapshot)}`),
    "",
    "Ajustes",
    ...input.detail.adjustments.map((item) => `${item.description}: ${item.effect === "INCREASE_RECEIVABLE" ? "+" : "-"} R$ ${formatCents(item.amountCents)}`),
    "",
    `Subtotal: R$ ${formatCents(charge.subtotalServicesCents)}`,
    `Acrescimos: R$ ${formatCents(charge.additionsCents)}`,
    `Deducoes: R$ ${formatCents(charge.deductionsCents)}`,
    `Total final: R$ ${formatCents(charge.finalAmountCents)}`,
    `Pago: R$ ${formatCents(charge.paidAmountCents)}`,
    `Em aberto: R$ ${formatCents(charge.openAmountCents)}`,
    "",
    `Gerado em ${new Date().toISOString()} pelo Sistema de Operacoes de Cafe.`
  ];
}

function writeSimplePdf(filePath: string, lines: string[]): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const escaped = lines.map((line, index) => `BT /F1 ${index === 0 ? 18 : 10} Tf 50 ${790 - index * 15} Td (${escapePdf(line)}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(escaped)} >>\nstream\n${escaped}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  writeFileSync(filePath, pdf);
}

async function writeChargeWorkbook(filePath: string, input: { client: BusinessPartner; detail: ClientChargeDetail }): Promise<void> {
  mkdirSync(dirname(filePath), { recursive: true });
  const workbook = new ExcelJS.Workbook();
  const charge = input.detail.charge;
  const summary = workbook.addWorksheet("Resumo");
  summary.addRows([
    ["Cobranca", charge.chargeNumber],
    ["Cliente", input.client.displayName],
    ["Periodo", `${charge.periodStart} a ${charge.periodEnd}`],
    ["Vencimento", charge.dueDate],
    ["Operacoes", input.detail.operations.length],
    ["Subtotal", charge.subtotalServicesCents / 100],
    ["Ajustes", (charge.additionsCents - charge.deductionsCents) / 100],
    ["Total final", charge.finalAmountCents / 100],
    ["Pago", charge.paidAmountCents / 100],
    ["Aberto", charge.openAmountCents / 100]
  ]);
  const operations = workbook.addWorksheet("Operacoes");
  operations.addRow(["Data", "NF", "Serie", "Produto", "Tipo", "Sacas", "R$/saca", "Total"]);
  input.detail.operations.forEach((item) => operations.addRow([item.operationDateSnapshot, item.fiscalDocumentNumberSnapshot, item.fiscalDocumentSeriesSnapshot, item.productNameSnapshot, item.operationScopeSnapshot, item.quantitySacksDecimalSnapshot, item.serviceRateCentsSnapshot / 100, item.serviceAmountCentsSnapshot / 100]));
  const adjustments = workbook.addWorksheet("Ajustes");
  adjustments.addRow(["Tipo", "Descricao", "Efeito", "Valor"]);
  input.detail.adjustments.forEach((item) => adjustments.addRow([item.adjustmentType, item.description, item.effect, item.amountCents / 100]));
  const payments = workbook.addWorksheet("Pagamentos");
  payments.addRow(["Pagamento", "Valor"]);
  input.detail.payments.forEach((item) => payments.addRow([item.clientPaymentId, item.amountCents / 100]));
  workbook.eachSheet((sheet) => {
    sheet.columns.forEach((column) => { column.width = 18; });
  });
  await workbook.xlsx.writeFile(filePath);
}

function writeSummaryPng(filePath: string, input: { organization: Organization; client: BusinessPartner; detail: ClientChargeDetail }): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const width = 900;
  const height = 420;
  const data = Buffer.alloc(width * height * 4);
  const bg = hexToRgb("#f8f5ed");
  const primary = hexToRgb(input.organization.primaryColor);
  const accent = hexToRgb(input.organization.accentColor);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const color = y < 86 ? primary : x < 18 ? accent : bg;
      data[idx] = color[0]; data[idx + 1] = color[1]; data[idx + 2] = color[2]; data[idx + 3] = 255;
    }
  }
  writeFileSync(filePath, encodePng(width, height, data));
}

function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    scanlines[y * (width * 4 + 1)] = 0;
    rgba.copy(scanlines, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const chunks = [
    pngChunk("IHDR", Buffer.concat([u32(width), u32(height), Buffer.from([8, 6, 0, 0, 0])])),
    pngChunk("IDAT", deflateSync(scanlines)),
    pngChunk("IEND", Buffer.alloc(0))
  ];
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ...chunks]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type);
  const crc = crc32(Buffer.concat([typeBuffer, data]));
  return Buffer.concat([u32(data.length), typeBuffer, data, u32(crc)]);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0, 0);
  return buffer;
}

function hashFile(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function escapePdf(value: string): string {
  return value.replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7E]/g, "?");
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 80);
}

function formatCents(value: number): string {
  return `${Math.floor(value / 100)},${String(value % 100).padStart(2, "0")}`;
}

function hexToRgb(value: string): [number, number, number] {
  const clean = value.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return [59, 90, 70];
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}
