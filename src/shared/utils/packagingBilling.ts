// Remessa de sacaria (big bag vazio): a nota nao tem cafe, entao nao soma sacas.
// O valor cobrado e' informado por unidade no lancamento da nota.

export const PACKAGING_OVERRIDE_PREFIX = "Remessa de sacaria";
export const PACKAGING_PENDING_NOTE = "Remessa de sacaria: informe o valor a cobrar por unidade.";

const PACKAGING_CFOPS = new Set(["5920", "6920", "5921", "6921"]);

function normalize(value: unknown): string {
  return String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

/** Item do XML de remessa/retorno de vasilhame ou sacaria (CFOP x920/x921 ou NCM 6305). */
export function isPackagingXmlItem(item: { cfop?: unknown; ncm?: unknown }): boolean {
  return PACKAGING_CFOPS.has(String(item.cfop ?? "").trim()) || String(item.ncm ?? "").replace(/\D/g, "").startsWith("6305");
}

/** Nota ja lancada que e' remessa de sacaria, pela natureza da operacao ou pelo ajuste ja feito. */
export function isPackagingDocument(input: { documentNotes?: string | null; overrideReasons?: Array<string | null | undefined> }): boolean {
  if ((input.overrideReasons ?? []).some((reason) => reason?.startsWith(PACKAGING_OVERRIDE_PREFIX))) return true;
  const notes = normalize(input.documentNotes);
  return notes.includes("VASILHAME") || notes.includes("SACARIA");
}

/** Linha de cobranca de sacaria: sem sacas, mas com valor e valor por unidade. */
export function isPackagingChargeLine(line: { quantitySacks: string | null | undefined; amountCents: number; rateCents: number }): boolean {
  return Number(line.quantitySacks ?? 0) === 0 && line.amountCents > 0 && line.rateCents > 0;
}

export function packagingUnits(amountCents: number, rateCents: number): number {
  return rateCents > 0 ? Math.round(amountCents / rateCents) : 0;
}

export function packagingOverrideReason(units: string, unitValueCents: number): string {
  const value = (unitValueCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${PACKAGING_OVERRIDE_PREFIX}: ${units} un x R$ ${value}`;
}

export function removePendingNote(pendingNotes: string | null, note: string): string | null {
  const remaining = (pendingNotes ?? "").split(note).join(" ").replace(/\s+/g, " ").trim();
  return remaining || null;
}
