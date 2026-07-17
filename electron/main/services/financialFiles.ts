import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
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
    writeSimplePdf(storedFilePath, buildReportLines(input));
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

function buildReportLines(input: Parameters<typeof generateFinancialReportFile>[0]): string[] {
  const title = reportTitle(input.reportType);
  const lines = [
    title,
    `Organizacao: ${input.organization.displayName}`,
    `CNPJ proprio: ${input.ownLegalEntity?.tradeName ?? "Todos"}`,
    `Gerado em: ${new Date().toISOString()}`,
    `Registros: ${input.preview.recordCount}`,
    `Total: R$ ${formatCents(input.preview.totalFinalCents)} Pago: R$ ${formatCents(input.preview.totalPaidCents)} Aberto: R$ ${formatCents(input.preview.totalOpenCents)}`,
    "",
    "Contas"
  ];
  input.payables.slice(0, 180).forEach((item) => {
    lines.push(`${item.dueDate} | ${item.competenceDate} | ${escapeFlat(item.description)} | ${escapeFlat(item.payeeNameSnapshot)} | R$ ${formatCents(item.finalAmountCents ?? 0)} | Pago R$ ${formatCents(item.paidAmountCents)} | Aberto R$ ${formatCents(item.openAmountCents ?? 0)} | ${item.status}`);
  });
  if (input.payments.length > 0) {
    lines.push("", "Pagamentos");
    input.payments.slice(0, 80).forEach((item) => lines.push(`${item.paymentDate} | ${escapeFlat(item.payeeNameSnapshot)} | ${item.paymentMethod} | R$ ${formatCents(item.amountCents)} | ${item.status}`));
  }
  lines.push("", `Relatorio gerencial. Pagina 1. Total de registros: ${input.preview.recordCount}.`);
  return lines;
}

function writeSimplePdf(filePath: string, lines: string[]): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const pageHeight = 842;
  const body = lines.map((line, index) => {
    const y = pageHeight - 42 - (index % 48) * 15;
    const size = index === 0 ? 16 : 9;
    return `BT /F1 ${size} Tf 36 ${y} Td (${escapePdf(line.slice(0, 145))}) Tj ET`;
  }).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(body)} >>\nstream\n${body}\nendstream`
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

function escapeFlat(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function escapePdf(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
