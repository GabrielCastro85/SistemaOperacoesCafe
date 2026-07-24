import ExcelJS from "exceljs";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AccountPayable,
  AppDirectories,
  BusinessPartner,
  CostCenter,
  ExpenseCategory,
  FinancialReportFilters,
  FinancialReportFormat,
  FinancialReportPreview,
  FinancialReportType,
  LegalEntity,
  Location,
  Organization,
  PayablePayment
} from "../../../src/shared/types/domain.js";

export const PAYABLE_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;
const allowedExtensions = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp"]);

export interface StoredPayableAttachment {
  originalFileName: string;
  storedFilePath: string;
  fileHash: string;
  mimeType: string;
  fileExtension: string;
  fileSize: number;
}

export function storePayableAttachment(input: {
  sourcePath: string;
  directories: AppDirectories;
  organizationId: string;
  ownLegalEntityId: string;
  accountPayableId: string;
  payablePaymentId?: string | null;
  attachmentId: string;
}): StoredPayableAttachment {
  if (!existsSync(input.sourcePath)) throw new Error("Arquivo nao encontrado.");
  const stats = statSync(input.sourcePath);
  if (!stats.isFile()) throw new Error("Selecao nao e um arquivo.");
  if (stats.size <= 0) throw new Error("Arquivo vazio nao pode ser anexado.");
  if (stats.size > PAYABLE_ATTACHMENT_MAX_BYTES) throw new Error("Arquivo acima do limite de 15 MB.");
  const extension = extname(input.sourcePath).toLowerCase();
  if (!allowedExtensions.has(extension)) throw new Error("Formato de anexo nao permitido.");
  const targetDir = input.payablePaymentId
    ? join(input.directories.accountsPayableDir, input.organizationId, input.ownLegalEntityId, input.accountPayableId, "payments", input.payablePaymentId, input.attachmentId)
    : join(input.directories.accountsPayableDir, input.organizationId, input.ownLegalEntityId, input.accountPayableId, "documents", input.attachmentId);
  mkdirSync(targetDir, { recursive: true });
  const storedFilePath = join(targetDir, `arquivo${extension}`);
  copyFileSync(input.sourcePath, storedFilePath);
  return {
    originalFileName: basename(input.sourcePath),
    storedFilePath,
    fileHash: hashFile(storedFilePath),
    mimeType: mimeFromExtension(extension),
    fileExtension: extension.slice(1),
    fileSize: stats.size
  };
}

export async function generateFinancialReportFile(input: {
  directories: AppDirectories;
  organization: Organization;
  ownLegalEntity: LegalEntity | null;
  reportType: FinancialReportType;
  format: FinancialReportFormat;
  filters: FinancialReportFilters;
  preview: FinancialReportPreview;
  payables: AccountPayable[];
  payments: PayablePayment[];
  categories: ExpenseCategory[];
  locations: Location[];
  costCenters: CostCenter[];
  partners: BusinessPartner[];
  reportId: string;
}): Promise<{ fileName: string; storedFilePath: string; fileHash: string }> {
  const year = new Date().toISOString().slice(0, 4);
  const legalSegment = input.ownLegalEntity?.id ?? "all";
  const baseDir = join(input.directories.financialReportsDir, input.organization.id, legalSegment, year, input.reportId);
  mkdirSync(baseDir, { recursive: true });
  if (input.format === "PDF") {
    const fileName = "relatorio.pdf";
    const storedFilePath = join(baseDir, fileName);
    writeFileSync(storedFilePath, await buildFinancialReportPdf(input));
    return { fileName, storedFilePath, fileHash: hashFile(storedFilePath) };
  }
  const fileName = "relatorio.xlsx";
  const storedFilePath = join(baseDir, fileName);
  await writeReportWorkbook(storedFilePath, input);
  return { fileName, storedFilePath, fileHash: hashFile(storedFilePath) };
}

