import ExcelJS from "exceljs";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AppDirectories, ClientChargeDetail, LegalEntity, Organization, BusinessPartner, BusinessPartnerLegalEntity } from "../../../src/shared/types/domain.js";

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
  clientLegalEntity?: BusinessPartnerLegalEntity | null;
  detail: ClientChargeDetail;
}): Promise<ChargeDocumentResult> {
  const number = sanitizeSegment(input.detail.charge.chargeNumber ?? input.detail.charge.id);
  const year = (input.detail.charge.issueDate ?? input.detail.charge.createdAt).slice(0, 4);
  const baseDir = join(input.directories.chargesDir, input.organization.id, input.ownLegalEntity.id, year, number);
  mkdirSync(baseDir, { recursive: true });
  const version = input.detail.documents.length + 1;
  const pdfFilePath = join(baseDir, `cobranca-v${version}.pdf`);
  const excelFilePath = join(baseDir, `cobranca-v${version}.xlsx`);
  const imageBasePath = join(baseDir, `resumo-v${version}`);
  writeFileSync(pdfFilePath, await buildChargePdf(input));
  await writeChargeWorkbook(excelFilePath, input);
  const imageFilePath = await writeSummaryImage(imageBasePath, input);
  return {
    pdfFilePath,
    pdfFileHash: hashFile(pdfFilePath),
    excelFilePath,
    excelFileHash: hashFile(excelFilePath),
    imageFilePath,
    imageFileHash: hashFile(imageFilePath)
  };
}

type PdfColor = ReturnType<typeof rgb>;

