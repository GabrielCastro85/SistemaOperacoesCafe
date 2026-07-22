import ExcelJS from "exceljs";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
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
  DealPartySnapshot,
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
  const fileName = buildDealConfirmationFileName(input);
  const storedFilePath = join(targetDir, fileName);
  const bytes = await buildCompactConfirmationPdf(input);
  writeFileSync(storedFilePath, bytes);
  const stats = statSync(storedFilePath);
  return {
    originalFileName: fileName,
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

type PdfColor = ReturnType<typeof rgb>;

interface TextBoxOptions {
  font: PDFFont;
  bold?: PDFFont;
  size: number;
  minSize: number;
  lineHeight: number;
  maxLines: number;
  color: PdfColor;
  align?: "left" | "right" | "center";
  important?: boolean;
}

async function buildCompactConfirmationPdf(input: Parameters<typeof generateDealConfirmationPdf>[0]): Promise<Uint8Array> {
  const { detail, organization, ownLegalEntity, draft } = input;
  const { confirmation } = detail;
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 24;
  const contentWidth = pageWidth - margin * 2;
  const dark = rgb(0.07, 0.055, 0.04);
  const ink = rgb(0.1, 0.08, 0.06);
  const muted = rgb(0.36, 0.32, 0.26);
  const border = rgb(0.73, 0.63, 0.49);
  const soft = rgb(0.96, 0.93, 0.87);
  const gold = rgb(0.69, 0.49, 0.29);
  const green = rgb(0.04, 0.42, 0.28);
  const headerText = rgb(1, 0.96, 0.88);
  const isGraoBrand = `${organization.slug} ${organization.displayName} ${ownLegalEntity.tradeName}`.toLowerCase().includes("grao");
  const headerColor = isGraoBrand ? rgb(0.015, 0.19, 0.13) : dark;

  if (detail.items.length > 4) {
    throw new Error("Modelo de uma pagina excedido: a confirmacao compacta aceita ate 4 itens negociados.");
  }

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([pageWidth, pageHeight]);
  let currentY = pageHeight - margin;

  const line = (fromX: number, toX: number, lineY: number, color = border): void => {
    page.drawLine({ start: { x: fromX, y: lineY }, end: { x: toX, y: lineY }, thickness: 0.65, color });
  };

  const sectionTitle = (title: string, topY: number): number => {
    page.drawRectangle({ x: margin, y: topY - 10, width: 3, height: 10, color: green });
    page.drawText(title, { x: margin + 7, y: topY - 8, size: 7.4, font: bold, color: ink });
    return topY - 14;
  };

  const partyAddress = (snapshot: Partial<DealPartySnapshot>): string | null => {
    const address = [snapshot.addressLine, snapshot.addressNumber].filter(Boolean).join(", ");
    const district = snapshot.district ? ` - ${snapshot.district}` : "";
    return address ? `${address}${district}` : null;
  };

  const partyCity = (snapshot: Partial<DealPartySnapshot>): string | null => {
    return [snapshot.city, snapshot.state].filter(Boolean).join(" - ") || null;
  };

  const partyDocument = (snapshot: Partial<DealPartySnapshot>): string | null => {
    const pieces = [];
    if (snapshot.taxId) pieces.push(`CNPJ: ${formatTaxId(snapshot.taxId)}`);
    if (snapshot.stateRegistration) pieces.push(`IE: ${snapshot.stateRegistration}`);
    return pieces.join(" | ") || null;
  };

  const partyLines = (party: (typeof detail.parties)[number] | null, fallback?: Partial<DealPartySnapshot>, max = 5): string[] => {
    const snapshot = party ? safeJson<Partial<DealPartySnapshot>>(party.snapshotJson, {}) : fallback ?? {};
    const name = snapshot.name ?? party?.manualName ?? "Nao informado";
    return [
      name,
      snapshot.legalName && snapshot.legalName !== name ? snapshot.legalName : null,
      partyDocument(snapshot),
      partyAddress(snapshot),
      partyCity(snapshot)
    ].filter((item): item is string => Boolean(item)).slice(0, max);
  };

  const partyNameForSignature = (party: (typeof detail.parties)[number] | null): string => {
    const snapshot = party ? safeJson<Partial<DealPartySnapshot>>(party.snapshotJson, {}) : {};
    return snapshot.name ?? party?.manualName ?? "Nao informado";
  };

  const drawParty = (title: string, party: (typeof detail.parties)[number] | null, x: number, topY: number, width: number, height: number, fallback?: Partial<DealPartySnapshot>): void => {
    page.drawRectangle({ x, y: topY - height, width, height, color: rgb(1, 0.99, 0.965), borderColor: border, borderWidth: 0.6 });
    page.drawText(title, { x: x + 7, y: topY - 10, size: 6.4, font: bold, color: gold });
    drawTextBox(page, partyLines(party, fallback).join("\n"), x + 7, topY - 16, width - 14, height - 19, { font, bold, size: 7.2, minSize: 5.8, lineHeight: 1.14, maxLines: 5, color: ink, important: true });
  };

  const issuerParty = detail.parties.find((party) => party.partyRole === "ISSUER") ?? null;
  const seller = detail.parties.find((party) => party.partyRole === "SELLER") ?? issuerParty;
  const buyer = detail.parties.find((party) => party.partyRole === "BUYER") ?? null;
  const delivery = detail.parties.find((party) => party.partyRole === "DELIVERY_RECIPIENT") ?? buyer;
  const ownSnapshot: Partial<DealPartySnapshot> = {
    name: ownLegalEntity.tradeName,
    legalName: ownLegalEntity.legalName,
    taxId: ownLegalEntity.cnpj,
    stateRegistration: ownLegalEntity.stateRegistration,
    addressLine: ownLegalEntity.addressLine,
    addressNumber: ownLegalEntity.addressNumber,
    district: ownLegalEntity.district,
    city: ownLegalEntity.city,
    state: ownLegalEntity.state
  };

  let logoImage: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  const logoSource = resolveBrandingLogoBytes(organization);
  if (logoSource) {
    try {
      logoImage = logoSource.ext === "jpg" || logoSource.ext === "jpeg" ? await doc.embedJpg(logoSource.bytes) : await doc.embedPng(logoSource.bytes);
    } catch {
      logoImage = null;
    }
  }

  page.drawRectangle({ x: margin, y: currentY - 70, width: contentWidth, height: 70, color: headerColor, borderColor: border, borderWidth: 0.65 });
  if (logoImage) {
    const logoHeight = 33;
    const logoWidth = Math.min((logoImage.width / logoImage.height) * logoHeight, 48);
    page.drawImage(logoImage, { x: margin + 9, y: currentY - 50, width: logoWidth, height: logoHeight });
  }
  const headerX = logoImage ? margin + 66 : margin + 10;
  drawTextBox(page, `${ownLegalEntity.tradeName}\n${ownLegalEntity.legalName}\nCNPJ: ${formatTaxId(ownLegalEntity.cnpj)}${ownLegalEntity.stateRegistration ? ` | IE: ${ownLegalEntity.stateRegistration}` : ""}`, headerX, currentY - 15, 270, 44, { font, bold, size: 9.2, minSize: 6.4, lineHeight: 1.16, maxLines: 3, color: headerText, important: true });
  const title = draft ? "PREVIA - NAO ASSINAR" : "CONFIRMACAO DE NEGOCIO";
  const number = confirmation.confirmationNumber ?? confirmation.temporaryReference;
  page.drawRectangle({ x: pageWidth - margin - 158, y: currentY - 57, width: 148, height: 44, borderColor: gold, borderWidth: 0.75 });
  page.drawText(title, { x: pageWidth - margin - 149, y: currentY - 28, size: 7.3, font: bold, color: draft ? gold : headerText });
  page.drawText(number, { x: pageWidth - margin - 149, y: currentY - 43, size: 10, font: bold, color: headerText });
  page.drawText(`Data: ${formatDate(confirmation.negotiationDate ?? confirmation.confirmationDate)}`, { x: pageWidth - margin - 149, y: currentY - 54, size: 6.6, font, color: rgb(0.82, 0.75, 0.65) });
  currentY -= 79;

  currentY = sectionTitle("Dados da negociacao", currentY);
  const metaHeight = 32;
  const metaCol = contentWidth / 4;
  [
    ["Data negociacao", formatDate(confirmation.negotiationDate ?? confirmation.confirmationDate)],
    ["Data emissao", formatDate(confirmation.confirmationDate)],
    ["Origem", detail.fiscalDocuments.length ? `${detail.fiscalDocuments.length} NF` : "Manual"],
    ["Corretagem", confirmation.brokeragePercentageBasisPoints != null ? `${(confirmation.brokeragePercentageBasisPoints / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%` : "Nao informada"]
  ].forEach(([label, value], index) => {
    const x = margin + index * metaCol;
    page.drawRectangle({ x, y: currentY - metaHeight, width: metaCol - 5, height: metaHeight, color: soft, borderColor: border, borderWidth: 0.45 });
    page.drawText(label, { x: x + 6, y: currentY - 10, size: 5.7, font: bold, color: gold });
    drawTextBox(page, value, x + 6, currentY - 18, metaCol - 17, 12, { font, bold, size: 7.2, minSize: 5.6, lineHeight: 1, maxLines: 1, color: ink });
  });
  currentY -= metaHeight + 8;

  currentY = sectionTitle("Participantes", currentY);
  const half = (contentWidth - 12) / 2;
  drawParty("Vendedor", seller, margin, currentY, half, 60, ownSnapshot);
  drawParty("Comprador", buyer, margin + half + 12, currentY, half, 60);
  currentY -= 68;
  page.drawRectangle({ x: margin, y: currentY - 38, width: contentWidth, height: 38, color: rgb(1, 0.99, 0.965), borderColor: border, borderWidth: 0.6 });
  page.drawText("Local de descarga", { x: margin + 7, y: currentY - 10, size: 6.4, font: bold, color: gold });
  drawTextBox(page, partyLines(delivery, undefined, 3).join(" | "), margin + 7, currentY - 17, contentWidth - 14, 18, { font, bold, size: 7.2, minSize: 5.8, lineHeight: 1.08, maxLines: 2, color: ink, important: true });
  currentY -= 45;

  currentY = sectionTitle("Itens negociados", currentY);
  const columns = [
    { label: "Produto", x: margin + 8, width: 150 },
    { label: "Procedencia", x: margin + 162, width: 84 },
    { label: "Sacas", x: margin + 254, width: 58 },
    { label: "Peso/sc", x: margin + 318, width: 58 },
    { label: "R$/saca", x: margin + 382, width: 62 },
    { label: "Total", x: margin + 452, width: contentWidth - 452 }
  ];
  page.drawRectangle({ x: margin, y: currentY - 15, width: contentWidth, height: 15, color: headerColor });
  columns.forEach((column) => page.drawText(column.label, { x: column.x, y: currentY - 10.5, size: 6.8, font: bold, color: headerText }));
  currentY -= 15;
  detail.items.forEach((item) => {
    const rowHeight = 23;
    page.drawRectangle({ x: margin, y: currentY - rowHeight, width: contentWidth, height: rowHeight, color: rgb(1, 0.995, 0.98), borderColor: rgb(0.88, 0.82, 0.72), borderWidth: 0.35 });
    drawTextBox(page, item.productNameSnapshot, columns[0].x, currentY - 6, columns[0].width, rowHeight - 6, { font, bold, size: 6.8, minSize: 5.5, lineHeight: 1.08, maxLines: 2, color: ink, important: true });
    drawTextBox(page, item.originSnapshot ?? "-", columns[1].x, currentY - 6, columns[1].width, rowHeight - 6, { font, bold, size: 6.7, minSize: 5.4, lineHeight: 1.05, maxLines: 2, color: ink });
    drawRightText(page, item.quantitySacksDecimal.replace(".", ","), columns[2].x, currentY - 14, columns[2].width, font, 6.9, ink);
    drawRightText(page, item.sackWeightKgDecimal.replace(".", ","), columns[3].x, currentY - 14, columns[3].width, font, 6.9, ink);
    drawRightText(page, `R$ ${formatDecimalCurrency(item.unitPriceDecimal)}`, columns[4].x, currentY - 14, columns[4].width, font, 6.9, ink);
    drawRightText(page, `R$ ${formatCents(item.totalAmountCents)}`, columns[5].x, currentY - 14, columns[5].width, bold, 6.9, ink);
    currentY -= rowHeight;
  });
  currentY -= 7;

  const commercialHeight = 66;
  const colWidth = (contentWidth - 10) / 2;
  const commercialLines = [
    `Pagamento: ${confirmation.paymentTermsSnapshot ?? "Nao informado"}`,
    confirmation.deliveryLocationSnapshot ? `Entrega: ${confirmation.deliveryLocationSnapshot}` : null,
    `Corretagem: ${confirmation.brokeragePercentageBasisPoints != null ? `${(confirmation.brokeragePercentageBasisPoints / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%` : "Nao informada"}`,
    confirmation.publicNotes ? `Obs.: ${confirmation.publicNotes}` : null
  ].filter((item): item is string => Boolean(item));
  const bankLines = [
    confirmation.bankName ? `Banco: ${confirmation.bankName}` : null,
    confirmation.bankCode ? `Numero do banco: ${confirmation.bankCode}` : null,
    confirmation.bankAgency ? `Agencia: ${confirmation.bankAgency}` : null,
    confirmation.bankAccount ? `Conta: ${confirmation.bankAccount}` : null,
    confirmation.pixKey ? `PIX: ${confirmation.pixKey}` : null
  ].filter((item): item is string => Boolean(item));
  page.drawRectangle({ x: margin, y: currentY - commercialHeight, width: colWidth, height: commercialHeight, color: rgb(1, 0.99, 0.965), borderColor: border, borderWidth: 0.6 });
  page.drawRectangle({ x: margin + colWidth + 10, y: currentY - commercialHeight, width: colWidth, height: commercialHeight, color: rgb(1, 0.99, 0.965), borderColor: border, borderWidth: 0.6 });
  page.drawText("Condicoes comerciais", { x: margin + 7, y: currentY - 10, size: 6.4, font: bold, color: gold });
  page.drawText("Dados para deposito", { x: margin + colWidth + 17, y: currentY - 10, size: 6.4, font: bold, color: gold });
  drawTextBox(page, commercialLines.join("\n") || "Nao informado", margin + 7, currentY - 18, colWidth - 14, commercialHeight - 22, { font, bold, size: 7, minSize: 5.6, lineHeight: 1.14, maxLines: 5, color: ink, important: true });
  drawTextBox(page, bankLines.join("\n") || "Nao informado", margin + colWidth + 17, currentY - 18, colWidth - 14, commercialHeight - 22, { font, bold, size: 7, minSize: 5.6, lineHeight: 1.14, maxLines: 5, color: ink, important: true });
  currentY -= commercialHeight + 8;

  page.drawRectangle({ x: margin, y: currentY - 26, width: contentWidth, height: 26, color: rgb(0.94, 0.91, 0.84), borderColor: green, borderWidth: 0.7 });
  page.drawText(`TOTAL DE SACAS: ${confirmation.totalQuantitySacksDecimal.replace(".", ",")}`, { x: margin + 10, y: currentY - 17, size: 9.2, font: bold, color: ink });
  page.drawText(`VALOR TOTAL: R$ ${formatCents(confirmation.totalCommercialAmountCents)}`, { x: margin + contentWidth - 205, y: currentY - 17, size: 9.2, font: bold, color: green });
  currentY -= 34;

  const noteLines = [
    confirmation.qualityTermsSnapshot ? `Qualidade: ${confirmation.qualityTermsSnapshot}` : null,
    confirmation.generalTermsSnapshot ? `Condicoes gerais: ${confirmation.generalTermsSnapshot}` : null
  ].filter((item): item is string => Boolean(item));
  if (noteLines.length > 0) {
    page.drawRectangle({ x: margin, y: currentY - 28, width: contentWidth, height: 28, color: rgb(1, 0.995, 0.98), borderColor: border, borderWidth: 0.45 });
    page.drawText("Observacoes e termos", { x: margin + 7, y: currentY - 10, size: 6.3, font: bold, color: gold });
    drawTextBox(page, noteLines.join(" | "), margin + 7, currentY - 17, contentWidth - 14, 10, { font, bold, size: 6.4, minSize: 5.3, lineHeight: 1, maxLines: 1, color: muted });
    currentY -= 34;
  }

  const visibleClauses = detail.clauses.filter((clause) => clause.isVisible);
  if (visibleClauses.length > 0) {
    const clauseText = visibleClauses.slice(0, 2).map((clause, index) => `${clause.clauseNumber ?? index + 1}. ${clause.title ? `${clause.title}: ` : ""}${clause.clauseText}`).join(" ");
    page.drawRectangle({ x: margin, y: currentY - 28, width: contentWidth, height: 28, color: rgb(1, 0.995, 0.98), borderColor: border, borderWidth: 0.45 });
    page.drawText("Clausulas", { x: margin + 7, y: currentY - 10, size: 6.3, font: bold, color: gold });
    drawTextBox(page, clauseText, margin + 7, currentY - 17, contentWidth - 14, 10, { font, bold, size: 6.1, minSize: 5.2, lineHeight: 1, maxLines: 1, color: muted });
    currentY -= 34;
  }

  currentY = sectionTitle("Assinaturas", currentY);
  const signerData = detail.signers.length > 0
    ? detail.signers.slice(0, 2).map((signer) => ({ name: signer.name, role: signer.partyRole }))
    : [{ name: partyNameForSignature(seller), role: "SELLER" }, { name: partyNameForSignature(buyer), role: "BUYER" }];
  const sigHeight = 70;
  const sigColWidth = (contentWidth - 14) / 2;
  signerData.forEach((signer, index) => {
    const x = margin + index * (sigColWidth + 14);
    page.drawRectangle({ x, y: currentY - sigHeight, width: sigColWidth, height: sigHeight, color: rgb(1, 0.995, 0.98), borderColor: border, borderWidth: 0.55 });
    page.drawText("Área para assinatura", { x: x + 10, y: currentY - 12, size: 6.2, font, color: muted });
    line(x + 14, x + sigColWidth - 14, currentY - 38, rgb(0.22, 0.2, 0.17));
    drawTextBox(page, signer.name, x + 10, currentY - 49, sigColWidth - 20, 10, { font, bold, size: 6.8, minSize: 5.2, lineHeight: 1, maxLines: 1, color: ink });
    const role = signer.role === "SELLER" ? "Vendedor" : signer.role === "BUYER" ? "Comprador" : PARTY_ROLE_LABELS[signer.role] ?? signer.role;
    page.drawText(role, { x: x + 10, y: currentY - 64, size: 6.2, font, color: muted });
  });
  currentY -= sigHeight + 5;

  const footerY = margin + 4;
  if (currentY < footerY + 24) {
    throw new Error("Modelo de uma pagina excedido: reduza textos de participantes, condicoes comerciais ou observacoes para gerar a confirmacao.");
  }
  line(margin, pageWidth - margin, footerY + 12, rgb(0.86, 0.8, 0.7));
  const shortHash = input.versionId.slice(0, 8);
  page.drawText("Assinatura externa deve ser conferida fora do sistema. O sistema nao valida certificado digital.", { x: margin, y: footerY, size: 5.7, font, color: muted });
  page.drawText(`Confirmacao ${number} | Versao ${input.versionId.slice(0, 8)} | Pagina 1 de 1 | Hash ${shortHash}`, { x: pageWidth - margin - 210, y: footerY, size: 5.7, font, color: muted });

  if (doc.getPageCount() !== 1) {
    throw new Error("Modelo de uma pagina excedido: o PDF gerado teria mais de uma pagina.");
  }
  return doc.save();
}

export async function buildConfirmationPdf(input: Parameters<typeof generateDealConfirmationPdf>[0]): Promise<Uint8Array> {
  const { detail, organization, ownLegalEntity, draft } = input;
  const { confirmation } = detail;
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 30;
  const contentWidth = pageWidth - margin * 2;
  const dark = rgb(0.07, 0.055, 0.04);
  const ink = rgb(0.1, 0.08, 0.06);
  const muted = rgb(0.36, 0.32, 0.26);
  const border = rgb(0.73, 0.63, 0.49);
  const soft = rgb(0.96, 0.93, 0.87);
  const gold = rgb(0.69, 0.49, 0.29);
  const green = rgb(0.04, 0.42, 0.28);
  const graoHeaderGreen = rgb(0.015, 0.19, 0.13);
  const isGraoBrand = `${organization.slug} ${organization.displayName} ${ownLegalEntity.tradeName}`.toLowerCase().includes("grao");
  const headerColor = isGraoBrand ? graoHeaderGreen : dark;

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
      page.drawText(line, { x, y, size, font: usedFont, color: options.color ?? ink });
      y -= size + 4;
    });
    return lines.length;
  };

  const drawWrappedAt = (value: string, x: number, topY: number, width: number, options: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; lineGap?: number } = {}): number => {
    const size = options.size ?? 9;
    const usedFont = options.font ?? font;
    const lineGap = options.lineGap ?? 3;
    let lineY = topY;
    wrapText(value, usedFont, size, width).forEach((line) => {
      page.drawText(line, { x, y: lineY, size, font: usedFont, color: options.color ?? ink });
      lineY -= size + lineGap;
    });
    return lineY;
  };

  const drawSectionTitle = (title: string): void => {
    ensureSpace(16);
    page.drawRectangle({ x: margin, y: y - 12, width: 4, height: 12, color: green });
    page.drawText(title, { x: margin + 8, y: y - 10, size: 8.5, font: bold, color: ink });
    y -= 17;
  };

  const line = (fromX: number, toX: number, lineY: number, color = border): void => {
    page.drawLine({ start: { x: fromX, y: lineY }, end: { x: toX, y: lineY }, thickness: 0.75, color });
  };

  const addressLine = (snapshot: Partial<DealPartySnapshot>): string | null => {
    const address = [snapshot.addressLine, snapshot.addressNumber].filter(Boolean).join(", ");
    const district = snapshot.district ? ` - ${snapshot.district}` : "";
    return address ? `${address}${district}` : null;
  };

  const cityLine = (snapshot: Partial<DealPartySnapshot>): string | null => {
    return [snapshot.city, snapshot.state].filter(Boolean).join(" - ") || null;
  };

  const documentLine = (snapshot: Partial<DealPartySnapshot>): string | null => {
    const pieces = [];
    if (snapshot.taxId) pieces.push(`CNPJ/CPF: ${formatTaxId(snapshot.taxId)}`);
    if (snapshot.stateRegistration) pieces.push(`IE: ${snapshot.stateRegistration}`);
    return pieces.join("   |   ") || null;
  };

  const drawPartyBox = (title: string, party: (typeof detail.parties)[number] | null, x: number, topY: number, width: number, height: number): void => {
    const snapshot = party ? safeJson<Partial<DealPartySnapshot>>(party.snapshotJson, {}) : {};
    page.drawRectangle({ x, y: topY - height, width, height, color: rgb(1, 0.985, 0.95), borderColor: border, borderWidth: 0.8 });
    page.drawText(title, { x: x + 8, y: topY - 12, size: 6.8, font: bold, color: gold });
    const name = snapshot.name ?? party?.manualName ?? "Nao informado";
    let rowY = drawWrappedAt(name, x + 8, topY - 25, width - 16, { size: 8.6, font: bold, lineGap: 0.5 });
    const lines = [
      snapshot.legalName && snapshot.legalName !== name ? snapshot.legalName : null,
      addressLine(snapshot),
      cityLine(snapshot),
      documentLine(snapshot),
      snapshot.representativeName ? `Representante: ${snapshot.representativeName}` : null
    ].filter((item): item is string => Boolean(item));
    lines.forEach((item) => {
      if (rowY > topY - height + 10) {
        rowY = drawWrappedAt(item, x + 8, rowY, width - 16, { size: 6.9, color: muted, lineGap: 0.5 });
      }
    });
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
  page.drawRectangle({ x: 0, y: pageHeight - 76, width: pageWidth, height: 76, color: headerColor });
  if (logoImage) {
    const logoHeight = 36;
    const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
    page.drawImage(logoImage, { x: margin, y: pageHeight - 58, width: logoWidth, height: logoHeight });
  }
  const headerX = logoImage ? margin + 62 : margin;
  page.drawText(organization.displayName, { x: headerX, y: pageHeight - 28, size: 12.5, font: bold, color: rgb(1, 0.96, 0.88) });
  page.drawText(ownLegalEntity.legalName, { x: headerX, y: pageHeight - 43, size: 7.6, font, color: rgb(0.86, 0.76, 0.64) });
  page.drawText(truncate(`${addressLine(ownLegalEntity) ?? "Endereco pendente"} - ${cityLine(ownLegalEntity) ?? "Cidade/UF pendente"}`, font, 6.8, 300), { x: headerX, y: pageHeight - 55, size: 6.8, font, color: rgb(0.78, 0.7, 0.6) });
  page.drawText(`CNPJ: ${formatTaxId(ownLegalEntity.cnpj)}${ownLegalEntity.stateRegistration ? `   |   IE: ${ownLegalEntity.stateRegistration}` : ""}`, { x: headerX, y: pageHeight - 67, size: 6.8, font, color: rgb(0.78, 0.7, 0.6) });

  const title = draft ? "PREVIA - NAO ASSINAR" : "CONFIRMACAO DE NEGOCIO";
  const number = confirmation.confirmationNumber ?? confirmation.temporaryReference;
  page.drawRectangle({ x: pageWidth - margin - 142, y: pageHeight - 63, width: 142, height: 38, borderColor: gold, borderWidth: 0.8 });
  page.drawText(title, { x: pageWidth - margin - 133, y: pageHeight - 39, size: 7.1, font: bold, color: draft ? gold : rgb(1, 0.96, 0.88) });
  page.drawText(number, { x: pageWidth - margin - 133, y: pageHeight - 53, size: 9.1, font: bold, color: rgb(1, 0.96, 0.88) });
  page.drawText(`Data: ${formatDate(confirmation.negotiationDate ?? confirmation.confirmationDate)}`, { x: pageWidth - margin - 133, y: pageHeight - 62, size: 6.5, font, color: rgb(0.82, 0.76, 0.67) });
  y = pageHeight - 92;

  drawSectionTitle("Dados da negociacao");
  const metaTop = y;
  const metaCol = contentWidth / 4;
  [
    ["Data da negociacao", formatDate(confirmation.negotiationDate ?? confirmation.confirmationDate)],
    ["Data da emissao", formatDate(confirmation.confirmationDate)],
    ["Origem", detail.fiscalDocuments.length ? `${detail.fiscalDocuments.length} nota(s) fiscal(is)` : "Manual"],
    ["Corretagem", confirmation.brokeragePercentageBasisPoints != null ? `${(confirmation.brokeragePercentageBasisPoints / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%` : "Nao informada"]
  ].forEach(([label, value], index) => {
    const x = margin + index * metaCol;
    page.drawRectangle({ x, y: metaTop - 27, width: metaCol - 6, height: 27, color: soft, borderColor: border, borderWidth: 0.5 });
    page.drawText(label, { x: x + 6, y: metaTop - 11, size: 5.9, font: bold, color: gold });
    page.drawText(value, { x: x + 6, y: metaTop - 22, size: 7.4, font: bold, color: ink });
  });
  y = metaTop - 35;

  drawSectionTitle("Participantes");
  const seller = detail.parties.find((party) => party.partyRole === "SELLER") ?? detail.parties.find((party) => party.partyRole === "ISSUER") ?? null;
  const buyer = detail.parties.find((party) => party.partyRole === "BUYER") ?? null;
  const delivery = detail.parties.find((party) => party.partyRole === "DELIVERY_RECIPIENT") ?? buyer;
  const partyTop = y;
  const half = (contentWidth - 12) / 2;
  drawPartyBox("Vendedor", seller, margin, partyTop, half, 72);
  drawPartyBox("Comprador", buyer, margin + half + 12, partyTop, half, 72);
  y = partyTop - 79;
  drawPartyBox("Local de descarga", delivery, margin, y, contentWidth, 52);
  y -= 60;

  // Items table
  drawSectionTitle("Itens negociados");
  ensureSpace(44);
  const columns = [
    { label: "Produto", x: margin + 8, width: 150 },
    { label: "Procedencia", x: margin + 162, width: 84 },
    { label: "Sacas", x: margin + 254, width: 58 },
    { label: "Peso/sc", x: margin + 318, width: 58 },
    { label: "R$/saca", x: margin + 382, width: 62 },
    { label: "Total", x: margin + 452, width: contentWidth - 452 }
  ];
  page.drawRectangle({ x: margin, y: y - 16, width: contentWidth, height: 16, color: dark });
  columns.forEach((column) => page.drawText(column.label, { x: column.x, y: y - 11, size: 7, font: bold, color: rgb(1, 0.96, 0.88) }));
  y -= 18;
  detail.items.forEach((item) => {
    ensureSpace(22);
    page.drawRectangle({ x: margin, y: y - 15, width: contentWidth, height: 15, color: rgb(1, 0.995, 0.98), borderColor: rgb(0.88, 0.82, 0.72), borderWidth: 0.35 });
    page.drawText(truncate(item.productNameSnapshot, font, 7.2, columns[0].width), { x: columns[0].x, y: y - 10.5, size: 7.2, font, color: ink });
    page.drawText(truncate(item.originSnapshot ?? "-", font, 7.2, columns[1].width), { x: columns[1].x, y: y - 10.5, size: 7.2, font, color: ink });
    page.drawText(item.quantitySacksDecimal.replace(".", ","), { x: columns[2].x, y: y - 10.5, size: 7.2, font, color: ink });
    page.drawText(item.sackWeightKgDecimal.replace(".", ","), { x: columns[3].x, y: y - 10.5, size: 7.2, font, color: ink });
    page.drawText(`R$ ${item.unitPriceDecimal.replace(".", ",")}`, { x: columns[4].x, y: y - 10.5, size: 7.2, font, color: ink });
    page.drawText(`R$ ${formatCents(item.totalAmountCents)}`, { x: columns[5].x, y: y - 10.5, size: 7.2, font: bold, color: ink });
    y -= 16;
  });
  page.drawRectangle({ x: margin, y: y - 22, width: contentWidth, height: 22, color: soft, borderColor: border, borderWidth: 0.6 });
  page.drawText(`Total de sacas: ${confirmation.totalQuantitySacksDecimal.replace(".", ",")}`, { x: margin + 9, y: y - 15, size: 8.6, font: bold, color: ink });
  page.drawText(`Valor total: R$ ${formatCents(confirmation.totalCommercialAmountCents)}`, { x: margin + contentWidth - 160, y: y - 15, size: 8.6, font: bold, color: green });
  y -= 29;

  // Payment + bank block
  drawSectionTitle("Condicoes comerciais");
  ensureSpace(50);
  const paymentColWidth = (contentWidth - 20) / 2;
  const blockTop = y;
  page.drawRectangle({ x: margin, y: blockTop - 43, width: paymentColWidth, height: 43, color: rgb(1, 0.985, 0.95), borderColor: border, borderWidth: 0.6 });
  page.drawText("Pagamento", { x: margin + 8, y: blockTop - 12, size: 6.8, font: bold, color: gold });
  drawWrappedAt(confirmation.paymentTermsSnapshot ?? "Nao informado", margin + 8, blockTop - 25, paymentColWidth - 16, { size: 7.1, lineGap: 1 });
  const bankLines: string[] = [];
  if (confirmation.bankName) bankLines.push(`Banco: ${confirmation.bankName}${confirmation.bankCode ? ` (${confirmation.bankCode})` : ""}`);
  if (confirmation.bankAgency) bankLines.push(`Agencia: ${confirmation.bankAgency}`);
  if (confirmation.bankAccount) bankLines.push(`Conta: ${confirmation.bankAccount}`);
  if (confirmation.pixKey) bankLines.push(`PIX: ${confirmation.pixKey}`);
  const bankX = margin + paymentColWidth + 20;
  page.drawRectangle({ x: bankX, y: blockTop - 43, width: paymentColWidth, height: 43, color: rgb(1, 0.985, 0.95), borderColor: border, borderWidth: 0.6 });
  page.drawText("Dados para deposito", { x: bankX + 8, y: blockTop - 12, size: 6.8, font: bold, color: gold });
  let bankY = blockTop - 25;
  (bankLines.length ? bankLines : ["Nao informado"]).forEach((item) => {
    bankY = drawWrappedAt(item, bankX + 8, bankY, paymentColWidth - 16, { size: 7.1, lineGap: 1 });
  });
  y = blockTop - 52;

  const notes = [
    confirmation.qualityTermsSnapshot ? `Qualidade: ${confirmation.qualityTermsSnapshot}` : null,
    confirmation.deliveryLocationSnapshot ? `Entrega: ${confirmation.deliveryLocationSnapshot}` : null,
    confirmation.generalTermsSnapshot ? `Condicoes gerais: ${confirmation.generalTermsSnapshot}` : null,
    confirmation.publicNotes ? `Observacoes: ${confirmation.publicNotes}` : null
  ].filter((item): item is string => Boolean(item));
  if (notes.length > 0) {
    const notesHeight = 14 + notes.length * 10;
    ensureSpace(notesHeight);
    page.drawRectangle({ x: margin, y: y - notesHeight, width: contentWidth, height: notesHeight, color: rgb(1, 0.995, 0.98), borderColor: border, borderWidth: 0.5 });
    page.drawText("Observacoes e termos", { x: margin + 8, y: y - 10, size: 6.8, font: bold, color: gold });
    y -= 20;
    notes.forEach((item) => { y = drawWrappedAt(item, margin + 8, y, contentWidth - 16, { size: 6.8, color: muted, lineGap: 0.5 }); });
    y -= 3;
  }

  const visibleClauses = detail.clauses.filter((clause) => clause.isVisible);
  if (visibleClauses.length > 0) {
    y -= 4;
    ensureSpace(20);
    drawSectionTitle("Clausulas");
    visibleClauses.forEach((clause, index) => {
      ensureSpace(16);
      text(`${clause.clauseNumber ?? index + 1}. ${clause.title ? `${clause.title} - ` : ""}${clause.clauseText}`, margin, { size: 8.5, maxWidth: contentWidth });
    });
  }

  // Signatures side by side
  if (detail.signers.length > 0) {
    ensureSpace(104);
    drawSectionTitle("Assinaturas");
    const sigColWidth = (contentWidth - 20) / 2;
    const sigTop = y;
    detail.signers.forEach((signer, index) => {
      const col = index % 2;
      const sigX = margin + col * (sigColWidth + 20);
      const row = Math.floor(index / 2);
      const boxTop = sigTop - row * 102;
      page.drawRectangle({ x: sigX, y: boxTop - 82, width: sigColWidth, height: 82, color: rgb(1, 0.995, 0.98), borderColor: border, borderWidth: 0.6 });
      page.drawText("Area para assinatura digital", { x: sigX + 16, y: boxTop - 14, size: 6.2, font, color: muted });
      line(sigX + 16, sigX + sigColWidth - 16, boxTop - 55, rgb(0.2, 0.2, 0.2));
      page.drawText(truncate(signer.name, bold, 7.8, sigColWidth - 32), { x: sigX + 16, y: boxTop - 68, size: 7.8, font: bold, color: ink });
      page.drawText(`${PARTY_ROLE_LABELS[signer.partyRole] ?? signer.partyRole}${draft ? "" : ` - ${signer.signatureStatus}`}`, { x: sigX + 16, y: boxTop - 77, size: 6.6, font, color: muted });
    });
    y = sigTop - Math.ceil(detail.signers.length / 2) * 90 - 3;
  }

  ensureSpace(20);
  line(margin, pageWidth - margin, y + 6, rgb(0.86, 0.8, 0.7));
  text("A assinatura externa deve ser conferida fora do sistema. Esta etapa nao valida certificado digital.", margin, { size: 7.2, color: muted, maxWidth: contentWidth });

  return doc.save();
}

