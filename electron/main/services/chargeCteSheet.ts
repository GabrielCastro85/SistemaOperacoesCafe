import { readChargeCte } from "../../../src/shared/utils/chargeCte.js";
import { isPackagingChargeLine } from "../../../src/shared/utils/packagingBilling.js";
import { sumDecimalTexts } from "../../../src/shared/utils/decimal.js";
import type { ClientChargeDetail } from "../../../src/shared/types/domain.js";

// Notas do CT-e (frete) da cobranca, usadas pela planilha e pelo PDF "PHT":
// uma linha por NF, com data, empresa, destino e sacas.
export const CTE_SHEET_EMPTY_MESSAGE = "Esta cobranca nao tem CT-e com notas para gerar o PHT.";
export interface ChargeCteSheetRow {
  date: string;
  company: string;
  sacks: string;
  destination: string;
  nf: string;
}

export function chargeCteSheetRows(detail: ClientChargeDetail): { rows: ChargeCteSheetRow[]; unitValueCents: number } | null {
  const cte = detail.adjustments.map((adjustment) => readChargeCte(adjustment)).find((value) => value !== null);
  if (!cte) return null;
  const noteNumbers = new Set(cte.notes.map((note) => note.number));
  const groups = new Map<string, { date: string; company: string; sacks: string[]; destination: string; nf: string }>();
  for (const operation of detail.operations) {
    const nf = operation.fiscalDocumentNumberSnapshot ?? "";
    if (!noteNumbers.has(nf)) continue;
    if (isPackagingChargeLine({ quantitySacks: operation.quantitySacksDecimalSnapshot, amountCents: operation.serviceAmountCentsSnapshot, rateCents: operation.serviceRateCentsSnapshot })) continue;
    const key = `${nf}|${operation.ownLegalEntityNameSnapshot ?? ""}`;
    const date = operation.operationDateSnapshot.slice(0, 10);
    const group = groups.get(key);
    if (group) {
      group.sacks.push(operation.quantitySacksDecimalSnapshot);
      if (date < group.date) group.date = date;
    } else {
      groups.set(key, { date, company: operation.ownLegalEntityNameSnapshot ?? operation.issuerShortLabel ?? "", sacks: [operation.quantitySacksDecimalSnapshot], destination: operation.destinationNameSnapshot ?? "", nf });
    }
  }
  const rows = [...groups.values()]
    .map((group) => ({ date: group.date, company: group.company, sacks: sumDecimalTexts(group.sacks), destination: group.destination, nf: group.nf }))
    .sort((left, right) => left.date.localeCompare(right.date) || Number(left.nf) - Number(right.nf));
  if (!rows.length) return null;
  return { rows, unitValueCents: cte.unitValueCents };
}
