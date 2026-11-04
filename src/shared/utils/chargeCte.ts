import { multiplyDecimalByCents, sumDecimalTexts } from "./decimal.js";
import { formatCurrencyFromCents, parseCurrencyToCents } from "./format.js";

export interface ChargeCteNote {
  id: string;
  number: string;
  company: string;
  sacks: string;
}

export function defaultsToCte(company: string): boolean {
  return /\bvassuler\b/i.test(company.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
}

export function calculateChargeCte(notes: ChargeCteNote[], unitValueCents: number) {
  const sacks = sumDecimalTexts(notes.map((note) => note.sacks));
  const unitValue = formatCurrencyFromCents(unitValueCents);
  return {
    sacks,
    amountCents: multiplyDecimalByCents(sacks, unitValueCents),
    description: `CT-e (${sacks.replace(".", ",")} sacas x ${unitValue})`,
    reason: `${sacks.replace(".", ",")} sacas a ${unitValue}/saca. Notas de referencia: ${notes.map((note) => `NF ${note.number} - ${note.company} (${note.sacks.replace(".", ",")} sacas)`).join("; ")}.`
  };
}

// Read the persisted calculation without changing old adjustments or their values.
// Unrecognized/manual descriptions keep the standard adjustment presentation.
export function readChargeCte(adjustment: { description: string; reason: string | null; amountCents: number; effect: string }) {
  const calculation = /^CT-e \(([\d.,]+) sacas x (R\$\s*[\d.,]+)\)$/.exec(adjustment.description);
  if (!calculation || !adjustment.reason || adjustment.effect !== "INCREASE_RECEIVABLE") return null;
  const notes = [...adjustment.reason.matchAll(/NF (\S+) - (.*?) \(([\d.,]+) sacas\)(?=; |\.?$)/g)].map((match, index) => ({
    id: String(index), number: match[1], company: match[2], sacks: match[3].replace(",", ".")
  }));
  if (!notes.length) return null;
  try {
    const sacks = sumDecimalTexts(notes.map((note) => note.sacks));
    const unitValueCents = parseCurrencyToCents(calculation[2]);
    if (sacks !== sumDecimalTexts([calculation[1].replace(",", ".")]) || multiplyDecimalByCents(sacks, unitValueCents) !== adjustment.amountCents) return null;
    return { notes, sacks, unitValueCents };
  } catch {
    return null;
  }
}
