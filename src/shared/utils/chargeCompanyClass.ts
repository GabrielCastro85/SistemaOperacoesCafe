/** Visual identity only; this must not determine invoice ownership or billing. */
export function chargeCompanyClass(value: string | null | undefined, isThirdParty = false): string {
  if (isThirdParty) return "charge-row--third-party";
  const normalized = (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (/^grao\s*(?:&|e)\s*grao\b/.test(normalized)) return "charge-row--grao";
  if (/^villa\s+coffee\b/.test(normalized)) return "charge-row--villa";
  return "charge-row--third-party";
}
