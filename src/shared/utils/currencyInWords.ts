// Valor em reais por extenso (recibos): 72450000 -> "setecentos e vinte e
// quatro mil e quinhentos reais".

const UNITS = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const TENS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const HUNDREDS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function belowThousand(value: number): string {
  if (value === 0) return "";
  if (value === 100) return "cem";
  const hundred = Math.floor(value / 100);
  const rest = value % 100;
  const parts: string[] = [];
  if (hundred) parts.push(HUNDREDS[hundred]);
  if (rest) {
    if (rest < 20) parts.push(UNITS[rest]);
    else {
      const ten = Math.floor(rest / 10);
      const unit = rest % 10;
      parts.push(unit ? `${TENS[ten]} e ${UNITS[unit]}` : TENS[ten]);
    }
  }
  return parts.join(" e ");
}

const SCALES: Array<[string, string]> = [["", ""], ["mil", "mil"], ["milhão", "milhões"], ["bilhão", "bilhões"]];

/** Inteiro por extenso (ate bilhoes). */
export function integerInWords(value: number): string {
  if (!Number.isFinite(value) || value < 0) throw new Error("Valor invalido para escrever por extenso.");
  const whole = Math.floor(value);
  if (whole === 0) return "zero";
  const groups: number[] = [];
  for (let rest = whole; rest > 0; rest = Math.floor(rest / 1000)) groups.push(rest % 1000);
  const pieces: Array<{ text: string; group: number; scale: number }> = [];
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index];
    if (!group) continue;
    const [singular, plural] = SCALES[index] ?? ["", ""];
    let text: string;
    if (index === 1) text = group === 1 ? "mil" : `${belowThousand(group)} mil`;
    else if (index >= 2) text = `${belowThousand(group)} ${group === 1 ? singular : plural}`;
    else text = belowThousand(group);
    pieces.push({ text, group, scale: index });
  }
  // "e" antes do ultimo grupo quando ele e menor que 100 ou centena redonda
  // (mil e quinhentos, dois mil e trinta); senao, virgula/espaco.
  return pieces.map((piece, index) => {
    if (index === 0) return piece.text;
    const isLast = index === pieces.length - 1;
    const roundOrSmall = piece.group < 100 || piece.group % 100 === 0;
    // ultimo grupo pequeno/redondo: "e"; centenas depois do mil: espaco; demais: virgula
    return `${isLast && roundOrSmall ? " e " : piece.scale === 0 ? " " : ", "}${piece.text}`;
  }).join("").replace(/ ,/g, ",");
}

/** Reais por extenso a partir de centavos. */
export function currencyInWords(cents: number): string {
  const total = Math.round(cents);
  if (total < 0) return `menos ${currencyInWords(-total)}`;
  const reais = Math.floor(total / 100);
  const centavos = total % 100;
  const parts: string[] = [];
  if (reais) {
    const words = integerInWords(reais);
    // "um milhão de reais", "dois milhões de reais" (sem milhar/centena depois)
    const needsDe = reais >= 1_000_000 && reais % 1_000_000 === 0;
    parts.push(`${words}${needsDe ? " de" : ""} ${reais === 1 ? "real" : "reais"}`);
  }
  if (centavos) parts.push(`${integerInWords(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  if (!parts.length) return "zero real";
  return parts.join(" e ");
}
