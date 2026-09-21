import { chargePeriodLabel } from "../../../src/shared/utils/chargeLabel.js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { partnerRateSummaryInputSchema } from "../../../src/shared/schemas/domainSchemas.js";
import { formatCurrencyFromCents, formatDateOnlyBr } from "../../../src/shared/utils/format.js";
import { sumDecimalTexts } from "../../../src/shared/utils/decimal.js";
import { fiscalDocumentCounterpartyNameFromSnapshot, fiscalDocumentIssuerNameFromSnapshot } from "../../../src/shared/utils/fiscalDocumentLabels.js";
import type { ClientChargeDetail, Organization } from "../../../src/shared/types/domain.js";
import type { AppRepository } from "./appRepository.js";

export const partnerPeriodReportInputSchema = partnerRateSummaryInputSchema.extend({ clientPartnerId: z.string().uuid() })
  .refine((value) => value.periodStart <= value.periodEnd, "O inicio deve ser anterior ao fim do periodo.");

export function getPartnerPeriodReport(repository: AppRepository, input: unknown) {
  const filters = partnerPeriodReportInputSchema.parse(input);
  const client = repository.getBusinessPartner(filters.clientPartnerId);
  const organization = repository.getOrganization(filters.organizationId);
  const entities = repository.listLegalEntities({ status: "all" });
  const charges = new Map<string, ClientChargeDetail>();
  const rows = repository.listOperations({
    ...(filters.includeAllCompanies ? {} : { organizationId: filters.organizationId, ownLegalEntityId: filters.ownLegalEntityId ?? undefined }),
    responsiblePartnerId: filters.clientPartnerId, periodStart: filters.periodStart, periodEnd: filters.periodEnd,
    status: "all", billingStatus: "all"
  }).filter((operation) => operation.operationType === "SALE" && ["DRAFT", "CONFIRMED"].includes(operation.status))
    .flatMap((operation) => {
      let detail: ClientChargeDetail | undefined;
      if (operation.clientChargeId) {
        detail = charges.get(operation.clientChargeId) ?? repository.getClientCharge(operation.clientChargeId, false);
        charges.set(operation.clientChargeId, detail);
      }
      const charge = detail?.charge;
      const activeCharge = charge && !["CANCELLED", "REPLACED"].includes(charge.status) ? charge : undefined;
      // Match the summary: unchecked keeps unbilled notes and charges still open.
      if (!filters.includeAlreadyBilled && operation.billingStatus !== "UNBILLED" &&
        !(operation.billingStatus === "BILLED" && activeCharge && activeCharge.openAmountCents > 0 && activeCharge.status !== "PAID")) return [];
      const document = repository.getFiscalDocument(operation.fiscalDocumentId).document;
      if (document.status === "CANCELED") return [];
      const entity = entities.find((item) => item.id === operation.ownLegalEntityId);
      const snapshot = activeCharge ? detail?.operations.find((item) => item.operationId === operation.id && !item.releasedAt) : undefined;
      const triangulatedDestination = document.secondaryResponsiblePartnerId
        ? repository.getBusinessPartner(operation.responsiblePartnerId).displayName
        : null;
      const status = !activeCharge ? "Nao cobrada" : activeCharge.openAmountCents === 0 ? "Quitada" :
        activeCharge.paidAmountCents > 0 ? "Cobranca parcial" : ["DRAFT", "PENDING_REVIEW"].includes(activeCharge.status) ? "Em rascunho" : "Em aberto";
      return [{
        operationId: operation.id, fiscalDocumentId: document.id, number: document.documentNumber, series: document.series,
        issuer: snapshot?.issuerNameSnapshot ?? fiscalDocumentIssuerNameFromSnapshot(document) ?? entity?.legalName ?? "Empresa nao registrada",
        date: operation.operationDate, company: snapshot?.ownLegalEntityNameSnapshot ?? entity?.legalName ?? "Empresa nao registrada",
        destination: snapshot?.destinationNameSnapshot ?? triangulatedDestination ?? fiscalDocumentCounterpartyNameFromSnapshot(document, entity?.cnpj) ?? "-",
        sacks: snapshot?.quantitySacksDecimalSnapshot ?? operation.quantitySacks,
        amountCents: snapshot?.serviceAmountCentsSnapshot ?? operation.serviceAmountCents,
        scope: operation.operationScope === "INTERNAL" ? "Mesma UF" : "Outra UF", status,
        chargeNumber: activeCharge ? chargePeriodLabel(activeCharge, true) : "-"
      }];
    }).sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number, "pt-BR", { numeric: true }) || a.operationId.localeCompare(b.operationId));
  return { filters, clientName: client.displayName, organization, rows };
}

