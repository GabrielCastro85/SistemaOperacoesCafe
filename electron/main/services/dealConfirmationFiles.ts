import ExcelJS from "exceljs";
import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

export async function generateDealConfirmationPdf(input: {
  directories: AppDirectories;
  organization: Organization;
  ownLegalEntity: LegalEntity;
  detail: DealConfirmationDetail;
  versionId: string;
  draft: boolean;
}): Promise<{ originalFileName: string; storedFilePath: string; fileHash: string; fileSize: number; mimeType: string }> {
  const confirmation = input.detail.confirmation;
  const targetDir = join(input.directories.confirmationsDir, confirmation.organizationId, confirmation.ownLegalEntityId, confirmation.id, input.draft ? "preview" : "issued", input.versionId);
  mkdirSync(targetDir, { recursive: true });
  const storedFilePath = join(targetDir, input.draft ? "previa.pdf" : "confirmacao.pdf");
  const bytes = await buildConfirmationPdf(input);
  writeFileSync(storedFilePath, bytes);
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

function resolveBrandingLogoBytes(organization: Organization): { bytes: Buffer; ext: string } | null {
  if (organization.logoPath?.startsWith("data:")) {
    const match = /^data:image\/(png|jpe?g);base64,(.+)$/.exec(organization.logoPath);
    if (match) return { bytes: Buffer.from(match[2], "base64"), ext: match[1] === "jpg" ? "jpeg" : match[1] };
  } else if (organization.logoPath && existsSync(organization.logoPath)) {
    return { bytes: readFileSync(organization.logoPath), ext: extname(organization.logoPath).replace(".", "").toLowerCase() };
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

const PARTY_ROLE_LABELS: Record<string, string> = {
  ISSUER: "Emitente",
  BROKER: "Corretora",
  SELLER: "Vendedor",
  BUYER: "Comprador",
  DELIVERY_RECIPIENT: "Local de descarga",
  OTHER: "Outro"
};

async function buildConfirmationPdf(input: Parameters<typeof generateDealConfirmationPdf>[0]): Promise<Uint8Array> {
  const { detail, organization, ownLegalEntity, draft } = input;
  const { confirmation } = detail;
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const ensureSpace = (needed: number): void => {
    if (y - needed < margin) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  const text = (value: string, x: number, options: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; maxWidth?: number } = {}): number => {
    const size = options.size ?? 10;
    const usedFont = options.font ?? font;
    const lines = options.maxWidth ? wrapText(value, usedFont, size, options.maxWidth) : [value];
    lines.forEach((line) => {
      page.drawText(line, { x, y, size, font: usedFont, color: options.color ?? rgb(0.1, 0.1, 0.1) });
      y -= size + 4;
    });
    return lines.length;
  };

  const rule = (): void => {
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.75, color: rgb(0.75, 0.7, 0.6) });
    y -= 10;
  };

  // Logo (best-effort) + header
  let logoImage: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  const logoSource = resolveBrandingLogoBytes(organization);
  if (logoSource) {
    try {
      logoImage = logoSource.ext === "jpg" || logoSource.ext === "jpeg" ? await doc.embedJpg(logoSource.bytes) : await doc.embedPng(logoSource.bytes);
    } catch {
      logoImage = null;
    }
  }
  if (logoImage) {
    const logoHeight = 40;
    const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
    page.drawImage(logoImage, { x: margin, y: y - logoHeight + 8, width: logoWidth, height: logoHeight });
  }
  const headerX = logoImage ? margin + 70 : margin;
  text(organization.displayName, headerX, { size: 15, font: bold });
  text(`${ownLegalEntity.tradeName} - CNPJ ${ownLegalEntity.cnpj ?? "nao informado"}`, headerX, { size: 9, color: rgb(0.4, 0.4, 0.4) });
  y -= 6;
  rule();

  const title = draft ? "PREVIA - NAO ASSINAR" : confirmation.confirmationNumber ? `Confirmacao de Negocio No ${confirmation.confirmationNumber}` : `Previa de Confirmacao ${confirmation.temporaryReference}`;
  text(title, margin, { size: 13, font: bold, color: draft ? rgb(0.65, 0.25, 0.1) : rgb(0.1, 0.1, 0.1) });
  text(`Data da negociacao: ${confirmation.negotiationDate ?? confirmation.confirmationDate}${confirmation.brokeragePercentageBasisPoints != null ? `   |   Corretagem: ${(confirmation.brokeragePercentageBasisPoints / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%` : ""}`, margin, { size: 9 });
  y -= 8;

  // Party boxes side by side
  const roleOrder = ["SELLER", "BUYER", "DELIVERY_RECIPIENT"];
  const visibleParties = roleOrder
    .map((role) => detail.parties.find((party) => party.partyRole === role))
    .filter((party): party is (typeof detail.parties)[number] => Boolean(party));
  if (visibleParties.length > 0) {
    const boxCount = visibleParties.length;
    const gap = 10;
    const boxWidth = (contentWidth - gap * (boxCount - 1)) / boxCount;
    const partyFields = visibleParties.map((party) => {
      const snapshot = safeJson<Partial<{ name: string; legalName: string; taxId: string; stateRegistration: string; addressLine: string; addressNumber: string; district: string; city: string; state: string }>>(party.snapshotJson, {});
      const fields: { value: string; size: number; font: PDFFont; color?: ReturnType<typeof rgb> }[] = [
        { value: PARTY_ROLE_LABELS[party.partyRole] ?? party.partyRole, size: 8, font: bold, color: rgb(0.5, 0.45, 0.3) },
        { value: snapshot.name ?? party.manualName ?? "Nao informado", size: 10, font: bold }
      ];
      if (snapshot.legalName && snapshot.legalName !== snapshot.name) fields.push({ value: snapshot.legalName, size: 8, font });
      if (snapshot.addressLine) fields.push({ value: `${snapshot.addressLine}${snapshot.addressNumber ? `, ${snapshot.addressNumber}` : ""}`, size: 8, font });
      if (snapshot.city) fields.push({ value: `${snapshot.city}${snapshot.state ? ` - ${snapshot.state}` : ""}`, size: 8, font });
      if (snapshot.taxId) fields.push({ value: `CNPJ/CPF: ${snapshot.taxId}`, size: 8, font });
      if (snapshot.stateRegistration) fields.push({ value: `I.E.: ${snapshot.stateRegistration}`, size: 8, font });
      return fields.map((field) => ({ ...field, lines: wrapText(field.value, field.font, field.size, boxWidth - 16) }));
    });
    const contentHeights = partyFields.map((fields) => fields.reduce((sum, field) => sum + field.lines.length * (field.size + 3), 0));
    const boxHeight = Math.max(92, ...contentHeights.map((height) => height + 20));
    ensureSpace(boxHeight + 12);
    const boxTop = y;
    partyFields.forEach((fields, index) => {
      const boxX = margin + index * (boxWidth + gap);
      page.drawRectangle({ x: boxX, y: boxTop - boxHeight, width: boxWidth, height: boxHeight, borderColor: rgb(0.75, 0.7, 0.6), borderWidth: 0.75 });
      let innerY = boxTop - 14;
      fields.forEach((field) => {
        field.lines.forEach((line) => {
          page.drawText(line, { x: boxX + 8, y: innerY, size: field.size, font: field.font, color: field.color ?? rgb(0.1, 0.1, 0.1) });
          innerY -= field.size + 3;
        });
      });
    });
    y = boxTop - boxHeight - 14;
  }

  // Items table
  ensureSpace(30);
  const columns = [
    { label: "Produto", x: margin, width: 150 },
    { label: "Procedencia", x: margin + 150, width: 85 },
    { label: "Sacas", x: margin + 235, width: 55 },
    { label: "R$/saca", x: margin + 290, width: 70 },
    { label: "Total", x: margin + 360, width: contentWidth - 360 }
  ];
  columns.forEach((column) => page.drawText(column.label, { x: column.x, y, size: 9, font: bold }));
  y -= 6;
  rule();
  detail.items.forEach((item) => {
    ensureSpace(16);
    page.drawText(truncate(item.productNameSnapshot, font, 9, columns[0].width), { x: columns[0].x, y, size: 9, font });
    page.drawText(truncate(item.originSnapshot ?? "-", font, 9, columns[1].width), { x: columns[1].x, y, size: 9, font });
    page.drawText(item.quantitySacksDecimal.replace(".", ","), { x: columns[2].x, y, size: 9, font });
    page.drawText(item.unitPriceDecimal.replace(".", ","), { x: columns[3].x, y, size: 9, font });
    page.drawText(`R$ ${formatCents(item.totalAmountCents)}`, { x: columns[4].x, y, size: 9, font });
    y -= 15;
  });
  y -= 2;
  rule();
  text(`Total: ${confirmation.totalQuantitySacksDecimal.replace(".", ",")} sacas   |   R$ ${formatCents(confirmation.totalCommercialAmountCents)}`, margin, { size: 11, font: bold });
  y -= 6;

  // Payment + bank block
  ensureSpace(70);
  const paymentColWidth = (contentWidth - 20) / 2;
  const blockTop = y;
  text("Condicao de pagamento", margin, { size: 9, font: bold });
  const paymentLinesUsed = confirmation.paymentTermsSnapshot ? text(confirmation.paymentTermsSnapshot, margin, { size: 9, maxWidth: paymentColWidth }) : text("Nao informado", margin, { size: 9 });
  const bankLines: string[] = [];
  if (confirmation.bankName) bankLines.push(`Banco: ${confirmation.bankName}${confirmation.bankCode ? ` (${confirmation.bankCode})` : ""}`);
  if (confirmation.bankAgency) bankLines.push(`Agencia: ${confirmation.bankAgency}`);
  if (confirmation.bankAccount) bankLines.push(`Conta: ${confirmation.bankAccount}`);
  if (confirmation.pixKey) bankLines.push(`PIX: ${confirmation.pixKey}`);
  if (bankLines.length > 0) {
    let bankY = blockTop;
    const bankX = margin + paymentColWidth + 20;
    page.drawText("Dados para deposito", { x: bankX, y: bankY, size: 9, font: bold });
    bankY -= 13;
    bankLines.forEach((line) => { page.drawText(line, { x: bankX, y: bankY, size: 9, font }); bankY -= 13; });
    y = Math.min(y, bankY);
  }
  void paymentLinesUsed;
  y -= 10;

  if (confirmation.qualityTermsSnapshot) text(`Qualidade: ${confirmation.qualityTermsSnapshot}`, margin, { size: 9, maxWidth: contentWidth });
  if (confirmation.generalTermsSnapshot) text(`Condicoes gerais: ${confirmation.generalTermsSnapshot}`, margin, { size: 9, maxWidth: contentWidth });
  if (confirmation.publicNotes) text(`Observacoes: ${confirmation.publicNotes}`, margin, { size: 9, maxWidth: contentWidth });

  const visibleClauses = detail.clauses.filter((clause) => clause.isVisible);
  if (visibleClauses.length > 0) {
    y -= 4;
    ensureSpace(20);
    text("Clausulas", margin, { size: 10, font: bold });
    visibleClauses.forEach((clause, index) => {
      ensureSpace(16);
      text(`${clause.clauseNumber ?? index + 1}. ${clause.title ? `${clause.title} - ` : ""}${clause.clauseText}`, margin, { size: 8.5, maxWidth: contentWidth });
    });
  }

  // Signatures side by side
  if (detail.signers.length > 0) {
    ensureSpace(70);
    y -= 20;
    const sigColWidth = (contentWidth - 20) / 2;
    detail.signers.forEach((signer, index) => {
      const col = index % 2;
      const sigX = margin + col * (sigColWidth + 20);
      if (col === 0 && index > 0) y -= 50;
      const lineY = y;
      page.drawLine({ start: { x: sigX, y: lineY }, end: { x: sigX + sigColWidth, y: lineY }, thickness: 0.75, color: rgb(0.3, 0.3, 0.3) });
      page.drawText(signer.name, { x: sigX, y: lineY - 12, size: 9, font: bold });
      page.drawText(`${PARTY_ROLE_LABELS[signer.partyRole] ?? signer.partyRole}${draft ? "" : ` - ${signer.signatureStatus}`}`, { x: sigX, y: lineY - 24, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
    });
    y -= 50;
  }

  ensureSpace(20);
  text("A assinatura externa deve ser conferida fora do sistema. Esta etapa nao valida certificado digital.", margin, { size: 7.5, color: rgb(0.5, 0.5, 0.5), maxWidth: contentWidth });

  return doc.save();
}

function wrapText(value: string, usedFont: PDFFont, size: number, maxWidth: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (usedFont.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function truncate(value: string, usedFont: PDFFont, size: number, maxWidth: number): string {
  if (usedFont.widthOfTextAtSize(value, size) <= maxWidth) return value;
  let result = value;
  while (result.length > 1 && usedFont.widthOfTextAtSize(`${result}...`, size) > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}...`;
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

function escapePdf(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