async function buildChargePdf(input: { organization: Organization; ownLegalEntity: LegalEntity; client: BusinessPartner; clientLegalEntity?: BusinessPartnerLegalEntity | null; detail: ClientChargeDetail }): Promise<Uint8Array> {
  const { organization, ownLegalEntity, client, clientLegalEntity, detail } = input;
  const { charge } = detail;
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 28;
  const contentWidth = pageWidth - margin * 2;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([pageWidth, pageHeight]);
  const dark = rgb(0.07, 0.055, 0.04);
  const ink = rgb(0.1, 0.08, 0.06);
  const muted = rgb(0.36, 0.32, 0.26);
  const border = rgb(0.73, 0.63, 0.49);
  const soft = rgb(0.965, 0.94, 0.885);
  const paper = rgb(1, 0.99, 0.965);
  const gold = rgb(0.69, 0.49, 0.29);
  const green = rgb(0.035, 0.36, 0.24);
  const headerText = rgb(1, 0.96, 0.88);
  const isGraoBrand = `${organization.slug} ${organization.displayName} ${ownLegalEntity.tradeName}`.toLowerCase().includes("grao");
  const headerColor = isGraoBrand ? rgb(0.015, 0.19, 0.13) : dark;

  page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(0.985, 0.965, 0.925) });
  page.drawRectangle({ x: margin, y: pageHeight - margin - 88, width: contentWidth, height: 88, color: headerColor });
  page.drawRectangle({ x: margin, y: pageHeight - margin - 90, width: contentWidth, height: 2, color: gold });

  const logo = await embedLogo(doc, organization);
  if (logo) {
    const logoBox = fitImage(logo.width, logo.height, 58, 58);
    page.drawImage(logo.image, { x: margin + 12, y: pageHeight - margin - 72, width: logoBox.width, height: logoBox.height });
  }
  const headerX = margin + 82;
  page.drawText("FECHAMENTO DE SERVICOS", { x: headerX, y: pageHeight - margin - 24, size: 14, font: bold, color: headerText });
  page.drawText(ownLegalEntity.tradeName, { x: headerX, y: pageHeight - margin - 42, size: 9, font: bold, color: rgb(0.84, 0.75, 0.63) });
  drawTextBox(page, `${ownLegalEntity.legalName}\nCNPJ: ${formatTaxId(ownLegalEntity.cnpj)}${ownLegalEntity.stateRegistration ? ` | IE: ${ownLegalEntity.stateRegistration}` : ""}`, headerX, pageHeight - margin - 49, 265, 30, { font, bold, size: 7.1, minSize: 5.8, lineHeight: 1.14, maxLines: 2, color: headerText });
  drawRightText(page, `No ${charge.chargeNumber ?? "Rascunho"}`, pageWidth - margin - 145, pageHeight - margin - 24, 130, bold, 13, headerText);
  drawRightText(page, `Emissao: ${formatDate(charge.issueDate ?? charge.createdAt)}`, pageWidth - margin - 145, pageHeight - margin - 42, 130, font, 7, rgb(0.82, 0.76, 0.67));
  drawRightText(page, `Vencimento: ${formatDate(charge.dueDate)}`, pageWidth - margin - 145, pageHeight - margin - 56, 130, font, 7, rgb(0.82, 0.76, 0.67));

  let y = pageHeight - margin - 110;
  const boxGap = 10;
  const boxWidth = (contentWidth - boxGap) / 2;
  drawInfoBox(page, "CLIENTE", clientLines(client, clientLegalEntity), margin, y, boxWidth, 88, { font, bold, ink, muted, border, paper, gold });
  drawInfoBox(page, "PERIODO", [`${formatDate(charge.periodStart)} a ${formatDate(charge.periodEnd)}`, `Periodicidade: ${translatePeriodicity(charge.periodicity)}`], margin + boxWidth + boxGap, y, boxWidth, 88, { font, bold, ink, muted, border, paper, gold });

  y -= 102;
  drawSectionTitle(page, "Operacoes cobradas", margin, y, bold, ink, green);
  y -= 16;
  const tableHeight = 172;
  page.drawRectangle({ x: margin, y: y - tableHeight, width: contentWidth, height: tableHeight, color: paper, borderColor: border, borderWidth: 0.55 });
  const columns = [
    { title: "DATA", x: margin + 8, width: 52 },
    { title: "NF", x: margin + 66, width: 52 },
    { title: "PRODUTO", x: margin + 124, width: 170 },
    { title: "TIPO", x: margin + 300, width: 64 },
    { title: "SACAS", x: margin + 370, width: 52 },
    { title: "R$/SACA", x: margin + 428, width: 52 },
    { title: "TOTAL", x: margin + 486, width: 44 }
  ];
  page.drawRectangle({ x: margin, y: y - 20, width: contentWidth, height: 20, color: soft });
  columns.forEach((column) => page.drawText(column.title, { x: column.x, y: y - 13, size: 6.6, font: bold, color: muted }));
  const rows = detail.operations.slice(0, 8);
  rows.forEach((item, index) => {
    const rowY = y - 33 - index * 20;
    if (index % 2 === 1) page.drawRectangle({ x: margin, y: rowY - 5, width: contentWidth, height: 18, color: rgb(0.985, 0.965, 0.925) });
    page.drawText(formatDate(item.operationDateSnapshot), { x: columns[0].x, y: rowY, size: 7, font, color: ink });
    page.drawText(truncate(item.fiscalDocumentNumberSnapshot ?? "-", font, 7, columns[1].width), { x: columns[1].x, y: rowY, size: 7, font, color: ink });
    page.drawText(truncate(item.productNameSnapshot ?? "-", font, 7, columns[2].width), { x: columns[2].x, y: rowY, size: 7, font, color: ink });
    page.drawText(item.operationScopeSnapshot === "INTERNAL" ? "Interna" : "Externa", { x: columns[3].x, y: rowY, size: 7, font, color: ink });
    drawRightText(page, decimalTextBr(item.quantitySacksDecimalSnapshot), columns[4].x, rowY, columns[4].width, font, 7, ink);
    drawRightText(page, formatCents(item.serviceRateCentsSnapshot), columns[5].x, rowY, columns[5].width, font, 7, ink);
    drawRightText(page, formatCents(item.serviceAmountCentsSnapshot), columns[6].x, rowY, columns[6].width, bold, 7, ink);
  });
  if (detail.operations.length > rows.length) {
    page.drawText(`+ ${detail.operations.length - rows.length} operacao(oes) no Excel anexo`, { x: margin + 8, y: y - tableHeight + 12, size: 7.2, font: bold, color: gold });
  }
  y -= tableHeight + 20;

  const summaryWidth = 250;
  const paymentWidth = contentWidth - summaryWidth - boxGap;
  drawPaymentBox(page, ownLegalEntity, margin, y, paymentWidth, 118, { font, bold, ink, muted, border, paper, gold, green });
  drawTotalsBox(page, detail, margin + paymentWidth + boxGap, y, summaryWidth, 118, { font, bold, ink, muted, border, paper, gold, green });

  y -= 136;
  drawSectionTitle(page, "Ajustes e pagamentos", margin, y, bold, ink, green);
  y -= 16;
  const leftLines = detail.adjustments.length
    ? detail.adjustments.slice(0, 4).map((item) => `${item.effect === "INCREASE_RECEIVABLE" ? "+" : "-"} ${item.description}: R$ ${formatCents(item.amountCents)}`)
    : ["Sem ajustes nesta cobranca."];
  const rightLines = detail.payments.length
    ? detail.payments.slice(0, 4).map((item) => `Pagamento alocado: R$ ${formatCents(item.amountCents)}`)
    : ["Sem pagamentos registrados."];
  drawInfoBox(page, "AJUSTES", leftLines, margin, y, boxWidth, 64, { font, bold, ink, muted, border, paper, gold });
  drawInfoBox(page, "PAGAMENTOS", rightLines, margin + boxWidth + boxGap, y, boxWidth, 64, { font, bold, ink, muted, border, paper, gold });

  page.drawText(`Gerado pelo Sistema de Operacoes de Cafe em ${formatDateTime(new Date().toISOString())}`, { x: margin, y: 22, size: 6.5, font, color: muted });
  page.drawText(`${organization.appDisplayName} | Documento local`, { x: pageWidth - margin - 160, y: 22, size: 6.5, font: bold, color: gold });
  return doc.save();
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