export function hashFile(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

type PdfColor = ReturnType<typeof rgb>;

async function buildFinancialReportPdf(input: Parameters<typeof generateFinancialReportFile>[0]): Promise<Uint8Array> {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 28;
  const contentWidth = pageWidth - margin * 2;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const colors = reportColors(input.organization, input.ownLegalEntity);
  const logo = await embedLogo(doc, input.organization);
  const title = reportTitle(input.reportType);

  const addPage = (pageNumber: number): PDFPage => {
    const page = doc.addPage([pageWidth, pageHeight]);
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: colors.background });
    page.drawRectangle({ x: margin, y: pageHeight - margin - 88, width: contentWidth, height: 88, color: colors.header });
    page.drawRectangle({ x: margin, y: pageHeight - margin - 90, width: contentWidth, height: 2, color: colors.accent });
    if (logo) {
      const size = fitImage(logo.width, logo.height, 54, 54);
      page.drawImage(logo.image, { x: margin + 12, y: pageHeight - margin - 70, width: size.width, height: size.height });
    }
    const headerX = logo ? margin + 78 : margin + 14;
    page.drawText(title.toUpperCase(), { x: headerX, y: pageHeight - margin - 24, size: 13.5, font: bold, color: colors.headerText });
    page.drawText(input.ownLegalEntity?.tradeName ?? input.organization.displayName, { x: headerX, y: pageHeight - margin - 43, size: 8.5, font: bold, color: colors.headerMuted });
    page.drawText(`Gerado em ${formatDateTime(new Date().toISOString())}`, { x: headerX, y: pageHeight - margin - 58, size: 7, font, color: colors.headerMuted });
    drawRightText(page, `Pagina ${pageNumber}`, pageWidth - margin - 105, pageHeight - margin - 24, 90, bold, 10, colors.headerText);
    drawRightText(page, input.organization.appDisplayName, pageWidth - margin - 150, pageHeight - margin - 42, 135, font, 7, colors.headerMuted);
    return page;
  };

  let page = addPage(1);
  let y = pageHeight - margin - 112;
  drawInfoBox(page, "ESCOPO", [input.organization.displayName, input.ownLegalEntity?.tradeName ?? "Todos os CNPJs"], margin, y, 258, 64, { font, bold, colors });
  drawInfoBox(page, "RESUMO", [`Registros: ${input.preview.recordCount}`, `Total: R$ ${formatCents(input.preview.totalFinalCents)}`], margin + 270, y, 269, 64, { font, bold, colors });
  y -= 84;
  drawSummaryCards(page, y, contentWidth, margin, [
    ["TOTAL", `R$ ${formatCents(input.preview.totalFinalCents)}`],
    ["PAGO", `R$ ${formatCents(input.preview.totalPaidCents)}`],
    ["ABERTO", `R$ ${formatCents(input.preview.totalOpenCents)}`],
    ["VENCIDO", `R$ ${formatCents(input.preview.totalOverdueCents)}`]
  ], { font, bold, colors });
  y -= 86;

  drawSectionTitle(page, "Contas", margin, y, bold, colors);
  y -= 18;
  drawFinancialTableHeader(page, margin, y, contentWidth, { font, bold, colors });
  y -= 30;

  const rows = input.payables.slice(0, 220);
  rows.forEach((item) => {
    if (y < 58) {
      page = addPage(doc.getPageCount() + 1);
      y = pageHeight - margin - 120;
      drawSectionTitle(page, "Contas", margin, y, bold, colors);
      y -= 18;
      drawFinancialTableHeader(page, margin, y, contentWidth, { font, bold, colors });
      y -= 30;
    }
    drawFinancialRow(page, item, margin, y, contentWidth, { font, bold, colors });
    y -= 20;
  });

  if (rows.length === 0) {
    drawInfoBox(page, "SEM REGISTROS", ["Nenhuma conta encontrada para os filtros selecionados."], margin, y + 4, contentWidth, 48, { font, bold, colors });
    y -= 54;
  }

  if (input.payments.length > 0) {
    if (y < 130) {
      page = addPage(doc.getPageCount() + 1);
      y = pageHeight - margin - 120;
    }
    drawSectionTitle(page, "Pagamentos", margin, y, bold, colors);
    y -= 20;
    input.payments.slice(0, 8).forEach((item) => {
      page.drawText(`${formatDate(item.paymentDate)}  ${truncate(item.payeeNameSnapshot, font, 7.5, 225)}`, { x: margin + 8, y, size: 7.5, font, color: colors.ink });
      drawRightText(page, `R$ ${formatCents(item.amountCents)}`, margin + contentWidth - 130, y, 118, bold, 7.5, colors.ink);
      y -= 16;
    });
  }

  doc.getPages().forEach((reportPage) => {
    reportPage.drawText("Relatorio gerencial local gerado pelo Sistema de Operacoes de Cafe.", { x: margin, y: 22, size: 6.5, font, color: colors.muted });
  });
  return doc.save();
}

