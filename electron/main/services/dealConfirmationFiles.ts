import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import type {
  AppDirectories,
  BusinessPartner,
  ConfirmationReportFilters,
  ConfirmationReportFormat,
  ConfirmationReportType,
  DealConfirmationDetail,
  LegalEntity,
  Organization
} from "../../../src/shared/types/domain.js";

export const SIGNED_CONFIRMATION_MAX_BYTES = 20 * 1024 * 1024;

export function hashLocalFile(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function storeSignedDealConfirmationPdf(input: {
  sourcePath: string;
  directories: AppDirectories;
  organizationId: string;
  ownLegalEntityId: string;
  confirmationId: string;
  versionId: string;
}): { originalFileName: string; storedFilePath: string; fileHash: string; fileSize: number; mimeType: string } {
  assertPdf(input.sourcePath);
  const targetDir = join(input.directories.confirmationsDir, input.organizationId, input.ownLegalEntityId, input.confirmationId, "signed", input.versionId);
  mkdirSync(targetDir, { recursive: true });
  const storedFilePath = join(targetDir, "assinado.pdf");
  copyFileSync(input.sourcePath, storedFilePath);
  const stats = statSync(storedFilePath);
  return {
    originalFileName: basename(input.sourcePath),
    storedFilePath,
    fileHash: hashLocalFile(storedFilePath),
    fileSize: stats.size,
    mimeType: "application/pdf"
  };
}

export function generateDealConfirmationPdf(input: {
  directories: AppDirectories;
  organization: Organization;
  ownLegalEntity: LegalEntity;
  detail: DealConfirmationDetail;
  versionId: string;
  draft: boolean;
}): { originalFileName: string; storedFilePath: string; fileHash: string; fileSize: number; mimeType: string } {
  const confirmation = input.detail.confirmation;
  const targetDir = join(input.directories.confirmationsDir, confirmation.organizationId, confirmation.ownLegalEntityId, confirmation.id, input.draft ? "preview" : "issued", input.versionId);
  mkdirSync(targetDir, { recursive: true });
  const storedFilePath = join(targetDir, input.draft ? "previa.pdf" : "confirmacao.pdf");
  writeSimplePdf(storedFilePath, buildConfirmationLines(input));
  const stats = statSync(storedFilePath);
  return {
    originalFileName: basename(storedFilePath),
    storedFilePath,
    fileHash: hashLocalFile(storedFilePath),
    fileSize: stats.size,
    mimeType: "application/pdf"
  };
}

export async function generateDealConfirmationReportFile(input: {
  directories: AppDirectories;
  organization: Organization;
  ownLegalEntity: LegalEntity | null;
  reportType: ConfirmationReportType;
  format: ConfirmationReportFormat;
  filters: ConfirmationReportFilters;
  confirmations: DealConfirmationDetail[];
  partners: BusinessPartner[];
  reportId: string;
}): Promise<{ fileName: string; storedFilePath: string; fileHash: string }> {
  const baseDir = join(input.directories.confirmationsDir, input.organization.id, input.ownLegalEntity?.id ?? "all", "reports", input.reportId);
  mkdirSync(baseDir, { recursive: true });
  if (input.format === "PDF") {
    const fileName = "relatorio-confirmacoes.pdf";
    const storedFilePath = join(baseDir, fileName);
    writeSimplePdf(storedFilePath, buildReportLines(input));
    return { fileName, storedFilePath, fileHash: hashLocalFile(storedFilePath) };
  }
  const fileName = "relatorio-confirmacoes.xlsx";
  const storedFilePath = join(baseDir, fileName);
  await writeReportWorkbook(storedFilePath, input);
  return { fileName, storedFilePath, fileHash: hashLocalFile(storedFilePath) };
}

function assertPdf(filePath: string): void {
  if (!existsSync(filePath)) throw new Error("Arquivo nao encontrado.");
  const stats = statSync(filePath);
  if (!stats.isFile()) throw new Error("Selecao nao e um arquivo.");
  if (stats.size <= 0) throw new Error("PDF vazio nao pode ser importado.");
  if (stats.size > SIGNED_CONFIRMATION_MAX_BYTES) throw new Error("PDF assinado acima do limite de 20 MB.");
  if (extname(filePath).toLowerCase() !== ".pdf") throw new Error("Somente PDF pode ser importado como versao assinada.");
}

function buildConfirmationLines(input: Parameters<typeof generateDealConfirmationPdf>[0]): string[] {
  const { confirmation } = input.detail;
  const title = confirmation.confirmationNumber ? `Confirmacao de Negocio ${confirmation.confirmationNumber}` : `Previa de Confirmacao ${confirmation.temporaryReference}`;
  const lines = [
    input.draft ? "PREVIA - NAO ASSINAR" : "DOCUMENTO OFICIAL EMITIDO PELO SISTEMA",
    title,
    `Organizacao: ${input.organization.displayName}`,
    `CNPJ emissor: ${input.ownLegalEntity.tradeName}`,
    `Data: ${confirmation.confirmationDate}`,
    `Status: ${confirmation.status} | Assinatura: ${confirmation.signatureStatus}`,
    ""
  ];
  input.detail.parties.forEach((party) => {
    const snapshot = safeJson<Record<string, unknown>>(party.snapshotJson, {});
    lines.push(`${party.partyRole}: ${escapeFlat(String(snapshot.name ?? party.manualName ?? ""))} ${snapshot.taxId ? `- ${snapshot.taxId}` : ""}`);
  });
  lines.push("", "Itens");
  input.detail.items.forEach((item, index) => {
    lines.push(`${index + 1}. ${escapeFlat(item.productNameSnapshot)} | ${item.quantitySacksDecimal} sacas | ${item.sackWeightKgDecimal} kg | R$ ${item.unitPriceDecimal}/saca | Total R$ ${formatCents(item.totalAmountCents)}`);
    if (item.qualitySnapshot) lines.push(`   Qualidade: ${escapeFlat(item.qualitySnapshot)}`);
    if (item.deliveryLocationSnapshot) lines.push(`   Entrega: ${escapeFlat(item.deliveryLocationSnapshot)}`);
  });
  lines.push("", `Total: ${confirmation.totalQuantitySacksDecimal} sacas | R$ ${formatCents(confirmation.totalCommercialAmountCents)}`);
  if (confirmation.paymentTermsSnapshot) lines.push(`Pagamento: ${escapeFlat(confirmation.paymentTermsSnapshot)}`);
  if (confirmation.deliveryLocationSnapshot) lines.push(`Entrega/descarga: ${escapeFlat(confirmation.deliveryLocationSnapshot)}`);
  if (confirmation.qualityTermsSnapshot) lines.push(`Qualidade: ${escapeFlat(confirmation.qualityTermsSnapshot)}`);
  if (confirmation.generalTermsSnapshot) lines.push(`Condicoes gerais: ${escapeFlat(confirmation.generalTermsSnapshot)}`);
  if (confirmation.publicNotes) lines.push(`Observacoes: ${escapeFlat(confirmation.publicNotes)}`);
  const visibleClauses = input.detail.clauses.filter((clause) => clause.isVisible);
  if (visibleClauses.length > 0) {
    lines.push("", "Clausulas");
    visibleClauses.forEach((clause, index) => lines.push(`${clause.clauseNumber ?? index + 1}. ${clause.title ? `${escapeFlat(clause.title)} - ` : ""}${escapeFlat(clause.clauseText)}`));
  }
  lines.push("", "Assinaturas");
  input.detail.signers.forEach((signer) => lines.push(`${signer.signatureOrder}. ${signer.name} (${signer.partyRole}) - ${signer.signatureStatus}`));
  lines.push("", "A assinatura externa deve ser conferida fora do sistema. Esta etapa nao valida certificado digital.");
  return lines;
}

function buildReportLines(input: Parameters<typeof generateDealConfirmationReportFile>[0]): string[] {
  const totalCents = input.confirmations.reduce((sum, detail) => sum + detail.confirmation.totalCommercialAmountCents, 0);
  const lines = [
    "Relatorio Gerencial de Confirmacoes",
    `Organizacao: ${input.organization.displayName}`,
    `CNPJ proprio: ${input.ownLegalEntity?.tradeName ?? "Todos"}`,
    `Tipo: ${input.reportType}`,
    `Registros: ${input.confirmations.length}`,
    `Valor comercial: R$ ${formatCents(totalCents)}`,
    "",
    "Confirmacoes"
  ];
  input.confirmations.forEach((detail) => {
    const seller = partyName(detail, "SELLER");
    const buyer = partyName(detail, "BUYER");
    lines.push(`${detail.confirmation.confirmationDate} | ${detail.confirmation.confirmationNumber ?? detail.confirmation.temporaryReference} | ${seller} -> ${buyer} | ${detail.confirmation.totalQuantitySacksDecimal} sacas | R$ ${formatCents(detail.confirmation.totalCommercialAmountCents)} | ${detail.confirmation.status}`);
  });
  return lines;
}

async function writeReportWorkbook(filePath: string, input: Parameters<typeof generateDealConfirmationReportFile>[0]): Promise<void> {
  mkdirSync(dirname(filePath), { recursive: true });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sistema de Operacoes de Cafe";
  const summary = workbook.addWorksheet("Resumo");
  const totalCents = input.confirmations.reduce((sum, detail) => sum + detail.confirmation.totalCommercialAmountCents, 0);
  summary.addRows([
    ["Relatorio", input.reportType],
    ["Organizacao", input.organization.displayName],
    ["CNPJ proprio", input.ownLegalEntity?.tradeName ?? "Todos"],
    ["Registros", input.confirmations.length],
    ["Valor comercial", totalCents / 100]
  ]);
  const sheet = workbook.addWorksheet("Confirmacoes");
  sheet.addRow(["Data", "Numero", "Vendedor", "Comprador", "Sacas", "Valor", "Status", "Assinatura", "Notas", "Operacoes"]);
  input.confirmations.forEach((detail) => sheet.addRow([
    detail.confirmation.confirmationDate,
    detail.confirmation.confirmationNumber ?? detail.confirmation.temporaryReference,
    partyName(detail, "SELLER"),
    partyName(detail, "BUYER"),
    detail.confirmation.totalQuantitySacksDecimal,
    detail.confirmation.totalCommercialAmountCents / 100,
    detail.confirmation.status,
    detail.confirmation.signatureStatus,
    detail.fiscalDocuments.length,
    detail.operations.length
  ]));
  workbook.eachSheet((worksheet) => {
    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.columns.forEach((column) => { column.width = 22; });
  });
  await workbook.xlsx.writeFile(filePath);
}

function writeSimplePdf(filePath: string, lines: string[]): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const pageHeight = 842;
  const chunks = chunk(lines, 46);
  const pageObjects: string[] = [];
  const contentObjects: string[] = [];
  chunks.forEach((pageLines, pageIndex) => {
    const contentObjectNumber = 4 + chunks.length + pageIndex;
    pageObjects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`);
    const body = pageLines.map((line, index) => {
      const y = pageHeight - 44 - index * 16;
      const size = pageIndex === 0 && index === 1 ? 16 : 9;
      return `BT /F1 ${size} Tf 36 ${y} Td (${escapePdf(line.slice(0, 150))}) Tj ET`;
    }).join("\n");
    contentObjects.push(`<< /Length ${Buffer.byteLength(body)} >>\nstream\n${body}\nendstream`);
  });
  const pageRefs = pageObjects.map((_object, index) => `${4 + index} 0 R`).join(" ");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageRefs}] /Count ${pageObjects.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ...pageObjects,
    ...contentObjects
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

function partyName(detail: DealConfirmationDetail, role: string): string {
  const party = detail.parties.find((item) => item.partyRole === role);
  if (!party) return "";
  const snapshot = safeJson<Record<string, unknown>>(party.snapshotJson, {});
  return String(snapshot.name ?? party.manualName ?? "");
}

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks.length > 0 ? chunks : [[]];
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