function drawSectionTitle(page: PDFPage, title: string, x: number, topY: number, bold: PDFFont, ink: PdfColor, green: PdfColor): void {
  page.drawRectangle({ x, y: topY - 10, width: 3, height: 10, color: green });
  page.drawText(title, { x: x + 8, y: topY - 8, size: 8.2, font: bold, color: ink });
}

function drawInfoBox(
  page: PDFPage,
  title: string,
  lines: string[],
  x: number,
  topY: number,
  width: number,
  height: number,
  style: { font: PDFFont; bold: PDFFont; ink: PdfColor; muted: PdfColor; border: PdfColor; paper: PdfColor; gold: PdfColor }
): void {
  page.drawRectangle({ x, y: topY - height, width, height, color: style.paper, borderColor: style.border, borderWidth: 0.55 });
  page.drawText(title, { x: x + 8, y: topY - 11, size: 6.6, font: style.bold, color: style.gold });
  drawTextBox(page, lines.join("\n"), x + 8, topY - 18, width - 16, height - 22, { font: style.font, bold: style.bold, size: 6.3, minSize: 4.8, lineHeight: 1.08, maxLines: 5, color: style.ink });
}

function drawPaymentBox(
  page: PDFPage,
  ownLegalEntity: LegalEntity,
  x: number,
  topY: number,
  width: number,
  height: number,
  style: { font: PDFFont; bold: PDFFont; ink: PdfColor; muted: PdfColor; border: PdfColor; paper: PdfColor; gold: PdfColor; green: PdfColor }
): void {
  const bankLines = [
    ownLegalEntity.defaultBankName ? `Banco: ${ownLegalEntity.defaultBankName}${ownLegalEntity.defaultBankCode ? ` (${ownLegalEntity.defaultBankCode})` : ""}` : "Banco: nao informado",
    ownLegalEntity.defaultBankAgency ? `Agencia: ${ownLegalEntity.defaultBankAgency}` : "Agencia: nao informada",
    ownLegalEntity.defaultBankAccount ? `Conta: ${ownLegalEntity.defaultBankAccount}` : "Conta: nao informada",
    ownLegalEntity.defaultPixKey ? `PIX: ${ownLegalEntity.defaultPixKey}` : "PIX: nao informado",
    "Dados podem ser ajustados no cadastro da empresa antes da emissao."
  ];
  page.drawRectangle({ x, y: topY - height, width, height, color: style.paper, borderColor: style.border, borderWidth: 0.55 });
  page.drawText("DADOS PARA PAGAMENTO", { x: x + 10, y: topY - 13, size: 7, font: style.bold, color: style.gold });
  drawTextBox(page, bankLines.join("\n"), x + 10, topY - 24, width - 20, height - 32, { font: style.font, bold: style.bold, size: 7.5, minSize: 5.8, lineHeight: 1.18, maxLines: 5, color: style.ink });
}