async function writeReportWorkbook(filePath: string, input: Parameters<typeof generateFinancialReportFile>[0]): Promise<void> {
  mkdirSync(dirname(filePath), { recursive: true });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sistema de Operacoes de Cafe";
  const summary = workbook.addWorksheet("Resumo");
  summary.addRows([
    ["Relatorio", reportTitle(input.reportType)],
    ["Organizacao", input.organization.displayName],
    ["CNPJ proprio", input.ownLegalEntity?.tradeName ?? "Todos"],
    ["Total de contas", input.preview.recordCount],
    ["Total final", input.preview.totalFinalCents / 100],
    ["Total pago", input.preview.totalPaidCents / 100],
    ["Saldo aberto", input.preview.totalOpenCents / 100],
    ["Total vencido", input.preview.totalOverdueCents / 100]
  ]);
  const accounts = workbook.addWorksheet("Contas");
  accounts.addRow(["Competencia", "Emissao", "Vencimento", "Descricao", "Fornecedor", "Documento", "Categoria", "Local", "Centro de custo", "Valor original", "Desconto", "Juros", "Multa", "Acrescimos", "Valor final", "Pago", "Saldo", "Status", "Recorrencia", "Parcela"]);
  input.payables.forEach((item) => accounts.addRow([
    item.competenceDate,
    item.issueDate,
    item.dueDate,
    item.description,
    item.payeeNameSnapshot,
    item.documentNumber,
    label(input.categories, item.categoryId),
    label(input.locations, item.defaultLocationId),
    label(input.costCenters, item.defaultCostCenterId),
    cents(item.originalAmountCents),
    cents(item.discountCents),
    cents(item.interestCents),
    cents(item.penaltyCents),
    cents(item.otherAdditionsCents),
    cents(item.finalAmountCents),
    cents(item.paidAmountCents),
    cents(item.openAmountCents),
    item.status,
    item.recurringTemplateId ? "Sim" : "Nao",
    item.installmentNumber ? `${item.installmentNumber}/${item.installmentCount}` : ""
  ]));
  const payments = workbook.addWorksheet("Pagamentos");
  payments.addRow(["Data", "Fornecedor", "Metodo", "Valor", "Referencia", "Status"]);
  input.payments.forEach((item) => payments.addRow([item.paymentDate, item.payeeNameSnapshot, item.paymentMethod, item.amountCents / 100, item.transactionReference, item.status]));
  const allocations = workbook.addWorksheet("Rateios");
  allocations.addRow(["Conta", "Centro de custo", "Local", "Percentual", "Valor"]);
  input.payables.forEach((item) => allocations.addRow([item.description, label(input.costCenters, item.defaultCostCenterId), label(input.locations, item.defaultLocationId), item.defaultCostCenterId ? "100%" : "", cents(item.finalAmountCents)]));
  workbook.eachSheet((sheet) => {
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = sheet.rowCount > 1 ? { from: "A1", to: `${String.fromCharCode(64 + Math.min(sheet.columnCount, 26))}1` } : undefined;
    sheet.columns.forEach((column) => { column.width = 18; });
  });
  await workbook.xlsx.writeFile(filePath);
}

function drawSummaryCards(page: PDFPage, y: number, contentWidth: number, margin: number, cards: Array<[string, string]>, style: { font: PDFFont; bold: PDFFont; colors: ReturnType<typeof reportColors> }): void {
  const gap = 9;
  const width = (contentWidth - gap * (cards.length - 1)) / cards.length;
  cards.forEach(([labelText, value], index) => {
    const x = margin + index * (width + gap);
    page.drawRectangle({ x, y: y - 52, width, height: 52, color: style.colors.paper, borderColor: style.colors.border, borderWidth: 0.55 });
    page.drawText(labelText, { x: x + 10, y: y - 18, size: 6.8, font: style.bold, color: style.colors.muted });
    page.drawText(value, { x: x + 10, y: y - 39, size: 11.5, font: style.bold, color: style.colors.ink });
  });
}

