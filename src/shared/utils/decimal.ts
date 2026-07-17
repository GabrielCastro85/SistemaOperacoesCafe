const scale = 1_000_000n;

export function normalizeDecimalText(value: string): string {
  const trimmed = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error("Decimal invalido.");
  }
  const [whole, fraction = ""] = trimmed.split(".");
  const cleanWhole = String(BigInt(whole));
  const cleanFraction = fraction.padEnd(6, "0").slice(0, 6);
  return cleanFraction === "000000" ? cleanWhole : `${cleanWhole}.${cleanFraction.replace(/0+$/, "")}`;
}

export function decimalTextToScaled(value: string): bigint {
  const normalized = normalizeDecimalText(value);
  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole) * scale + BigInt(fraction.padEnd(6, "0").slice(0, 6));
}

export function multiplyDecimalByCents(decimalValue: string, cents: number): number {
  const scaled = decimalTextToScaled(decimalValue);
  const result = (scaled * BigInt(cents) + scale / 2n) / scale;
  return Number(result);
}

export function divideDecimalText(decimalValue: string, divisorValue: string): string {
  const dividend = decimalTextToScaled(decimalValue);
  const divisor = decimalTextToScaled(divisorValue);
  if (divisor === 0n) throw new Error("Divisor decimal invalido.");
  const result = (dividend * scale + divisor / 2n) / divisor;
  const whole = result / scale;
  const fraction = (result % scale).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