function clientLines(client: BusinessPartner, entity?: BusinessPartnerLegalEntity | null): string[] {
  return [entity?.tradeName || client.displayName];
}

function drawTotalsBox(
  page: PDFPage,
  detail: ClientChargeDetail,
  x: number,
  topY: number,
  width: number,
  height: number,
  style: { font: PDFFont; bold: PDFFont; ink: PdfColor; muted: PdfColor; border: PdfColor; paper: PdfColor; gold: PdfColor; green: PdfColor }
): void {
  const { charge } = detail;
  page.drawRectangle({ x, y: topY - height, width, height, color: style.paper, borderColor: style.border, borderWidth: 0.55 });
  page.drawText("RESUMO DA COBRANCA", { x: x + 10, y: topY - 13, size: 7, font: style.bold, color: style.gold });
  const rows = [
    ["Subtotal", charge.subtotalServicesCents],
    ["Acrescimos", charge.additionsCents],
    ["Deducoes", -charge.deductionsCents],
    ["Pago", -charge.paidAmountCents]
  ] as const;
  rows.forEach(([label, amount], index) => {
    const rowY = topY - 30 - index * 14;
    page.drawText(label, { x: x + 10, y: rowY, size: 7.2, font: style.font, color: style.muted });
    drawRightText(page, `R$ ${formatSignedCents(amount)}`, x + width - 102, rowY, 90, style.font, 7.2, style.ink);
  });
  page.drawLine({ start: { x: x + 10, y: topY - 88 }, end: { x: x + width - 10, y: topY - 88 }, thickness: 0.55, color: style.border });
  page.drawText("Total em aberto", { x: x + 10, y: topY - 103, size: 7.4, font: style.bold, color: style.ink });
  drawRightText(page, `R$ ${formatCents(charge.openAmountCents)}`, x + width - 124, topY - 104, 112, style.bold, 12, style.green);
}

async function embedLogo(doc: PDFDocument, organization: Organization): Promise<{ image: Awaited<ReturnType<PDFDocument["embedPng"]>>; width: number; height: number } | null> {
  const logo = resolveBrandingLogoBytes(organization);
  if (!logo) return null;
  try {
    const image = logo.ext === "png" ? await doc.embedPng(logo.bytes) : await doc.embedJpg(logo.bytes);
    return { image, width: image.width, height: image.height };
  } catch {
    return null;
  }
}

function resolveBrandingLogoBytes(organization: Organization): { bytes: Buffer; ext: "png" | "jpeg" } | null {
  if (organization.logoPath?.startsWith("data:")) {
    const match = /^data:image\/(png|jpe?g);base64,(.+)$/.exec(organization.logoPath);
    if (match) return { bytes: Buffer.from(match[2], "base64"), ext: match[1] === "png" ? "png" : "jpeg" };
  } else if (organization.logoPath && existsSync(organization.logoPath)) {
    const ext = extname(organization.logoPath).replace(".", "").toLowerCase();
    if (ext === "png" || ext === "jpg" || ext === "jpeg") return { bytes: readFileSync(organization.logoPath), ext: ext === "png" ? "png" : "jpeg" };
  }
  const name = `${organization.slug} ${organization.displayName} ${organization.appDisplayName}`.toLowerCase();
  const variant = name.includes("villa") ? "villa" : name.includes("grao") || name.includes("grão") ? "grao" : null;
  if (!variant) return null;
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const appRoot = join(moduleDir, "..", "..", "..", "..");
  const candidates = [join(appRoot, "dist", "assets", "branding", variant, "logo.png"), join(appRoot, "public", "assets", "branding", variant, "logo.png")];
  const found = candidates.find((candidate) => existsSync(candidate));
  return found ? { bytes: readFileSync(found), ext: "png" } : null;
}

function fitImage(width: number, height: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
  const ratio = Math.min(maxWidth / width, maxHeight / height);
  return { width: width * ratio, height: height * ratio };
}

