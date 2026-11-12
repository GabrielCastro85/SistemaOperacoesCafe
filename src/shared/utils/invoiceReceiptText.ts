import { currencyInWords } from "./currencyInWords.js";
import type { InvoiceReceiptParty } from "../types/domain.js";

// Texto do recibo de pagamento (modelo "Recibo de Pagamento DLG 652"). Usado
// pelo PDF (electron/main/services/invoiceReceipt.ts) e pela previa na tela.

export type ReceiptParty = InvoiceReceiptParty;

export interface InvoiceReceiptData {
  documentNumbers: string[];
  sacks: string;
  goodsDescription: string;
  seller: ReceiptParty;
  buyer: ReceiptParty;
  amountCents: number;
  /** AAAA-MM-DD */
  date: string;
}

export interface ReceiptSegment { text: string; bold: boolean }

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function formatReceiptDocument(value: string | null): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 14) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  if (digits.length === 11) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  return value ?? "";
}

function formatCep(value: string | null): string {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : (value ?? "");
}

export function formatReceiptMoney(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const reais = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}R$ ${reais},${String(abs % 100).padStart(2, "0")}`;
}

export function receiptAddress(party: ReceiptParty): string {
  const up = (value: string | null) => (value ?? "").trim().toLocaleUpperCase("pt-BR");
  const main = [up(party.street), party.number ? (/^s\/?n$/i.test(party.number.trim()) ? "SN" : `N° ${up(party.number)}`) : "", up(party.district), party.cep ? `CEP: ${formatCep(party.cep)}` : ""].filter(Boolean).join(", ");
  // Espaco nao separavel antes do traco: a linha nunca comeca com ele.
  const place = [up(party.city), up(party.state)].filter(Boolean).join(" – ");
  return [main, place].filter(Boolean).join(" – ");
}

function partyIdentification(party: ReceiptParty): string {
  const digits = (party.document ?? "").replace(/\D/g, "");
  const kind = digits.length === 11 ? "CPF" : "CNPJ";
  const parts = [party.document ? `inscrita sob ${kind}: ${formatReceiptDocument(party.document)}` : ""];
  if (party.stateRegistration) parts.push(`IE: ${party.stateRegistration}`);
  const address = receiptAddress(party);
  if (address) parts.push(`localizada na ${address}`);
  return parts.filter(Boolean).join(", ");
}

function listWithAnd(values: string[]): string[] {
  // devolve os separadores entre os itens: "", ", ", " e "
  return values.map((_, index) => index === 0 ? "" : index === values.length - 1 ? " e " : ", ");
}

/** Paragrafo do recibo, com os trechos em negrito do modelo. */
export function receiptSegments(data: InvoiceReceiptData): ReceiptSegment[] {
  const segments: ReceiptSegment[] = [];
  const add = (text: string, bold = false) => segments.push({ text, bold });
  const plural = data.documentNumbers.length > 1;
  add(plural ? "Referente às notas fiscais nº " : "Referente a nota fiscal nº ");
  const separators = listWithAnd(data.documentNumbers);
  data.documentNumbers.forEach((number, index) => { if (separators[index]) add(separators[index]); add(number, true); });
  add(`, referente a compra de ${data.sacks} sacas de ${data.goodsDescription} do vendedor `);
  add(data.seller.name.toLocaleUpperCase("pt-BR"), true);
  const sellerId = partyIdentification(data.seller);
  add(`${sellerId ? `, ${sellerId}` : ""}, declara ter recebido o valor de `);
  add(formatReceiptMoney(data.amountCents), true);
  add(` (${currencyInWords(data.amountCents)}) da empresa `);
  add(data.buyer.name.toLocaleUpperCase("pt-BR"), true);
  const buyerId = partyIdentification(data.buyer);
  add(`${buyerId ? `, ${buyerId}` : ""}.`);
  return segments;
}

export function receiptCityLine(data: InvoiceReceiptData): string {
  const [year, month, day] = data.date.split("-").map(Number);
  const city = (data.seller.city ?? data.buyer.city ?? "").toLocaleUpperCase("pt-BR");
  const when = `${day} de ${MONTHS[(month ?? 1) - 1]} de ${year}`;
  return `${city ? `${city}, ` : ""}${when}.`;
}

export function receiptPlainText(data: InvoiceReceiptData): string {
  return `RECIBO DE PAGAMENTO\n\n${receiptSegments(data).map((segment) => segment.text).join("")}\n\n${receiptCityLine(data)}\n\n____________________________\n${data.seller.name.toLocaleUpperCase("pt-BR")}`;
}

