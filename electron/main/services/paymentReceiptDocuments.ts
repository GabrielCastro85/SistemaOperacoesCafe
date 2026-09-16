import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AppDirectories, BusinessPartner, ClientChargeDetail, ClientPayment, LegalEntity, Organization } from "../../../src/shared/types/domain.js";

type ReceiptInput = {
  directories: AppDirectories;
  organization: Organization;
  ownLegalEntity: LegalEntity;
  client: BusinessPartner;
  payment: ClientPayment;
  allocations: Array<{ amountCents: number; charge: ClientChargeDetail }>;
};

type ReceiptRow = { note: string; date: string; valueCents: number; paidCents: number; status: string };

export async function generatePaymentReceiptDocuments(input: ReceiptInput): Promise<{ pdfFilePath: string; imageFilePath: string }> {
  const year = input.payment.paymentDate.slice(0, 4);
  const dir = join(input.directories.chargesDir, "receipts", input.organization.id, input.ownLegalEntity.id, year, input.payment.id);
  mkdirSync(dir, { recursive: true });
  const pdfFilePath = join(dir, "recibo.pdf");
  const imageBasePath = join(dir, "recibo");
  const rows = receiptRows(input);
  writeFileSync(pdfFilePath, await buildReceiptPdf(input, rows));
  const imageFilePath = await writeReceiptImage(imageBasePath, input, rows);
  return { pdfFilePath, imageFilePath };
}

function receiptRows(input: ReceiptInput): ReceiptRow[] {
  const referenced = new Set(Array.from(input.payment.transactionReference?.matchAll(/NF\s+([^,]+)/gi) ?? []).map((match) => match[1].trim().toUpperCase()));
  const rows: ReceiptRow[] = [];
  for (const allocation of input.allocations) {
    let remaining = allocation.amountCents;
    const all = allocation.charge.operations;
    const chosen = referenced.size ? all.filter((operation) => referenced.has((operation.fiscalDocumentNumberSnapshot ?? "").toUpperCase())) : all;
    for (const operation of (chosen.length ? chosen : all)) {
      if (remaining <= 0) break;
      const paidCents = Math.min(remaining, operation.serviceAmountCentsSnapshot);
      remaining -= paidCents;
      rows.push({
        note: operation.fiscalDocumentNumberSnapshot ?? "-",
        date: operation.operationDateSnapshot,
        valueCents: operation.serviceAmountCentsSnapshot,
        paidCents,
        status: paidCents >= operation.serviceAmountCentsSnapshot ? "Paga integralmente" : "Pagamento parcial"
      });
    }
    if (remaining > 0) rows.push({ note: "Valor da cobranca", date: allocation.charge.charge.periodEnd, valueCents: allocation.amountCents, paidCents: remaining, status: "Pagamento parcial" });
  }
  return rows;
}

