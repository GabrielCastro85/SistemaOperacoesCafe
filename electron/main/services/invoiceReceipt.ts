import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import { receiptCityLine, receiptSegments, type InvoiceReceiptData, type ReceiptSegment } from "../../../src/shared/utils/invoiceReceiptText.js";

export * from "../../../src/shared/utils/invoiceReceiptText.js";

// Recibo de pagamento no modelo usado pela Villa/Grao (ex.: "Recibo de
// Pagamento DLG 652"): titulo sublinhado, um paragrafo justificado com os
// dados da(s) nota(s), cidade e data, linha de assinatura e o nome de quem
// recebeu (o vendedor). O logo da empresa em operacao sai abaixo do nome
// quando ela e quem assina.

type Word = { text: string; bold: boolean; width: number; spaceAfter: boolean };

function toWords(segments: ReceiptSegment[], regular: PDFFont, bold: PDFFont, size: number): Word[] {
  const words: Word[] = [];
  for (const segment of segments) {
    const font = segment.bold ? bold : regular;
    // separa em palavras guardando se havia espaco depois (negrito colado em virgula etc.)
    // So espaco comum quebra linha; o espaco nao separavel fica dentro da palavra.
    const pieces = segment.text.match(/[^ \n\t]+|[ \n\t]+/g) ?? [];
    for (const piece of pieces) {
      if (/^[ \n\t]+$/.test(piece)) { if (words.length) words[words.length - 1].spaceAfter = true; continue; }
      words.push({ text: piece, bold: segment.bold, width: font.widthOfTextAtSize(piece, size), spaceAfter: false });
    }
  }
  return words;
}

export async function buildInvoiceReceiptPdf(data: InvoiceReceiptData, logo: { bytes: Uint8Array; ext: "png" | "jpeg" } | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Recibo de Pagamento ${data.documentNumbers.join(", ")}`);
  const page = doc.addPage([595.28, 841.89]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0, 0, 0);
  const size = 12;
  const left = 88;
  const right = 523;
  const width = right - left;
  const lineHeight = 12.9;
  let y = 841.89 - 98;

  // Titulo centralizado, negrito e sublinhado
  const title = "RECIBO DE PAGAMENTO";
  const titleWidth = bold.widthOfTextAtSize(title, size);
  const titleX = left + (width - titleWidth) / 2;
  page.drawText(title, { x: titleX, y, size, font: bold, color: ink });
  page.drawLine({ start: { x: titleX, y: y - 1.6 }, end: { x: titleX + titleWidth, y: y - 1.6 }, thickness: 0.8, color: ink });

  // Paragrafo justificado
  y -= 26;
  const words = toWords(receiptSegments(data), regular, bold, size);
  const space = regular.widthOfTextAtSize(" ", size);
  const lines: Word[][] = [];
  let current: Word[] = [];
  let currentWidth = 0;
  for (const word of words) {
    const gap = current.length && current[current.length - 1].spaceAfter ? space : 0;
    if (current.length && currentWidth + gap + word.width > width) {
      lines.push(current);
      current = [word];
      currentWidth = word.width;
    } else {
      current.push(word);
      currentWidth += gap + word.width;
    }
  }
  if (current.length) lines.push(current);
  lines.forEach((line, index) => {
    const isLast = index === lines.length - 1;
    const gaps = line.slice(0, -1).filter((word) => word.spaceAfter).length;
    const natural = line.reduce((sum, word, wordIndex) => sum + word.width + (wordIndex < line.length - 1 && word.spaceAfter ? space : 0), 0);
    const extra = !isLast && gaps > 0 ? (width - natural) / gaps : 0;
    let x = left;
    line.forEach((word, wordIndex) => {
      page.drawText(word.text, { x, y, size, font: word.bold ? bold : regular, color: ink });
      x += word.width;
      if (wordIndex < line.length - 1 && word.spaceAfter) x += space + extra;
    });
    y -= lineHeight;
  });

  // Cidade e data
  y -= 33;
  page.drawText(receiptCityLine(data), { x: left, y, size, font: bold, color: ink });

  // Assinatura: espaco para a assinatura digital, linha e nome de quem recebeu
  y -= 89;
  const lineStart = 173;
  page.drawLine({ start: { x: lineStart, y }, end: { x: right, y }, thickness: 1, color: ink });
  const signer = data.seller.name.toLocaleUpperCase("pt-BR");
  const signerSize = 11.2;
  const signerWidth = bold.widthOfTextAtSize(signer, signerSize);
  // No modelo o nome fica centralizado no bloco de texto (nao na linha).
  const center = (left + right) / 2;
  y -= 15;
  page.drawText(signer, { x: center - signerWidth / 2, y, size: signerSize, font: bold, color: ink });

  if (logo && data.seller.isOwn) {
    try {
      const image = logo.ext === "png" ? await doc.embedPng(logo.bytes) : await doc.embedJpg(logo.bytes);
      const ratio = Math.min(140 / image.width, 60 / image.height);
      const logoWidth = image.width * ratio;
      const logoHeight = image.height * ratio;
      page.drawImage(image, { x: center - logoWidth / 2, y: y - 12 - logoHeight, width: logoWidth, height: logoHeight });
    } catch { /* logo invalido: recibo sai sem ele */ }
  }
  return doc.save();
}