function drawTextBox(page: PDFPage, value: string, x: number, topY: number, width: number, height: number, options: { font: PDFFont; bold?: PDFFont; size: number; minSize: number; lineHeight: number; maxLines: number; color: PdfColor }): number {
  let size = options.size;
  let lines = wrapText(value, options.bold ?? options.font, size, width).slice(0, options.maxLines);
  while ((lines.length * size * options.lineHeight > height || lines.some((line) => (options.bold ?? options.font).widthOfTextAtSize(line, size) > width)) && size > options.minSize) {
    size -= 0.2;
    lines = wrapText(value, options.bold ?? options.font, size, width).slice(0, options.maxLines);
  }
  lines.forEach((line, index) => {
    const usedFont = index === 0 && options.bold ? options.bold : options.font;
    page.drawText(truncate(line, usedFont, size, width), { x, y: topY - size - index * size * options.lineHeight, size, font: usedFont, color: options.color });
  });
  return topY - lines.length * size * options.lineHeight;
}

function drawRightText(page: PDFPage, value: string, x: number, y: number, width: number, usedFont: PDFFont, size: number, color: PdfColor): void {
  const label = truncate(value, usedFont, size, width);
  page.drawText(label, { x: x + width - usedFont.widthOfTextAtSize(label, size), y, size, font: usedFont, color });
}

function wrapText(value: string, usedFont: PDFFont, size: number, maxWidth: number): string[] {
  const result: string[] = [];
  value.split(/\r?\n/).forEach((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      result.push("");
      return;
    }
    let line = "";
    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (usedFont.widthOfTextAtSize(next, size) <= maxWidth) {
        line = next;
      } else {
        if (line) result.push(line);
        line = word;
      }
    });
    if (line) result.push(line);
  });
  return result;
}

async function writeSummaryImage(basePath: string, input: { organization: Organization; client: BusinessPartner; detail: ClientChargeDetail }): Promise<string> {
  mkdirSync(dirname(basePath), { recursive: true });
  const svg = buildSummarySvg(input);
  if (process.versions.electron) {
    try {
      const { BrowserWindow } = await import("electron");
      const pngPath = `${basePath}.png`;
      const win = new BrowserWindow({
        show: false,
        width: 900,
        height: 420,
        backgroundColor: "#f8f5ed",
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true
        }
      });
      try {
        const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:900px;height:420px;overflow:hidden;background:#f8f5ed}</style></head><body>${svg}</body></html>`;
        await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        const image = await win.capturePage({ x: 0, y: 0, width: 900, height: 420 });
        writeFileSync(pngPath, image.toPNG());
        return pngPath;
      } finally {
        win.destroy();
      }
    } catch {
      // In tests or restricted environments, keep an SVG fallback so document generation still completes.
    }
  }
  const svgPath = `${basePath}.svg`;
  writeFileSync(svgPath, svg, "utf8");
  return svgPath;
}