function drawFinancialTableHeader(page: PDFPage, x: number, y: number, width: number, style: { font: PDFFont; bold: PDFFont; colors: ReturnType<typeof reportColors> }): void {
  page.drawRectangle({ x, y: y - 18, width, height: 18, color: style.colors.soft, borderColor: style.colors.border, borderWidth: 0.45 });
  [
    ["VENC.", x + 8],
    ["DESCRICAO", x + 58],
    ["FORNECEDOR", x + 218],
    ["TOTAL", x + 382],
    ["PAGO", x + 448],
    ["ABERTO", x + 502]
  ].forEach(([labelText, columnX]) => page.drawText(String(labelText), { x: Number(columnX), y: y - 12, size: 6.4, font: style.bold, color: style.colors.muted }));
}

function drawFinancialRow(page: PDFPage, item: AccountPayable, x: number, y: number, width: number, style: { font: PDFFont; bold: PDFFont; colors: ReturnType<typeof reportColors> }): void {
  page.drawLine({ start: { x, y: y - 7 }, end: { x: x + width, y: y - 7 }, thickness: 0.35, color: style.colors.border });
  page.drawText(formatDate(item.dueDate), { x: x + 8, y, size: 7, font: style.font, color: style.colors.ink });
  page.drawText(truncate(item.description, style.font, 7, 150), { x: x + 58, y, size: 7, font: style.font, color: style.colors.ink });
  page.drawText(truncate(item.payeeNameSnapshot, style.font, 7, 150), { x: x + 218, y, size: 7, font: style.font, color: style.colors.ink });
  drawRightText(page, formatCents(item.finalAmountCents ?? 0), x + 370, y, 54, style.bold, 7, style.colors.ink);
  drawRightText(page, formatCents(item.paidAmountCents), x + 436, y, 54, style.font, 7, style.colors.ink);
  drawRightText(page, formatCents(item.openAmountCents ?? 0), x + 490, y, 48, style.bold, 7, style.colors.ink);
}

function drawInfoBox(page: PDFPage, title: string, lines: string[], x: number, topY: number, width: number, height: number, style: { font: PDFFont; bold: PDFFont; colors: ReturnType<typeof reportColors> }): void {
  page.drawRectangle({ x, y: topY - height, width, height, color: style.colors.paper, borderColor: style.colors.border, borderWidth: 0.55 });
  page.drawText(title, { x: x + 10, y: topY - 16, size: 6.6, font: style.bold, color: style.colors.accent });
  lines.slice(0, 3).forEach((line, index) => {
    page.drawText(truncate(line, index === 0 ? style.bold : style.font, index === 0 ? 8.2 : 7.3, width - 20), { x: x + 10, y: topY - 32 - index * 13, size: index === 0 ? 8.2 : 7.3, font: index === 0 ? style.bold : style.font, color: style.colors.ink });
  });
}

function drawSectionTitle(page: PDFPage, title: string, x: number, topY: number, bold: PDFFont, colors: ReturnType<typeof reportColors>): void {
  page.drawRectangle({ x, y: topY - 10, width: 3, height: 10, color: colors.accent });
  page.drawText(title, { x: x + 8, y: topY - 9, size: 8.2, font: bold, color: colors.ink });
}

async function embedLogo(doc: PDFDocument, organization: Organization): Promise<{ image: Awaited<ReturnType<PDFDocument["embedPng"]>>; width: number; height: number } | { image: Awaited<ReturnType<PDFDocument["embedJpg"]>>; width: number; height: number } | null> {
  const source = resolveBrandingLogoBytes(organization);
  if (!source) return null;
  const image = source.ext === "png" ? await doc.embedPng(source.bytes) : await doc.embedJpg(source.bytes);
  return { image, width: image.width, height: image.height };
}

