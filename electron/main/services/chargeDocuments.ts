import ExcelJS from "exceljs";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AppDirectories, ClientChargeDetail, LegalEntity, Organization, BusinessPartner, BusinessPartnerLegalEntity } from "../../../src/shared/types/domain.js";
import { formatOperationScope } from "../../../src/shared/utils/operationLabels.js";

export interface ChargeDocumentResult {
  pdfFilePath: string;
  pdfFileHash: string;
  excelFilePath: string;
  excelFileHash: string;
  imageFilePath: string;
  imageFileHash: string;
}

type ChargeDocumentsInput = {
  directories: AppDirectories;
  organization: Organization;
  ownLegalEntity: LegalEntity;
  client: BusinessPartner;
  clientLegalEntity?: BusinessPartnerLegalEntity | null;
  detail: ClientChargeDetail;
  relatedOpenChargeDetails?: ClientChargeDetail[];
};

type ChargeOperationSnapshot = ClientChargeDetail["operations"][number];
type ChargeAdjustmentSnapshot = ClientChargeDetail["adjustments"][number];

function chargeOperationCompanyName(operation: ChargeOperationSnapshot): string {
  return operation.destinationNameSnapshot?.trim()
    || operation.issuerNameSnapshot?.trim()
    || operation.ownLegalEntityNameSnapshot?.trim()
    || "-";
}

function chargeAdjustmentLine(adjustment: ChargeAdjustmentSnapshot): string {
  const sign = adjustment.effect === "INCREASE_RECEIVABLE" ? "+" : "-";
  const dateText = adjustment.ledgerEntryDate ? `${formatDate(adjustment.ledgerEntryDate)} - ` : "";
  return `${sign} ${dateText}${adjustment.description}: R$ ${formatCents(adjustment.amountCents)}`;
}

export async function generateChargeDocuments(input: ChargeDocumentsInput): Promise<ChargeDocumentResult> {
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
const SUMMARY_IMAGE_WIDTH = 1100;

async function buildChargePdf(input: ChargeDocumentsInput): Promise<Uint8Array> {
  const { organization, ownLegalEntity, client, clientLegalEntity, detail } = input;
  const { charge } = detail;
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 28;
  const contentWidth = pageWidth - margin * 2;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([pageWidth, pageHeight]);
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
  const chargeCount = 1 + (input.relatedOpenChargeDetails?.length ?? 0);
  const totalOpenCents = [detail, ...(input.relatedOpenChargeDetails ?? [])].reduce((total, item) => total + item.charge.openAmountCents, 0);
  drawSectionTitle(page, chargeCount > 1 ? `Operacoes em ${chargeCount} cobrancas abertas` : "Operacoes cobradas", margin, y, bold, ink, green);
  y -= 16;
  const sections = summaryImageSections(input);
  const columns = [
    { title: "COBRANCA", x: margin + 8, width: 68 },
    { title: "NF", x: margin + 84, width: 38 },
    { title: "EMPRESA", x: margin + 130, width: 178 },
    { title: "UF", x: margin + 318, width: 60 },
    { title: "SACAS", x: margin + 390, width: 48 },
    { title: "VALOR", x: margin + 452, width: 78 }
  ];
  ({ page, y } = drawChargeOperationSectionsPdf(doc, page, sections, columns, margin, y, contentWidth, {
    font,
    bold,
    ink,
    muted,
    soft,
    paper,
    border,
    gold,
    green
  }));
  y -= 20;

  if (y < 238) {
    page = addChargeContinuationPage(doc, pageWidth, pageHeight, margin, contentWidth, headerColor, gold, bold, headerText);
    y = pageHeight - margin - 70;
  }

  const summaryWidth = 250;
  const paymentWidth = contentWidth - summaryWidth - boxGap;
  drawPaymentBox(page, ownLegalEntity, margin, y, paymentWidth, 118, { font, bold, ink, muted, border, paper, gold, green });
  drawTotalsBox(page, detail, margin + paymentWidth + boxGap, y, summaryWidth, 118, { font, bold, ink, muted, border, paper, gold, green }, { chargeCount, totalOpenCents });

  y -= 136;
  drawSectionTitle(page, "Ajustes e pagamentos", margin, y, bold, ink, green);
  y -= 16;
  const leftLines = detail.adjustments.length
    ? detail.adjustments.slice(0, 4).map(chargeAdjustmentLine)
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
  operations.addRow(["Empresa", "Data", "NF", "Serie", "Produto", "UF da venda", "Sacas", "R$/saca", "Total"]);
  input.detail.operations.forEach((item) => operations.addRow([chargeOperationCompanyName(item), item.operationDateSnapshot, item.fiscalDocumentNumberSnapshot, item.fiscalDocumentSeriesSnapshot, item.productNameSnapshot, formatOperationScope(item.operationScopeSnapshot), item.quantitySacksDecimalSnapshot, item.serviceRateCentsSnapshot / 100, item.serviceAmountCentsSnapshot / 100]));
  const adjustments = workbook.addWorksheet("Ajustes");
  adjustments.addRow(["Data", "Tipo", "Descricao", "Efeito", "Valor"]);
  input.detail.adjustments.forEach((item) => adjustments.addRow([item.ledgerEntryDate ?? "", item.adjustmentType, item.description, item.effect, item.amountCents / 100]));
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

function addChargeContinuationPage(
  doc: PDFDocument,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  contentWidth: number,
  headerColor: PdfColor,
  gold: PdfColor,
  bold: PDFFont,
  headerText: PdfColor
): PDFPage {
  const page = doc.addPage([pageWidth, pageHeight]);
  page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(0.985, 0.965, 0.925) });
  page.drawRectangle({ x: margin, y: pageHeight - margin - 36, width: contentWidth, height: 36, color: headerColor });
  page.drawRectangle({ x: margin, y: pageHeight - margin - 38, width: contentWidth, height: 2, color: gold });
  page.drawText("FECHAMENTO DE SERVICOS - CONTINUACAO", { x: margin + 12, y: pageHeight - margin - 23, size: 10, font: bold, color: headerText });
  return page;
}