function buildSummarySvg(input: { organization: Organization; client: BusinessPartner; detail: ClientChargeDetail }): string {
  const width = 900;
  const height = 420;
  const primary = safeHexColor(input.organization.primaryColor, "#17130f");
  const accent = safeHexColor(input.organization.accentColor, "#1d7a4c");
  const charge = input.detail.charge;
  const rows = input.detail.operations.slice(0, 5);
  const rowMarkup = rows.map((item, index) => {
    const y = 266 + index * 28;
    return `
      <text x="48" y="${y}" class="cell">${escapeXml(formatDate(item.operationDateSnapshot))}</text>
      <text x="150" y="${y}" class="cell">${escapeXml(item.fiscalDocumentNumberSnapshot ?? "-")}</text>
      <text x="248" y="${y}" class="cell">${escapeXml(clipText(item.productNameSnapshot ?? "-", 34))}</text>
      <text x="540" y="${y}" class="cell">${item.operationScopeSnapshot === "INTERNAL" ? "Interna" : "Externa"}</text>
      <text x="662" y="${y}" class="cell right">${escapeXml(decimalTextBr(item.quantitySacksDecimalSnapshot))}</text>
      <text x="805" y="${y}" class="cell right">R$ ${escapeXml(formatCents(item.serviceAmountCentsSnapshot))}</text>
    `;
  }).join("");
  const emptyRows = rows.length === 0 ? `<text x="48" y="266" class="cell">Nenhuma operacao vinculada a esta cobranca.</text>` : "";
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    .title{font:700 25px Arial,sans-serif;fill:#fff8ec}
    .sub{font:700 14px Arial,sans-serif;fill:#d9c6a8}
    .muted{font:12px Arial,sans-serif;fill:#6e6253}
    .label{font:700 12px Arial,sans-serif;fill:#9a7044;text-transform:uppercase}
    .value{font:700 20px Arial,sans-serif;fill:#17130f}
    .cell{font:13px Arial,sans-serif;fill:#17130f}
    .head{font:700 12px Arial,sans-serif;fill:#5d5144}
    .charge-number{font:700 24px Arial,sans-serif;fill:#fff8ec;text-anchor:end}
    .charge-date{font:700 13px Arial,sans-serif;fill:#d9c6a8;text-anchor:end}
    .right{text-anchor:end}
  </style>
  <rect width="900" height="420" fill="#f8f5ed"/>
  <rect x="0" y="0" width="900" height="88" fill="${primary}"/>
  <rect x="0" y="88" width="900" height="4" fill="${accent}"/>
  <text x="34" y="38" class="title">FECHAMENTO DE SERVICOS</text>
  <text x="34" y="64" class="sub">${escapeXml(clipText(input.organization.appDisplayName, 52))}</text>
  <text x="866" y="38" class="charge-number">No ${escapeXml(charge.chargeNumber ?? "Rascunho")}</text>
  <text x="866" y="63" class="charge-date">Vencimento: ${escapeXml(formatDate(charge.dueDate))}</text>

  <rect x="34" y="118" width="396" height="58" rx="8" fill="#fffdf8" stroke="#cbb895"/>
  <text x="52" y="142" class="label">Cliente</text>
  <text x="52" y="166" class="value">${escapeXml(clipText(input.client.displayName, 31))}</text>

  <rect x="452" y="118" width="414" height="58" rx="8" fill="#fffdf8" stroke="#cbb895"/>
  <text x="470" y="142" class="label">Periodo</text>
  <text x="470" y="166" class="value">${escapeXml(formatDate(charge.periodStart))} a ${escapeXml(formatDate(charge.periodEnd))}</text>

  <text x="34" y="202" class="label">Operacoes cobradas</text>
  <rect x="34" y="216" width="832" height="1" fill="#d8c8aa"/>
  <text x="48" y="236" class="head">DATA</text>
  <text x="150" y="236" class="head">NF</text>
  <text x="248" y="236" class="head">PRODUTO</text>
  <text x="540" y="236" class="head">TIPO</text>
  <text x="662" y="236" class="head right">SACAS</text>
  <text x="805" y="236" class="head right">SERVICO</text>
  ${rowMarkup}
  ${emptyRows}

  <rect x="34" y="350" width="832" height="48" rx="8" fill="#edf7ed" stroke="${accent}"/>
  <text x="52" y="381" class="label">Valor final a cobrar</text>
  <text x="805" y="383" class="value right">R$ ${escapeXml(formatCents(charge.finalAmountCents))}</text>
</svg>`;
  return svg;
}

function hashFile(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 80);
}

function formatCents(value: number): string {
  const abs = Math.abs(value);
  return `${Math.floor(abs / 100).toLocaleString("pt-BR")},${String(abs % 100).padStart(2, "0")}`;
}

function formatSignedCents(value: number): string {
  if (value < 0) return `- ${formatCents(value)}`;
  return formatCents(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatDateTime(value: string): string {
  const date = formatDate(value);
  const time = /T(\d{2}):(\d{2})/.exec(value);
  return time ? `${date} ${time[1]}:${time[2]}` : date;
}

function formatTaxId(value: string | null | undefined): string {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length !== 14) return value ?? "-";
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function decimalTextBr(value: string): string {
  return value.replace(".", ",");
}

function translatePeriodicity(value: string): string {
  const labels: Record<string, string> = {
    WEEKLY: "Semanal",
    BIWEEKLY: "Quinzenal",
    MONTHLY: "Mensal",
    QUARTERLY: "Trimestral",
    CUSTOM: "Personalizada"
  };
  return labels[value] ?? value;
}

function truncate(value: string, usedFont: PDFFont, size: number, maxWidth: number): string {
  if (usedFont.widthOfTextAtSize(value, size) <= maxWidth) return value;
  let text = value;
  while (text.length > 1 && usedFont.widthOfTextAtSize(`${text}...`, size) > maxWidth) {
    text = text.slice(0, -1);
  }
  return `${text}...`;
}

function safeHexColor(value: string | null | undefined, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value ?? "") ? String(value) : fallback;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clipText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(1, maxLength - 3))}...`;
}
