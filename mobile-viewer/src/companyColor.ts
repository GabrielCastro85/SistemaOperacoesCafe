export type CompanyColorTone = "grao" | "villa" | "other";

export function companyColorTone(name: string | null | undefined): CompanyColorTone {
  const normalized = (name ?? "").toLowerCase();
  if (normalized.includes("villa")) return "villa";
  if (normalized.includes("grao") || normalized.includes("grão")) return "grao";
  return "other";
}

export function companyColorClass(name: string | null | undefined): string {
  return `viewer-company-accent--${companyColorTone(name)}`;
}