function drawChargeOperationSectionsPdf(
  doc: PDFDocument,
  page: PDFPage,
  sections: SummarySection[],
  columns: Array<{ title: string; x: number; width: number }>,
  margin: number,
  startY: number,
  contentWidth: number,
  style: { font: PDFFont; bold: PDFFont; ink: PdfColor; muted: PdfColor; soft: PdfColor; paper: PdfColor; border: PdfColor; gold: PdfColor; green: PdfColor }
): { page: PDFPage; y: number } {
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const bottomY = 54;
  let currentPage = page;
  let cursorY = startY;

  const drawHeader = () => {
    currentPage.drawRectangle({ x: margin, y: cursorY - 20, width: contentWidth, height: 20, color: style.soft, borderColor: style.border, borderWidth: 0.45 });
    columns.forEach((column) => currentPage.drawText(column.title, { x: column.x, y: cursorY - 13, size: 6.5, font: style.bold, color: style.muted }));
    cursorY -= 32;
  };

  const ensureSpace = (height: number) => {
    if (cursorY - height >= bottomY) return;
    currentPage = addChargeContinuationPage(doc, pageWidth, pageHeight, margin, contentWidth, rgb(0.07, 0.055, 0.04), style.gold, style.bold, rgb(1, 0.96, 0.88));
    cursorY = pageHeight - margin - 56;
    drawHeader();
  };

  drawHeader();
  if (sections.length === 0) {
    currentPage.drawRectangle({ x: margin, y: cursorY - 22, width: contentWidth, height: 34, color: style.paper, borderColor: style.border, borderWidth: 0.45 });
    currentPage.drawText("Nenhuma operacao vinculada a esta cobranca.", { x: margin + 8, y: cursorY - 4, size: 6.8, font: style.font, color: style.ink });
    return { page: currentPage, y: cursorY - 34 };
  }

  sections.forEach((section) => {
    ensureSpace(35);
    currentPage.drawRectangle({ x: margin + 4, y: cursorY - 5, width: contentWidth - 8, height: 13, color: style.soft });
    currentPage.drawText(truncate(section.title, style.bold, 6.8, contentWidth - 20), { x: margin + 10, y: cursorY - 1, size: 6.8, font: style.bold, color: style.ink });
    cursorY -= 13;

    section.rows.forEach((row) => {
      ensureSpace(15);
      const item = row.operation;
      const companyName = chargeOperationCompanyName(item);
      const brandColors = chargeBrandPdfColors(companyName);
      if (brandColors) {
        currentPage.drawRectangle({ x: margin + 4, y: cursorY - 4, width: contentWidth - 8, height: 11, color: brandColors.background });
        currentPage.drawRectangle({ x: margin + 4, y: cursorY - 4, width: 2.2, height: 11, color: brandColors.stripe });
      }
      currentPage.drawText(truncate(row.chargeNumber, style.font, 5.8, columns[0].width), { x: columns[0].x, y: cursorY, size: 5.8, font: style.font, color: style.ink });
      currentPage.drawText(truncate(item.fiscalDocumentNumberSnapshot ?? "-", style.font, 5.8, columns[1].width), { x: columns[1].x, y: cursorY, size: 5.8, font: style.font, color: style.ink });
      currentPage.drawText(truncate(companyName, style.font, 5.8, columns[2].width), { x: columns[2].x, y: cursorY, size: 5.8, font: style.font, color: style.ink });
      currentPage.drawText(formatOperationScope(item.operationScopeSnapshot), { x: columns[3].x, y: cursorY, size: 5.8, font: style.font, color: style.ink });
      drawRightText(currentPage, decimalTextBr(item.quantitySacksDecimalSnapshot), columns[4].x, cursorY, columns[4].width, style.font, 5.8, style.ink);
      drawRightText(currentPage, `R$ ${formatCents(item.serviceAmountCentsSnapshot)} x NF ${item.fiscalDocumentNumberSnapshot ?? "-"}`, columns[5].x, cursorY, columns[5].width, style.bold, 5.8, style.ink);
      cursorY -= 12;
    });

    ensureSpace(18);
    const subtotalY = cursorY - 1;
    currentPage.drawText(`TOTAL SACAS: ${decimalTextBr(formatDecimal(section.sacks))}`, { x: columns[3].x, y: subtotalY, size: 5.8, font: style.bold, color: style.gold });
    currentPage.drawText(`R$ ${formatCents(section.rateCents)}/saca`, { x: columns[4].x - 12, y: subtotalY, size: 5.8, font: style.bold, color: style.gold });
    drawRightText(currentPage, `R$ ${formatCents(section.amountCents)}`, columns[5].x, subtotalY, columns[5].width, style.bold, 5.8, style.ink);
    cursorY -= 15;
  });
  return { page: currentPage, y: cursorY };
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
  style: { font: PDFFont; bold: PDFFont; ink: PdfColor; muted: PdfColor; border: PdfColor; paper: PdfColor; gold: PdfColor; green: PdfColor },
  combined?: { chargeCount: number; totalOpenCents: number }
): void {
  const { charge } = detail;
  const openAmountCents = combined && combined.chargeCount > 1 ? combined.totalOpenCents : charge.openAmountCents;
  page.drawRectangle({ x, y: topY - height, width, height, color: style.paper, borderColor: style.border, borderWidth: 0.55 });
  page.drawText("RESUMO DA COBRANCA", { x: x + 10, y: topY - 13, size: 7, font: style.bold, color: style.gold });
  const rows = [
    ["Subtotal", charge.subtotalServicesCents],
    ["Acrescimos", charge.additionsCents],
    ["Deducoes", -charge.deductionsCents],
    combined && combined.chargeCount > 1 ? ["Outras abertas", Math.max(0, combined.totalOpenCents - charge.openAmountCents)] : ["Pago", -charge.paidAmountCents]
  ] as Array<readonly [string, number]>;
  rows.forEach(([label, amount], index) => {
    const rowY = topY - 30 - index * 14;
    page.drawText(label, { x: x + 10, y: rowY, size: 7.2, font: style.font, color: style.muted });
    drawRightText(page, `R$ ${formatSignedCents(amount)}`, x + width - 102, rowY, 90, style.font, 7.2, style.ink);
  });
  page.drawLine({ start: { x: x + 10, y: topY - 88 }, end: { x: x + width - 10, y: topY - 88 }, thickness: 0.55, color: style.border });
  page.drawText(combined && combined.chargeCount > 1 ? "Total aberto geral" : "Total em aberto", { x: x + 10, y: topY - 103, size: 7.4, font: style.bold, color: style.ink });
  drawRightText(page, `R$ ${formatCents(openAmountCents)}`, x + width - 124, topY - 104, 112, style.bold, 12, style.green);
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

function chargeBrandKey(value: string | null | undefined): "grao" | "villa" | "thirdParty" | null {
  const normalized = (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (!normalized.trim()) return null;
  if (normalized.includes("grao")) return "grao";
  if (normalized.includes("villa")) return "villa";
  return "thirdParty";
}

function chargeBrandPdfColors(value: string | null | undefined): { background: PdfColor; stripe: PdfColor } | null {
  const key = chargeBrandKey(value);
  if (key === "grao") return { background: rgb(0.93, 0.975, 0.94), stripe: rgb(0.16, 0.55, 0.35) };
  if (key === "villa") return { background: rgb(0.985, 0.935, 0.86), stripe: rgb(0.61, 0.42, 0.24) };
  if (key === "thirdParty") return { background: rgb(0.92, 0.95, 0.98), stripe: rgb(0.28, 0.43, 0.62) };
  return null;
}

function chargeBrandSvgColors(value: string | null | undefined): { background: string; stripe: string } | null {
  const key = chargeBrandKey(value);
  if (key === "grao") return { background: "#eaf7ee", stripe: "#2a8f5a" };
  if (key === "villa") return { background: "#f7ecdd", stripe: "#9b6b3c" };
  if (key === "thirdParty") return { background: "#eaf1f8", stripe: "#476f9f" };
  return null;
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

async function writeSummaryImage(basePath: string, input: ChargeDocumentsInput): Promise<string> {
  mkdirSync(dirname(basePath), { recursive: true });
  const svg = buildSummarySvg(input);
  const height = summaryImageHeight(input);
  if (process.versions.electron) {
    try {
      const { BrowserWindow } = await import("electron");
      const pngPath = `${basePath}.png`;
      const win = new BrowserWindow({
        show: false,
        width: SUMMARY_IMAGE_WIDTH,
        height,
        backgroundColor: "#f8f5ed",
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true
        }
      });
      try {
        const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:${SUMMARY_IMAGE_WIDTH}px;height:${height}px;overflow:hidden;background:#f8f5ed}</style></head><body>${svg}</body></html>`;
        await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        const image = await win.capturePage({ x: 0, y: 0, width: SUMMARY_IMAGE_WIDTH, height });
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

type SummaryOperationRow = {
  chargeNumber: string;
  operation: ClientChargeDetail["operations"][number];
};

type SummarySection = {
  title: string;
  rows: SummaryOperationRow[];
  sacks: number;
  amountCents: number;
  rateCents: number;
  scope: "INTERNAL" | "EXTERNAL";
};

function summaryImageOperationRows(input: ChargeDocumentsInput): SummaryOperationRow[] {
  return [input.detail, ...(input.relatedOpenChargeDetails ?? [])].flatMap((detail) =>
    detail.operations.map((operation) => ({
      chargeNumber: detail.charge.chargeNumber ?? "Rascunho",
      operation
    }))
  );
}

function summaryImageHeight(input: ChargeDocumentsInput): number {
  const sections = summaryImageSections(input);
  const visualRows = sections.reduce((sum, section) => sum + 2 + section.rows.length, 0);
  return Math.max(620, 370 + Math.max(visualRows, 1) * 27 + 150);
}

function buildSummarySvg(input: ChargeDocumentsInput): string {
  const width = SUMMARY_IMAGE_WIDTH;
  const height = summaryImageHeight(input);
  const innerX = 34;
  const innerWidth = width - innerX * 2;
  const rightX = width - 48;
  const primary = safeHexColor(input.organization.primaryColor, "#17130f");
  const accent = safeHexColor(input.organization.accentColor, "#1d7a4c");
  const charge = input.detail.charge;
  const sections = summaryImageSections(input);
  const totalOpenCents = [input.detail, ...(input.relatedOpenChargeDetails ?? [])].reduce((sum, detail) => sum + detail.charge.openAmountCents, 0);
  const chargeCount = 1 + (input.relatedOpenChargeDetails?.length ?? 0);
  let cursorY = 256;
  const sectionMarkup = sections.map((section) => {
    const sectionY = cursorY;
    cursorY += 25;
    const rowsMarkup = section.rows.map((item) => {
      const y = cursorY;
      cursorY += 25;
      const operation = item.operation;
      const companyName = chargeOperationCompanyName(operation);
      const brandColors = chargeBrandSvgColors(companyName);
      const rowBackground = brandColors
        ? `<rect x="${innerX}" y="${y - 16}" width="${innerWidth}" height="22" rx="3" fill="${brandColors.background}"/><rect x="${innerX}" y="${y - 16}" width="4" height="22" rx="2" fill="${brandColors.stripe}"/>`
        : "";
      return `
      ${rowBackground}
      <text x="48" y="${y}" class="cell">${escapeXml(clipText(item.chargeNumber, 15))}</text>
      <text x="166" y="${y}" class="cell">${escapeXml(operation.fiscalDocumentNumberSnapshot ?? "-")}</text>
      <text x="236" y="${y}" class="cell">${escapeXml(clipText(companyName, 46))}</text>
      <text x="622" y="${y}" class="cell">${escapeXml(formatOperationScope(operation.operationScopeSnapshot))}</text>
      <text x="760" y="${y}" class="cell right">${escapeXml(decimalTextBr(operation.quantitySacksDecimalSnapshot))}</text>
      <text x="${rightX}" y="${y}" class="cell right">R$ ${escapeXml(formatCents(operation.serviceAmountCentsSnapshot))} x NF ${escapeXml(operation.fiscalDocumentNumberSnapshot ?? "-")}</text>
    `;
    }).join("");
    const subtotalY = cursorY + 3;
    cursorY += 30;
    return `
      <rect x="${innerX}" y="${sectionY - 17}" width="${innerWidth}" height="22" rx="5" fill="#efe5d2"/>
      <text x="48" y="${sectionY}" class="section">${escapeXml(section.title)}</text>
      ${rowsMarkup}
      <text x="622" y="${subtotalY}" class="subtotal-label">TOTAL SACAS: ${escapeXml(decimalTextBr(formatDecimal(section.sacks)))}</text>
      <text x="760" y="${subtotalY}" class="subtotal-label right">R$ ${escapeXml(formatCents(section.rateCents))}/saca</text>
      <text x="${rightX}" y="${subtotalY}" class="subtotal right">R$ ${escapeXml(formatCents(section.amountCents))}</text>
    `;
  }).join("");
  const emptyRows = sections.length === 0 ? `<text x="48" y="266" class="cell">Nenhuma operacao vinculada a esta cobranca.</text>` : "";
  const tableFooterY = sections.length ? cursorY : 292;
  const totalBoxY = tableFooterY + 16;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    .title{font:700 25px Arial,sans-serif;fill:#fff8ec}
    .sub{font:700 14px Arial,sans-serif;fill:#d9c6a8}
    .muted{font:12px Arial,sans-serif;fill:#6e6253}
    .label{font:700 12px Arial,sans-serif;fill:#9a7044;text-transform:uppercase}
    .value{font:700 20px Arial,sans-serif;fill:#17130f}
    .cell{font:12px Arial,sans-serif;fill:#17130f}
    .head{font:700 12px Arial,sans-serif;fill:#5d5144}
    .section{font:700 13px Arial,sans-serif;fill:#17130f}
    .subtotal{font:700 12px Arial,sans-serif;fill:#17130f}
    .subtotal-label{font:700 11px Arial,sans-serif;fill:#9a7044}
    .charge-number{font:700 24px Arial,sans-serif;fill:#fff8ec;text-anchor:end}
    .charge-date{font:700 13px Arial,sans-serif;fill:#d9c6a8;text-anchor:end}
    .right{text-anchor:end}
  </style>
  <rect width="${width}" height="${height}" fill="#f8f5ed"/>
  <rect x="0" y="0" width="${width}" height="88" fill="${primary}"/>
  <rect x="0" y="88" width="${width}" height="4" fill="${accent}"/>
  <text x="34" y="38" class="title">FECHAMENTO DE SERVICOS</text>
  <text x="34" y="64" class="sub">${escapeXml(clipText(input.organization.appDisplayName, 52))}</text>
  <text x="${rightX}" y="38" class="charge-number">No ${escapeXml(charge.chargeNumber ?? "Rascunho")}</text>
  <text x="${rightX}" y="63" class="charge-date">Vencimento: ${escapeXml(formatDate(charge.dueDate))}</text>

  <rect x="34" y="118" width="486" height="58" rx="8" fill="#fffdf8" stroke="#cbb895"/>
  <text x="52" y="142" class="label">Cliente</text>
  <text x="52" y="166" class="value">${escapeXml(clipText(input.client.displayName, 40))}</text>

  <rect x="546" y="118" width="${width - 580}" height="58" rx="8" fill="#fffdf8" stroke="#cbb895"/>
  <text x="564" y="142" class="label">Periodo</text>
  <text x="564" y="166" class="value">${escapeXml(formatDate(charge.periodStart))} a ${escapeXml(formatDate(charge.periodEnd))}</text>

  <text x="34" y="202" class="label">${chargeCount > 1 ? `Operacoes em ${chargeCount} cobrancas abertas` : "Operacoes cobradas"}</text>
  <rect x="${innerX}" y="216" width="${innerWidth}" height="1" fill="#d8c8aa"/>
  <text x="48" y="236" class="head">COBRANCA</text>
  <text x="166" y="236" class="head">NF</text>
  <text x="236" y="236" class="head">EMPRESA</text>
  <text x="622" y="236" class="head">UF DA VENDA</text>
  <text x="760" y="236" class="head right">SACAS</text>
  <text x="${rightX}" y="236" class="head right">VALOR X NF</text>
  ${sectionMarkup}
  ${emptyRows}

  <rect x="${innerX}" y="${totalBoxY}" width="${innerWidth}" height="58" rx="8" fill="#edf7ed" stroke="${accent}"/>
  <text x="52" y="${totalBoxY + 21}" class="label">${chargeCount > 1 ? "Valor total em aberto" : charge.paidAmountCents > 0 ? "Valor em aberto" : "Valor final a cobrar"}</text>
  ${chargeCount > 1 ? `<text x="52" y="${totalBoxY + 42}" class="muted">Inclui a cobranca atual e outras cobrancas abertas do mesmo cliente no periodo.</text>` : charge.paidAmountCents > 0 ? `<text x="52" y="${totalBoxY + 42}" class="muted">Pago: R$ ${escapeXml(formatCents(charge.paidAmountCents))} de R$ ${escapeXml(formatCents(charge.finalAmountCents))}</text>` : ""}
  <text x="${rightX}" y="${totalBoxY + 35}" class="value right">R$ ${escapeXml(formatCents(totalOpenCents))}</text>
</svg>`;
  return svg;
}

function summaryImageSections(input: ChargeDocumentsInput): SummarySection[] {
  const clientShort = clientShortName(input.client.displayName);
  const sections = new Map<string, SummarySection>();
  for (const row of summaryImageOperationRows(input)) {
    const operation = row.operation;
    const key = `${operation.operationScopeSnapshot}|${operation.serviceRateCentsSnapshot}`;
    if (!sections.has(key)) {
      const scopeText = operation.operationScopeSnapshot === "INTERNAL" ? "INTERNO" : "EXTERNO";
      sections.set(key, { title: `${clientShort} ${scopeText}`, rows: [], sacks: 0, amountCents: 0, rateCents: operation.serviceRateCentsSnapshot, scope: operation.operationScopeSnapshot });
    }
    const section = sections.get(key);
    if (!section) continue;
    section.rows.push(row);
    section.sacks += decimalNumber(operation.quantitySacksDecimalSnapshot);
    section.amountCents += operation.serviceAmountCentsSnapshot;
  }
  const rawSections = Array.from(sections.values());
  const defaultInternalRateCents = Math.max(0, ...rawSections.filter((section) => section.scope === "INTERNAL").map((section) => section.rateCents));
  return rawSections.map((section) => {
    const scopeText = section.scope === "INTERNAL" ? "INTERNO" : "EXTERNO";
    const destinations = Array.from(new Set(section.rows.map((row) => chargeOperationCompanyName(row.operation).trim()).filter((value) => value && value !== "-")));
    if (section.scope === "INTERNAL") {
      if (destinations.length === 1 && section.rateCents !== defaultInternalRateCents) {
        return {
          ...section,
          title: `${clientShort} ${destinationShortName(destinations[0])}`
        };
      }
      return {
        ...section,
        title: `${clientShort} ${scopeText}`
      };
    }
    return {
      ...section,
      title: destinations.length === 1 ? `${clientShort} VENDAS ${destinations[0].toUpperCase()}` : `${clientShort} ${scopeText}`
    };
  }).sort((a, b) => sectionRank(a.title) - sectionRank(b.title) || a.title.localeCompare(b.title, "pt-BR"));
}

function sectionRank(title: string): number {
  if (title.includes("INTERNO")) return 0;
  if (title.includes("VENDAS")) return 1;
  if (title.includes("EXTERNO")) return 2;
  return 3;
}

function clientShortName(value: string): string {
  const first = value.trim().split(/\s+/)[0];
  return first ? first.toUpperCase() : "CLIENTE";
}

function destinationShortName(value: string): string {
  const first = value.trim().split(/\s+/)[0];
  return first ? first.toUpperCase() : value.toUpperCase();
}

function decimalNumber(value: string): number {
  return Number(value.replace(",", ".")) || 0;
}

function formatDecimal(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 6 });
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