function resolveBrandingLogoBytes(organization: Organization): { bytes: Buffer; ext: "png" | "jpeg" } | null {
  if (organization.logoPath?.startsWith("data:")) {
    const match = /^data:image\/(png|jpe?g);base64,(.+)$/.exec(organization.logoPath);
    if (match) return { bytes: Buffer.from(match[2], "base64"), ext: match[1] === "png" ? "png" : "jpeg" };
  } else if (organization.logoPath && existsSync(organization.logoPath)) {
    const ext = extname(organization.logoPath).replace(".", "").toLowerCase();
    if (ext === "png" || ext === "jpg" || ext === "jpeg") return { bytes: readFileSync(organization.logoPath), ext: ext === "png" ? "png" : "jpeg" };
  }
  const name = `${organization.displayName ?? ""} ${organization.appDisplayName ?? ""}`.toLowerCase();
  const variant = name.includes("villa") ? "villa" : name.includes("grao") || name.includes("grão") ? "grao" : null;
  if (!variant) return null;
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const appRoot = join(moduleDir, "..", "..", "..", "..");
  const candidates = [join(appRoot, "dist", "assets", "branding", variant, "logo.png"), join(appRoot, "public", "assets", "branding", variant, "logo.png")];
  const found = candidates.find((candidate) => existsSync(candidate));
  return found ? { bytes: readFileSync(found), ext: "png" } : null;
}

function fitImage(width: number, height: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return { width: width * scale, height: height * scale };
}

function reportColors(organization: Organization, ownLegalEntity: LegalEntity | null): {
  background: PdfColor;
  paper: PdfColor;
  soft: PdfColor;
  header: PdfColor;
  headerText: PdfColor;
  headerMuted: PdfColor;
  ink: PdfColor;
  muted: PdfColor;
  border: PdfColor;
  accent: PdfColor;
} {
  const isGraoBrand = `${organization.slug} ${organization.displayName} ${ownLegalEntity?.tradeName ?? ""}`.toLowerCase().includes("grao");
  return {
    background: rgb(0.985, 0.965, 0.925),
    paper: rgb(1, 0.99, 0.965),
    soft: rgb(0.965, 0.94, 0.885),
    header: isGraoBrand ? rgb(0.015, 0.19, 0.13) : rgb(0.07, 0.055, 0.04),
    headerText: rgb(1, 0.96, 0.88),
    headerMuted: rgb(0.84, 0.75, 0.63),
    ink: rgb(0.1, 0.08, 0.06),
    muted: rgb(0.36, 0.32, 0.26),
    border: rgb(0.73, 0.63, 0.49),
    accent: isGraoBrand ? rgb(0.05, 0.68, 0.38) : rgb(0.69, 0.49, 0.29)
  };
}

function drawRightText(page: PDFPage, value: string, x: number, y: number, width: number, usedFont: PDFFont, size: number, color: PdfColor): void {
  page.drawText(value, { x: x + width - usedFont.widthOfTextAtSize(value, size), y, size, font: usedFont, color });
}

function truncate(value: string, usedFont: PDFFont, size: number, maxWidth: number): string {
  if (usedFont.widthOfTextAtSize(value, size) <= maxWidth) return value;
  let result = value;
  while (result.length > 1 && usedFont.widthOfTextAtSize(`${result}...`, size) > maxWidth) result = result.slice(0, -1);
  return `${result}...`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const [datePart] = value.split("T");
  const parts = datePart.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return value;
}

function formatDateTime(value: string): string {
  const [datePart, timePart = ""] = value.split("T");
  const date = formatDate(datePart);
  return timePart ? `${date} ${timePart.slice(0, 5)}` : date;
}

function label(items: Array<{ id: string; name?: string; displayName?: string }>, id: string | null): string {
  if (!id) return "";
  const item = items.find((entry) => entry.id === id);
  return item?.name ?? item?.displayName ?? id;
}

function cents(value: number | null): number {
  return (value ?? 0) / 100;
}

function reportTitle(type: FinancialReportType): string {
  const labels: Record<FinancialReportType, string> = {
    ACCOUNTS_PAYABLE: "Contas a pagar por periodo",
    OVERDUE_PAYABLES: "Contas vencidas",
    PAYMENTS: "Pagamentos realizados",
    BY_LEGAL_ENTITY: "Despesas por CNPJ proprio",
    BY_LOCATION: "Despesas por local",
    BY_COST_CENTER: "Despesas por centro de custo",
    BY_CATEGORY: "Despesas por categoria",
    BY_SUPPLIER: "Despesas por fornecedor",
    FIXED_VARIABLE: "Despesas fixas e variaveis",
    RECURRING: "Contas recorrentes",
    INSTALLMENTS: "Parcelamentos",
    PROJECTED_CASH_FLOW: "Fluxo financeiro projetado"
  };
  return labels[type];
}

function mimeFromExtension(extension: string): string {
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "image/jpeg";
}

function formatCents(value: number): string {
  return (value / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
