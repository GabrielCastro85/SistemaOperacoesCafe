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
    writeFileSync(storedFilePath, await buildStyledConfirmationReportPdf(input));
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

  const partyFullAddress = (snapshot: Partial<DealPartySnapshot>): string | null => {
    const lines = [partyAddress(snapshot), partyCity(snapshot), snapshot.postalCode ? `CEP: ${formatPostalCode(snapshot.postalCode)}` : null].filter(Boolean);
    return lines.length ? lines.join(" - ") : null;
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

  const deliveryLines = (party: (typeof detail.parties)[number] | null): string[] => {
    const snapshot = party ? safeJson<Partial<DealPartySnapshot>>(party.snapshotJson, {}) : {};
    const name = snapshot.name ?? party?.manualName ?? "Nao informado";
    return [name, partyDocument(snapshot), partyFullAddress(snapshot)].filter((item): item is string => Boolean(item));
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
  drawTextBox(page, deliveryLines(delivery).join(" | "), margin + 7, currentY - 17, contentWidth - 14, 20, { font, bold, size: 7.1, minSize: 5.2, lineHeight: 1.08, maxLines: 3, color: ink, important: true });
  currentY -= 45;

  currentY = sectionTitle("Itens negociados", currentY);
  const columns = [
    { label: "Produto", x: margin + 8, width: 150 },
    { label: "Procedencia", x: margin + 162, width: 84 },
    { label: "Sacas", x: margin + 254, width: 58 },
    { label: "Peso/sc", x: margin + 318, width: 58 },
    { label: "R$/saca", x: margin + 382, width: 62 },
    { label: "Total", x: margin + 452, width: contentWidth - 464 }
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
    `Corretagem: ${confirmation.brokeragePercentageBasisPoints != null ? `${(confirmation.brokeragePercentageBasisPoints / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%` : "Nao informada"}`
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
    confirmation.publicNotes ? `Observacoes: ${confirmation.publicNotes}` : null,
    confirmation.qualityTermsSnapshot ? `Qualidade: ${confirmation.qualityTermsSnapshot}` : null,
    confirmation.generalTermsSnapshot ? `Condicoes gerais: ${confirmation.generalTermsSnapshot}` : null
  ].filter((item): item is string => Boolean(item));
  page.drawRectangle({ x: margin, y: currentY - 30, width: contentWidth, height: 30, color: rgb(1, 0.995, 0.98), borderColor: border, borderWidth: 0.45 });
  page.drawText("Observacoes", { x: margin + 7, y: currentY - 10, size: 6.3, font: bold, color: gold });
  drawTextBox(page, noteLines.join(" | ") || "Observacoes adicionais", margin + 7, currentY - 17, contentWidth - 14, 13, { font, bold, size: 6.3, minSize: 5.1, lineHeight: 1, maxLines: 2, color: muted });
  currentY -= 36;

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
    { label: "Total", x: margin + 452, width: contentWidth - 464 }
  ];
  page.drawRectangle({ x: margin, y: y - 16, width: contentWidth, height: 16, color: dark });
  columns.forEach((column) => page.drawText(column.label, { x: column.x, y: y - 11, size: 7, font: bold, color: rgb(1, 0.96, 0.88) }));
  y -= 18;
  detail.items.forEach((item) => {
    ensureSpace(22);
    page.drawRectangle({ x: margin, y: y - 15, width: contentWidth, height: 15, color: rgb(1, 0.995, 0.98), borderColor: rgb(0.88, 0.82, 0.72), borderWidth: 0.35 });
    page.drawText(truncate(item.productNameSnapshot, font, 7.2, columns[0].width), { x: columns[0].x, y: y - 10.5, size: 7.2, font, color: ink });
    page.drawText(truncate(item.originSnapshot ?? "-", font, 7.2, columns[1].width), { x: columns[1].x, y: y - 10.5, size: 7.2, font, color: ink });
    drawRightText(page, item.quantitySacksDecimal.replace(".", ","), columns[2].x, y - 10.5, columns[2].width, font, 7.2, ink);
    drawRightText(page, item.sackWeightKgDecimal.replace(".", ","), columns[3].x, y - 10.5, columns[3].width, font, 7.2, ink);
    drawRightText(page, `R$ ${item.unitPriceDecimal.replace(".", ",")}`, columns[4].x, y - 10.5, columns[4].width, font, 7.2, ink);
    drawRightText(page, `R$ ${formatCents(item.totalAmountCents)}`, columns[5].x, y - 10.5, columns[5].width, bold, 7.2, ink);
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
    confirmation.publicNotes ? `Observacoes: ${confirmation.publicNotes}` : null,
    confirmation.qualityTermsSnapshot ? `Qualidade: ${confirmation.qualityTermsSnapshot}` : null,
    confirmation.deliveryLocationSnapshot ? `Entrega: ${confirmation.deliveryLocationSnapshot}` : null,
    confirmation.generalTermsSnapshot ? `Condicoes gerais: ${confirmation.generalTermsSnapshot}` : null
  ].filter((item): item is string => Boolean(item));
  const notesHeight = Math.max(34, 14 + Math.min(notes.length || 1, 4) * 10);
  ensureSpace(notesHeight);
  page.drawRectangle({ x: margin, y: y - notesHeight, width: contentWidth, height: notesHeight, color: rgb(1, 0.995, 0.98), borderColor: border, borderWidth: 0.5 });
  page.drawText("Observacoes", { x: margin + 8, y: y - 10, size: 6.8, font: bold, color: gold });
  y -= 20;
  (notes.length ? notes : ["Observacoes adicionais"]).slice(0, 4).forEach((item) => { y = drawWrappedAt(item, margin + 8, y, contentWidth - 16, { size: 6.8, color: muted, lineGap: 0.5 }); });
  y -= 3;

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

async function buildStyledConfirmationReportPdf(input: Parameters<typeof generateDealConfirmationReportFile>[0]): Promise<Uint8Array> {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 28;
  const contentWidth = pageWidth - margin * 2;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const colors = confirmationReportColors(input.organization, input.ownLegalEntity);
  const logo = await embedReportLogo(doc, input.organization);
  const totalCents = input.confirmations.reduce((sum, detail) => sum + detail.confirmation.totalCommercialAmountCents, 0);
  const totalSacks = input.confirmations.reduce((sum, detail) => sum + Number(detail.confirmation.totalQuantitySacksDecimal.replace(",", ".")), 0);

  const addPage = (pageNumber: number): PDFPage => {
    const page = doc.addPage([pageWidth, pageHeight]);
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: colors.background });
    page.drawRectangle({ x: margin, y: pageHeight - margin - 88, width: contentWidth, height: 88, color: colors.header });
    page.drawRectangle({ x: margin, y: pageHeight - margin - 90, width: contentWidth, height: 2, color: colors.accent });
    if (logo) {
      const size = fitReportImage(logo.width, logo.height, 54, 54);
      page.drawImage(logo.image, { x: margin + 12, y: pageHeight - margin - 70, width: size.width, height: size.height });
    }
    const headerX = logo ? margin + 78 : margin + 14;
    page.drawText("RELATORIO DE CONFIRMACOES", { x: headerX, y: pageHeight - margin - 24, size: 13.5, font: bold, color: colors.headerText });
    page.drawText(input.ownLegalEntity?.tradeName ?? input.organization.displayName, { x: headerX, y: pageHeight - margin - 43, size: 8.5, font: bold, color: colors.headerMuted });
    page.drawText(`Gerado em ${formatDateTime(new Date().toISOString())}`, { x: headerX, y: pageHeight - margin - 58, size: 7, font, color: colors.headerMuted });
    drawRightText(page, `Pagina ${pageNumber}`, pageWidth - margin - 105, pageHeight - margin - 24, 90, bold, 10, colors.headerText);
    drawRightText(page, input.organization.appDisplayName, pageWidth - margin - 150, pageHeight - margin - 42, 135, font, 7, colors.headerMuted);
    return page;
  };

  let page = addPage(1);
  let y = pageHeight - margin - 112;
  drawReportInfoBox(page, "ESCOPO", [input.organization.displayName, input.ownLegalEntity?.tradeName ?? "Todos os CNPJs"], margin, y, 258, 64, { font, bold, colors });
  drawReportInfoBox(page, "RESUMO", [`Confirmacoes: ${input.confirmations.length}`, `Valor comercial: R$ ${formatCents(totalCents)}`], margin + 270, y, 269, 64, { font, bold, colors });
  y -= 84;
  drawReportCards(page, y, contentWidth, margin, [
    ["CONFIRMACOES", String(input.confirmations.length)],
    ["SACAS", totalSacks.toLocaleString("pt-BR", { maximumFractionDigits: 3 })],
    ["VALOR", `R$ ${formatCents(totalCents)}`],
    ["TIPO", confirmationReportLabel(input.reportType)]
  ], { font, bold, colors });
  y -= 86;
  drawReportSectionTitle(page, "Confirmacoes", margin, y, bold, colors);
  y -= 18;
  drawConfirmationReportTableHeader(page, margin, y, contentWidth, { bold, colors });
  y -= 30;

  input.confirmations.forEach((detail) => {
    if (y < 58) {
      page = addPage(doc.getPageCount() + 1);
      y = pageHeight - margin - 120;
      drawReportSectionTitle(page, "Confirmacoes", margin, y, bold, colors);
      y -= 18;
      drawConfirmationReportTableHeader(page, margin, y, contentWidth, { bold, colors });
      y -= 30;
    }
    drawConfirmationReportRow(page, detail, margin, y, contentWidth, { font, bold, colors });
    y -= 20;
  });

  if (input.confirmations.length === 0) {
    drawReportInfoBox(page, "SEM REGISTROS", ["Nenhuma confirmacao encontrada para os filtros selecionados."], margin, y + 4, contentWidth, 48, { font, bold, colors });
  }

  doc.getPages().forEach((reportPage) => {
    reportPage.drawText("Relatorio gerencial local gerado pelo Sistema de Operacoes de Cafe.", { x: margin, y: 22, size: 6.5, font, color: colors.muted });
  });
  return doc.save();
}

function drawReportCards(page: PDFPage, y: number, contentWidth: number, margin: number, cards: Array<[string, string]>, style: { font: PDFFont; bold: PDFFont; colors: ReturnType<typeof confirmationReportColors> }): void {
  const gap = 9;
  const width = (contentWidth - gap * (cards.length - 1)) / cards.length;
  cards.forEach(([label, value], index) => {
    const x = margin + index * (width + gap);
    page.drawRectangle({ x, y: y - 52, width, height: 52, color: style.colors.paper, borderColor: style.colors.border, borderWidth: 0.55 });
    page.drawText(label, { x: x + 10, y: y - 18, size: 6.8, font: style.bold, color: style.colors.muted });
    page.drawText(truncate(value, style.bold, 10.5, width - 20), { x: x + 10, y: y - 39, size: 10.5, font: style.bold, color: style.colors.ink });
  });
}

function drawConfirmationReportTableHeader(page: PDFPage, x: number, y: number, width: number, style: { bold: PDFFont; colors: ReturnType<typeof confirmationReportColors> }): void {
  page.drawRectangle({ x, y: y - 18, width, height: 18, color: style.colors.soft, borderColor: style.colors.border, borderWidth: 0.45 });
  [
    ["DATA", x + 8],
    ["NUMERO", x + 58],
    ["VENDEDOR", x + 126],
    ["COMPRADOR", x + 244],
    ["SACAS", x + 382],
    ["VALOR", x + 432],
    ["STATUS", x + 500]
  ].forEach(([label, columnX]) => page.drawText(String(label), { x: Number(columnX), y: y - 12, size: 6.4, font: style.bold, color: style.colors.muted }));
}

function drawConfirmationReportRow(page: PDFPage, detail: DealConfirmationDetail, x: number, y: number, width: number, style: { font: PDFFont; bold: PDFFont; colors: ReturnType<typeof confirmationReportColors> }): void {
  page.drawLine({ start: { x, y: y - 7 }, end: { x: x + width, y: y - 7 }, thickness: 0.35, color: style.colors.border });
  page.drawText(formatDate(detail.confirmation.confirmationDate), { x: x + 8, y, size: 7, font: style.font, color: style.colors.ink });
  page.drawText(truncate(detail.confirmation.confirmationNumber ?? detail.confirmation.temporaryReference, style.font, 7, 62), { x: x + 58, y, size: 7, font: style.font, color: style.colors.ink });
  page.drawText(truncate(partyName(detail, "SELLER"), style.font, 7, 110), { x: x + 126, y, size: 7, font: style.font, color: style.colors.ink });
  page.drawText(truncate(partyName(detail, "BUYER"), style.font, 7, 128), { x: x + 244, y, size: 7, font: style.font, color: style.colors.ink });
  drawRightText(page, detail.confirmation.totalQuantitySacksDecimal, x + 370, y, 42, style.font, 7, style.colors.ink);
  drawRightText(page, formatCents(detail.confirmation.totalCommercialAmountCents), x + 420, y, 62, style.bold, 7, style.colors.ink);
  page.drawText(truncate(detail.confirmation.status, style.font, 7, 44), { x: x + 500, y, size: 7, font: style.font, color: style.colors.ink });
}

function drawReportInfoBox(page: PDFPage, title: string, lines: string[], x: number, topY: number, width: number, height: number, style: { font: PDFFont; bold: PDFFont; colors: ReturnType<typeof confirmationReportColors> }): void {
  page.drawRectangle({ x, y: topY - height, width, height, color: style.colors.paper, borderColor: style.colors.border, borderWidth: 0.55 });
  page.drawText(title, { x: x + 10, y: topY - 16, size: 6.6, font: style.bold, color: style.colors.accent });
  lines.slice(0, 3).forEach((line, index) => {
    page.drawText(truncate(line, index === 0 ? style.bold : style.font, index === 0 ? 8.2 : 7.3, width - 20), { x: x + 10, y: topY - 32 - index * 13, size: index === 0 ? 8.2 : 7.3, font: index === 0 ? style.bold : style.font, color: style.colors.ink });
  });
}

function drawReportSectionTitle(page: PDFPage, title: string, x: number, topY: number, bold: PDFFont, colors: ReturnType<typeof confirmationReportColors>): void {
  page.drawRectangle({ x, y: topY - 10, width: 3, height: 10, color: colors.accent });
  page.drawText(title, { x: x + 8, y: topY - 9, size: 8.2, font: bold, color: colors.ink });
}

async function embedReportLogo(doc: PDFDocument, organization: Organization): Promise<{ image: Awaited<ReturnType<PDFDocument["embedPng"]>>; width: number; height: number } | { image: Awaited<ReturnType<PDFDocument["embedJpg"]>>; width: number; height: number } | null> {
  const source = resolveBrandingLogoBytes(organization);
  if (!source) return null;
  const ext = source.ext === "png" ? "png" : "jpeg";
  const image = ext === "png" ? await doc.embedPng(source.bytes) : await doc.embedJpg(source.bytes);
  return { image, width: image.width, height: image.height };
}

function fitReportImage(width: number, height: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return { width: width * scale, height: height * scale };
}

function confirmationReportColors(organization: Organization, ownLegalEntity: LegalEntity | null): {
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

function confirmationReportLabel(type: ConfirmationReportType): string {
  const labels: Record<ConfirmationReportType, string> = {
    CONFIRMATIONS_PERIOD: "Periodo",
    BY_SELLER: "Por vendedor",
    BY_BUYER: "Por comprador",
    BY_PRODUCT: "Por produto",
    BY_STATUS: "Por status",
    BY_SIGNATURE: "Por assinatura",
    WITHOUT_FISCAL_DOCUMENT: "Sem NF",
    WITHOUT_OPERATION: "Sem operacao"
  };
  return labels[type] ?? type;
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

function formatDateTime(value: string): string {
  const [datePart, timePart = ""] = value.split("T");
  const date = formatDate(datePart);
  return timePart ? `${date} ${timePart.slice(0, 5)}` : date;
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

function formatPostalCode(value: string | null | undefined): string {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length === 8) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return value ?? "";
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