async function buildReceiptPdf(input: ReceiptInput, rows: ReceiptRow[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const primary = isGrao(input) ? rgb(0.015, 0.19, 0.13) : rgb(0.07, 0.055, 0.04);
  const accent = isGrao(input) ? rgb(0.04, 0.55, 0.32) : rgb(0.69, 0.49, 0.29);
  const ink = rgb(0.1, 0.08, 0.06);
  const muted = rgb(0.38, 0.34, 0.28);
  const border = rgb(0.78, 0.69, 0.55);
  page.drawRectangle({ x: 0, y: 0, width: 595.28, height: 841.89, color: rgb(0.985, 0.965, 0.925) });
  page.drawRectangle({ x: 28, y: 725, width: 539.28, height: 89, color: primary });
  page.drawRectangle({ x: 28, y: 723, width: 539.28, height: 2, color: accent });
  page.drawText("RECIBO DE PAGAMENTO", { x: 46, y: 778, size: 17, font: bold, color: rgb(1, .97, .9) });
  page.drawText(input.organization.appDisplayName, { x: 46, y: 754, size: 9, font: bold, color: rgb(.84, .77, .66) });
  page.drawText(`Data: ${formatDate(input.payment.paymentDate)}`, { x: 430, y: 778, size: 8, font: bold, color: rgb(1, .97, .9) });
  page.drawText(`Cliente: ${input.client.displayName}`, { x: 46, y: 684, size: 13, font: bold, color: ink });
  page.drawText(`Recebemos de ${input.client.displayName} o valor de`, { x: 46, y: 660, size: 9, font, color: muted });
  page.drawText(`R$ ${formatCents(input.payment.amountCents)}`, { x: 46, y: 622, size: 27, font: bold, color: accent });
  page.drawText(`Forma: ${paymentMethod(input.payment.paymentMethod)}${input.payment.transactionReference ? `  |  Referencia: ${input.payment.transactionReference}` : ""}`, { x: 46, y: 598, size: 8, font, color: muted });
  page.drawText("NOTAS E VALORES RECEBIDOS", { x: 46, y: 558, size: 8, font: bold, color: accent });
  page.drawRectangle({ x: 46, y: 528, width: 503, height: 22, color: rgb(.94, .9, .82) });
  [["NF", 56], ["DATA", 126], ["VALOR DA NOTA", 216], ["RECEBIDO", 338], ["SITUACAO", 445]].forEach(([label, x]) => page.drawText(String(label), { x: Number(x), y: 536, size: 7, font: bold, color: ink }));
  let y = 507;
  for (const row of rows.slice(0, 15)) {
    page.drawText(row.note, { x: 56, y, size: 8, font, color: ink });
    page.drawText(formatDate(row.date), { x: 126, y, size: 8, font, color: ink });
    page.drawText(`R$ ${formatCents(row.valueCents)}`, { x: 216, y, size: 8, font, color: ink });
    page.drawText(`R$ ${formatCents(row.paidCents)}`, { x: 338, y, size: 8, font: bold, color: ink });
    page.drawText(row.status, { x: 445, y, size: 7.3, font, color: muted });
    page.drawLine({ start: { x: 46, y: y - 8 }, end: { x: 549, y: y - 8 }, thickness: .35, color: border });
    y -= 27;
  }
  page.drawRectangle({ x: 46, y: Math.max(90, y - 58), width: 503, height: 48, color: rgb(.92, .97, .92), borderColor: accent, borderWidth: .7 });
  page.drawText("TOTAL RECEBIDO", { x: 60, y: Math.max(110, y - 32), size: 8, font: bold, color: muted });
  page.drawText(`R$ ${formatCents(input.payment.amountCents)}`, { x: 410, y: Math.max(106, y - 34), size: 15, font: bold, color: accent });
  page.drawText(`Documento gerado pelo Sistema de Operacoes de Cafe em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, { x: 46, y: 30, size: 6.5, font, color: muted });
  return doc.save();
}

async function writeReceiptImage(basePath: string, input: ReceiptInput, rows: ReceiptRow[]): Promise<string> {
  const height = Math.max(620, 350 + rows.length * 44);
  const primary = isGrao(input) ? "#043d2a" : "#17130f";
  const accent = isGrao(input) ? "#078a50" : "#b0794a";
  const rowMarkup = rows.map((row, index) => `<g transform="translate(0 ${330 + index * 44})"><line x1="38" y1="28" x2="1062" y2="28" stroke="#d7c7aa"/><text x="52" y="12" class="cell">NF ${escapeXml(row.note)}</text><text x="210" y="12" class="cell">${escapeXml(formatDate(row.date))}</text><text x="430" y="12" class="cell">Nota: R$ ${formatCents(row.valueCents)}</text><text x="690" y="12" class="strong">Recebido: R$ ${formatCents(row.paidCents)}</text><text x="1045" y="12" class="cell right">${escapeXml(row.status)}</text></g>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="${height}"><style>.title{font:700 28px Arial;fill:#fff8ec}.sub{font:700 14px Arial;fill:#d9c6a8}.label{font:700 12px Arial;fill:${accent}}.value{font:700 25px Arial;fill:#17130f}.cell{font:14px Arial;fill:#17130f}.strong{font:700 14px Arial;fill:#17130f}.right{text-anchor:end}</style><rect width="1100" height="${height}" fill="#f8f5ed"/><rect width="1100" height="96" fill="${primary}"/><rect y="96" width="1100" height="4" fill="${accent}"/><text x="38" y="43" class="title">RECIBO DE PAGAMENTO</text><text x="38" y="70" class="sub">${escapeXml(input.organization.appDisplayName)}</text><text x="1062" y="43" class="sub right">${escapeXml(formatDate(input.payment.paymentDate))}</text><rect x="38" y="126" width="1024" height="128" rx="10" fill="#fffdf8" stroke="#cbb895"/><text x="58" y="157" class="label">CLIENTE</text><text x="58" y="188" class="value">${escapeXml(input.client.displayName)}</text><text x="58" y="222" class="cell">Valor recebido</text><text x="1042" y="222" class="value right">R$ ${formatCents(input.payment.amountCents)}</text><text x="38" y="298" class="label">NOTAS E VALORES RECEBIDOS</text>${rowMarkup}<rect x="38" y="${height - 92}" width="1024" height="58" rx="9" fill="#edf7ed" stroke="${accent}"/><text x="58" y="${height - 57}" class="label">TOTAL RECEBIDO</text><text x="1042" y="${height - 54}" class="value right">R$ ${formatCents(input.payment.amountCents)}</text></svg>`;
  if (process.versions.electron) {
    const { nativeImage } = await import("electron");
    const pngPath = `${basePath}.png`;
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
    const image = nativeImage.createFromDataURL(dataUrl);
    if (image.isEmpty()) throw new Error("Nao foi possivel converter o recibo para PNG.");
    writeFileSync(pngPath, image.toPNG());
    return pngPath;
  }
  const svgPath = `${basePath}.svg`;
  writeFileSync(svgPath, svg, "utf8");
  return svgPath;
}

function isGrao(input: ReceiptInput): boolean { return `${input.organization.slug} ${input.organization.displayName} ${input.ownLegalEntity.tradeName}`.toLowerCase().includes("grao"); }
function formatCents(cents: number): string { return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatDate(value: string | null): string { if (!value) return "-"; const [year, month, day] = value.slice(0, 10).split("-"); return `${day}/${month}/${year}`; }
function paymentMethod(value: string): string { return ({ PIX: "PIX", BANK_TRANSFER: "Transferencia bancaria", CASH: "Dinheiro", CHECK: "Cheque", OFFSET: "Compensacao", OTHER: "Outro" } as Record<string, string>)[value] ?? value; }
function escapeXml(value: string): string { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] ?? char); }