function drawTextBox(page: PDFPage, value: string, x: number, topY: number, width: number, height: number, options: TextBoxOptions): number {
  const sanitized = sanitizePdfText(value || "Nao informado");
  for (let size = options.size; size >= options.minSize; size -= 0.2) {
    const lines = sanitized
      .split("\n")
      .flatMap((line) => wrapText(line, options.font, size, width))
      .slice(0, options.maxLines);
    const lineStep = size * options.lineHeight;
    const usedHeight = lines.length * lineStep;
    const allContentFits = lines.length === sanitized.split("\n").flatMap((line) => wrapText(line, options.font, size, width)).length;
    if (usedHeight <= height && (allContentFits || !options.important)) {
      lines.forEach((line, index) => {
        const textWidth = options.font.widthOfTextAtSize(line, size);
        const textX = options.align === "right" ? x + width - textWidth : options.align === "center" ? x + (width - textWidth) / 2 : x;
        page.drawText(line, { x: textX, y: topY - size - index * lineStep, size, font: options.font, color: options.color });
      });
      return usedHeight;
    }
  }
  if (options.important) {
    throw new Error("Modelo de uma pagina excedido: ha texto juridico importante maior que o quadro reservado.");
  }
  const size = options.minSize;
  wrapText(sanitized, options.font, size, width).slice(0, options.maxLines).forEach((line, index) => {
    page.drawText(line, { x, y: topY - size - index * size * options.lineHeight, size, font: options.font, color: options.color });
  });
  return Math.min(height, options.maxLines * size * options.lineHeight);
}