export type PartnerPeriodReport = ReturnType<typeof getPartnerPeriodReport>;

export async function buildPartnerPeriodReportPdf(report: PartnerPeriodReport): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.08, 0.06), muted = rgb(0.36, 0.32, 0.26);
  const border = rgb(0.73, 0.63, 0.49), soft = rgb(0.965, 0.94, 0.885), paper = rgb(1, 0.99, 0.965);
  const gold = rgb(0.69, 0.49, 0.29), green = rgb(0.035, 0.36, 0.24), headerText = rgb(1, 0.96, 0.88);
  const width = 842, height = 595, margin = 28, contentWidth = width - margin * 2;
  const brandText = `${report.organization.slug} ${report.organization.displayName} ${report.organization.appDisplayName}`.toLowerCase();
  const headerColor = brandText.includes("grao") || brandText.includes("grão") ? rgb(0.015, 0.19, 0.13) : rgb(0.07, 0.055, 0.04);
  const columns = [28, 125, 365, 428, 488, 582, 710];
  const widths = [90, 232, 56, 53, 87, 121, 104];
  const clean = (text: string) => Array.from(text.replace(/[\r\n\t]/g, " ")).map((char) => {
    try { font.encodeText(char); return char; } catch { return "?"; }
  }).join("");
  const wrap = (text: string, maxWidth: number, size = 9): string[] => {
    const lines: string[] = [];
    let line = "";
    for (const word of clean(text).trim().split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) { lines.push(line); line = ""; }
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        line = word;
        continue;
      }
      let fragment = "";
      for (const char of word) {
        if (fragment && font.widthOfTextAtSize(fragment + char, size) > maxWidth) {
          lines.push(fragment);
          fragment = "";
        }
        fragment += char;
      }
      line = fragment;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  };
  let page = pdf.addPage([width, height]);
  let y = height - margin;
  const draw = (text: string, x: number, baseline: number, size = 9, strong = false) => page.drawText(clean(text), { x, y: baseline, size, font: strong ? bold : font, color: ink });
  const right = (text: string, x: number, baseline: number, maxWidth: number, size = 9, strong = false, color = ink) => {
    const used = strong ? bold : font;
    const value = clean(text);
    page.drawText(value, { x: x + maxWidth - used.widthOfTextAtSize(value, size), y: baseline, size, font: used, color });
  };
  const header = async (continuation = false) => {
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.985, 0.965, 0.925) });
    if (continuation) {
      page.drawRectangle({ x: margin, y: height - margin - 36, width: contentWidth, height: 36, color: headerColor });
      page.drawRectangle({ x: margin, y: height - margin - 38, width: contentWidth, height: 2, color: gold });
      page.drawText("CONTROLE DE NOTAS DO PERIODO - CONTINUACAO", { x: margin + 12, y: height - margin - 23, size: 10, font: bold, color: headerText });
      right(`${formatDateOnlyBr(report.filters.periodStart)} a ${formatDateOnlyBr(report.filters.periodEnd)}`, width - margin - 190, height - margin - 23, 174, 7.5, false, rgb(0.82, 0.76, 0.67));
      y = height - margin - 55;
      page.drawRectangle({ x: margin, y: y - 20, width: contentWidth, height: 20, color: soft, borderColor: border, borderWidth: 0.45 });
      ["NF / DATA", "EMPRESA / DESTINO", "UF", "SACAS", "SERVICO", "SITUACAO", "PERIODO COBRANCA"].forEach((label, i) => page.drawText(label, { x: columns[i] + 5, y: y - 13, size: 6.5, font: bold, color: muted }));
      y -= 31;
      return;
    }
    page.drawRectangle({ x: margin, y: height - margin - 76, width: contentWidth, height: 76, color: headerColor });
    page.drawRectangle({ x: margin, y: height - margin - 78, width: contentWidth, height: 2, color: gold });
    const logo = await embedReportLogo(pdf, report.organization);
    let headerX = margin + 16;
    if (logo) {
      const ratio = Math.min(48 / logo.width, 48 / logo.height);
      page.drawImage(logo.image, { x: margin + 12, y: height - margin - 62, width: logo.width * ratio, height: logo.height * ratio });
      headerX = margin + 72;
    }
    page.drawText(continuation ? "CONTROLE DE NOTAS - CONTINUACAO" : "CONTROLE DE NOTAS DO PERIODO", { x: headerX, y: height - margin - 25, size: 14, font: bold, color: headerText });
    page.drawText(report.organization.appDisplayName, { x: headerX, y: height - margin - 43, size: 8.5, font: bold, color: rgb(0.84, 0.75, 0.63) });
    right(formatDateOnlyBr(report.filters.periodStart), width - margin - 190, height - margin - 25, 174, 8.5, true, headerText);
    right(`ate ${formatDateOnlyBr(report.filters.periodEnd)}`, width - margin - 190, height - margin - 43, 174, 7.5, false, rgb(0.82, 0.76, 0.67));
    y = height - margin - 98;
    page.drawRectangle({ x: margin, y: y - 48, width: 390, height: 48, color: paper, borderColor: border, borderWidth: 0.55 });
    page.drawText("CLIENTE / CORRETOR", { x: margin + 12, y: y - 15, size: 7, font: bold, color: gold });
    page.drawText(clean(report.clientName), { x: margin + 12, y: y - 34, size: 10, font: bold, color: ink });
    page.drawRectangle({ x: margin + 400, y: y - 48, width: contentWidth - 400, height: 48, color: paper, borderColor: border, borderWidth: 0.55 });
    page.drawText("PERIODO E ESCOPO", { x: margin + 412, y: y - 15, size: 7, font: bold, color: gold });
    page.drawText(`${formatDateOnlyBr(report.filters.periodStart)} a ${formatDateOnlyBr(report.filters.periodEnd)}`, { x: margin + 412, y: y - 32, size: 9, font: bold, color: ink });
    page.drawText(`Notas ja cobradas: ${report.filters.includeAlreadyBilled ? "incluidas" : "nao incluidas"}`, { x: margin + 610, y: y - 32, size: 7.5, font, color: muted });
    y -= 70;
    page.drawRectangle({ x: margin, y: y - 10, width: 3, height: 10, color: green });
    page.drawText("Notas do periodo", { x: margin + 8, y: y - 8, size: 8.5, font: bold, color: ink });
    y -= 18;
    page.drawRectangle({ x: margin, y: y - 20, width: contentWidth, height: 20, color: soft, borderColor: border, borderWidth: 0.45 });
    ["NF / DATA", "EMPRESA / DESTINO", "UF", "SACAS", "SERVICO", "SITUACAO", "PERIODO COBRANCA"].forEach((label, i) => page.drawText(label, { x: columns[i] + 5, y: y - 13, size: 6.5, font: bold, color: muted }));
    y -= 31;
  };
  await header();
  for (const row of report.rows) {
    const companyLines = wrap(row.company, widths[1]);
    const destinationLines = wrap(row.destination, widths[1]);
    const cells = [
      [`NF ${row.number}${row.series ? ` / ${row.series}` : ""}`, formatDateOnlyBr(row.date)],
      [...companyLines, ...destinationLines], [row.scope], [row.sacks.replace(".", ",")],
      [formatCurrencyFromCents(row.amountCents)], [row.status], [row.chargeNumber]
    ].map((parts, i) => i === 1 ? parts : parts.flatMap((part) => wrap(part, widths[i])));
    const rowHeight = Math.max(...cells.map((cell) => cell.length)) * 11 + 14;
    if (y - rowHeight < 42) { page = pdf.addPage([width, height]); await header(true); }
    const rowColors = reportRowColors(row.company);
    page.drawRectangle({ x: margin, y: y - rowHeight + 4, width: contentWidth, height: rowHeight, color: rowColors.background });
    page.drawRectangle({ x: margin, y: y - rowHeight + 4, width: 3, height: rowHeight, color: rowColors.stripe });
    cells.forEach((lines, i) => lines.forEach((line, index) => page.drawText(clean(line), {
      x: columns[i] + 5,
      y: y - 9 - index * 11,
      size: 8,
      font: i === 4 || (i === 1 && index >= companyLines.length) ? bold : font,
      color: ink
    })));
    y -= rowHeight;
  }
  if (y < 125) { page = pdf.addPage([width, height]); await header(true); }
  y -= 15;
  page.drawRectangle({ x: margin, y: y - 58, width: contentWidth, height: 58, color: paper, borderColor: border, borderWidth: 0.55 });
  page.drawText("RESUMO DO CONTROLE", { x: margin + 12, y: y - 16, size: 7, font: bold, color: gold });
  const noteCount = new Set(report.rows.map((row) => row.fiscalDocumentId)).size;
  page.drawText(`${noteCount} notas`, { x: margin + 12, y: y - 39, size: 12, font: bold, color: ink });
  page.drawText(`${sumDecimalTexts(report.rows.map((row) => row.sacks)).replace(".", ",")} sacas`, { x: margin + 190, y: y - 39, size: 12, font: bold, color: ink });
  right(formatCurrencyFromCents(report.rows.reduce((sum, row) => sum + row.amountCents, 0)), margin + 480, y - 39, contentWidth - 492, 13, true, green);
  y -= 75;
  for (const note of [
    "Relatorio de conferencia. Nao cria cobranca nem reserva operacoes. Cada linha representa uma operacao da nota.",
    "Situacao atual da cobranca: quitada pode incluir creditos/descontos. Em cobranca parcial, nao ha baixa individual por nota.",
    "O total acima soma servicos das notas; nao representa saldo liquido a receber e nao inclui ajustes da conta-corrente."
  ]) { for (const line of wrap(note, width - margin * 2, 8)) { draw(line, margin, y, 8); y -= 12; } }
  pdf.getPages().forEach((item, index) => {
    item.drawText(`Gerado pelo Sistema de Operacoes de Cafe em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, { x: margin, y: 18, size: 6.5, font, color: muted });
    item.drawText(`${report.organization.appDisplayName} | ${index + 1} / ${pdf.getPageCount()}`, { x: width - margin - 190, y: 18, size: 6.5, font: bold, color: gold });
  });
  return pdf.save();
}

function reportRowColors(value: string): { background: ReturnType<typeof rgb>; stripe: ReturnType<typeof rgb> } {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/grao\s*(?:&|e)\s*grao/.test(normalized)) return { background: rgb(0.93, 0.975, 0.94), stripe: rgb(0.16, 0.55, 0.35) };
  if (normalized.includes("villa")) return { background: rgb(0.985, 0.935, 0.86), stripe: rgb(0.61, 0.42, 0.24) };
  return { background: rgb(0.92, 0.95, 0.98), stripe: rgb(0.28, 0.43, 0.62) };
}

async function embedReportLogo(doc: PDFDocument, organization: Organization) {
  let bytes: Buffer | null = null;
  let extension = "png";
  if (organization.logoPath?.startsWith("data:")) {
    const match = /^data:image\/(png|jpe?g);base64,(.+)$/.exec(organization.logoPath);
    if (match) { extension = match[1]; bytes = Buffer.from(match[2], "base64"); }
  } else if (organization.logoPath && existsSync(organization.logoPath)) {
    extension = extname(organization.logoPath).slice(1).toLowerCase(); bytes = readFileSync(organization.logoPath);
  }
  if (!bytes) {
    const name = `${organization.slug} ${organization.displayName} ${organization.appDisplayName}`.toLowerCase();
    const variant = name.includes("villa") ? "villa" : name.includes("grao") || name.includes("grão") ? "grao" : null;
    const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
    const candidate = variant ? [join(appRoot, "dist", "assets", "branding", variant, "logo.png"), join(appRoot, "public", "assets", "branding", variant, "logo.png"), join(process.cwd(), "dist", "assets", "branding", variant, "logo.png"), join(process.cwd(), "public", "assets", "branding", variant, "logo.png")].find(existsSync) : undefined;
    if (candidate) { bytes = readFileSync(candidate); extension = "png"; }
  }
  if (!bytes) return null;
  try {
    const image = extension === "png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    return { image, width: image.width, height: image.height };
  } catch { return null; }
}
