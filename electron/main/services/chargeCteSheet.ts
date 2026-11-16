import { sumDecimalTexts } from "../../../src/shared/utils/decimal.js";

// Notas do CT-e (frete) da planilha PHT: uma linha por NF, com data, empresa, destino e sacas.
// Os dados vem das notas gravadas na planilha (cte_sheet_notes), nao da cobranca.
export const CTE_SHEET_EMPTY_MESSAGE = "Esta cobranca nao tem notas de CT-e para gerar o PHT.";

export interface ChargeCteSheetRow {
  date: string;
  company: string;
  sacks: string;
  destination: string;
  nf: string;
}

export interface ChargeCteData {
  rows: ChargeCteSheetRow[];
  unitValueCents: number;
}

export interface ChargeCteNoteRecord {
  date: string;
  company: string;
  sacks: string;
  destination: string;
  nf: string;
}

// Agrupa as notas por NF e empresa (uma linha por nota), somando as sacas.
export function groupCteNotes(notes: ChargeCteNoteRecord[]): ChargeCteSheetRow[] {
  const groups = new Map<string, { date: string; company: string; sacks: string[]; destination: string; nf: string }>();
  for (const note of notes) {
    const key = `${note.nf}|${note.company}`;
    const group = groups.get(key);
    if (group) {
      group.sacks.push(note.sacks);
      if (note.date < group.date) group.date = note.date;
    } else {
      groups.set(key, { date: note.date, company: note.company, sacks: [note.sacks], destination: note.destination, nf: note.nf });
    }
  }
  return [...groups.values()]
    .map((group) => ({ date: group.date, company: group.company, sacks: sumDecimalTexts(group.sacks), destination: group.destination, nf: group.nf }))
    .sort((left, right) => left.date.localeCompare(right.date) || Number(left.nf) - Number(right.nf));
}