function drawRightText(page: PDFPage, value: string, x: number, y: number, width: number, usedFont: PDFFont, size: number, color: PdfColor): void {
  const text = sanitizePdfText(value);
  const textWidth = usedFont.widthOfTextAtSize(text, size);
  page.drawText(text, { x: x + width - textWidth, y, size, font: usedFont, color });
}

function sanitizePdfText(value: string): string {
  return value
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function wrapText(value: string, usedFont: PDFFont, size: number, maxWidth: number): string[] {
  const words = sanitizePdfText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    const wordFits = usedFont.widthOfTextAtSize(word, size) <= maxWidth;
    const candidate = current ? `${current} ${word}` : word;
    if (usedFont.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      if (wordFits) {
        current = word;
      } else {
        const chunks = breakLongWord(word, usedFont, size, maxWidth);
        lines.push(...chunks.slice(0, -1));
        current = chunks[chunks.length - 1] ?? "";
      }
    } else if (!wordFits && !current) {
      const chunks = breakLongWord(word, usedFont, size, maxWidth);
      lines.push(...chunks.slice(0, -1));
      current = chunks[chunks.length - 1] ?? "";
    } else {
      current = candidate;
    }
  });
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function breakLongWord(value: string, usedFont: PDFFont, size: number, maxWidth: number): string[] {
  const chunks: string[] = [];
  let current = "";
  value.split("").forEach((char) => {
    const candidate = `${current}${char}`;
    if (current && usedFont.widthOfTextAtSize(candidate, size) > maxWidth) {
      chunks.push(current);
      current = char;
    } else {
      current = candidate;
    }
  });
  if (current) chunks.push(current);
  return chunks;
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

function formatDecimalCurrency(value: string): string {
  const parsed = Number(value.replace(",", "."));
  if (Number.isFinite(parsed)) {
    return parsed.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  return value.replace(".", ",");
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "nao informada";
  const [datePart] = value.split("T");
  const parts = datePart.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return value;
}

function formatTaxId(value: string | null | undefined): string {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return value ?? "nao informado";
}

function buildDealConfirmationFileName(input: Parameters<typeof generateDealConfirmationPdf>[0]): string {
  const seller = findPartyFileLabel(input.detail, "SELLER") ?? compactCompanyName(input.ownLegalEntity.tradeName);
  const buyer = findPartyFileLabel(input.detail, "BUYER") ?? "Comprador";
  const sequence = input.detail.confirmation.confirmationNumber
    ? extractConfirmationSequence(input.detail.confirmation.confirmationNumber)
    : `PREVIA ${input.detail.confirmation.temporaryReference}`;

  return `${safeFileNamePart(seller)} X ${safeFileNamePart(buyer)} ${safeFileNamePart(sequence)}.pdf`;
}

function findPartyFileLabel(detail: DealConfirmationDetail, role: "SELLER" | "BUYER"): string | null {
  const party = detail.parties.find((item) => item.partyRole === role);
  if (!party) return null;
  const snapshot = safeJson<Partial<DealPartySnapshot>>(party.snapshotJson, {});
  return compactCompanyName(snapshot.name ?? party.manualName ?? snapshot.legalName ?? "");
}

function compactCompanyName(value: string): string {
  const normalized = normalizeAscii(value).replace(/&/g, " E ");
  const clean = normalized
    .replace(/\b(cafe|coffee|comercio|exp|exportacao|importacao|ltda|eireli|me|sa|s\/a|operacoes)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const lower = clean.toLowerCase();
  const sourceState = normalized.match(/\b(Minas Gerais|Espirito Santo|Sao Paulo|MG|ES|SP)\b/i)?.[1] ?? "";
  const sourceLower = normalized.toLowerCase();
  const state = sourceState || (sourceLower.includes("monte santo") || sourceLower.includes("andradas") ? "MG" : sourceLower.includes("iuna") ? "ES" : sourceLower.includes("santo antonio do jardim") ? "SP" : "");
  const stateSuffix = state ? stateAbbreviation(state) : "";
  if (lower.includes("villa")) return `VILLA${stateSuffix ? ` ${stateSuffix}` : ""}`;
  if (lower.includes("grao")) return `GRAO E GRAO${stateSuffix ? ` ${stateSuffix}` : ""}`;
  return simplifyCounterpartyName(clean).slice(0, 40) || "EMPRESA";
}

function extractConfirmationSequence(value: string): string {
  const match = value.match(/(\d+)(?!.*\d)/);
  if (!match) return value;
  return String(Number(match[1]));
}

function safeFileNamePart(value: string): string {
  const normalized = normalizeAscii(value)
    .replace(/&/g, " E ")
    .split("")
    .map((char) => (char.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(char) ? " " : char))
    .join("")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
  return normalized.slice(0, 56).trim() || "SEM NOME";
}

function stateAbbreviation(value: string): string {
  const normalized = normalizeAscii(value).toLowerCase();
  if (normalized === "minas gerais" || normalized === "mg") return "MG";
  if (normalized === "espirito santo" || normalized === "es") return "ES";
  if (normalized === "sao paulo" || normalized === "sp") return "SP";
  return value.toUpperCase().slice(0, 2);
}

function simplifyCounterpartyName(value: string): string {
  return normalizeAscii(value)
    .replace(/&/g, " E ")
    .replace(/\b(cafe|coffee|comercio|exp|exportacao|importacao|ltda|eireli|me|sa|s\/a|industria|agropecuaria|fazenda)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeAscii(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function escapePdf(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
