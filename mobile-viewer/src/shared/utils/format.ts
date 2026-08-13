export function onlyDigits(value: string | null): string | null {
  return value ? value.replace(/\D/g, "") : null;
}

export function isValidCnpj(value: string | null): boolean {
  const cnpj = onlyDigits(value);
  if (!cnpj || cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) {
    return false;
  }
  const calc = (base: string, weights: number[]): number => {
    const sum = weights.reduce((total, weight, index) => total + Number(base[index]) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const first = calc(cnpj, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calc(cnpj, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(cnpj[12]) && second === Number(cnpj[13]);
}

export function formatCnpj(cnpj: string | null): string {
  const digits = onlyDigits(cnpj);
  if (!digits || digits.length !== 14) {
    return "CNPJ pendente";
  }
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function formatCep(cep: string | null): string {
  const digits = onlyDigits(cep);
  if (!digits || digits.length !== 8) {
    return "";
  }
  return digits.replace(/^(\d{5})(\d{3})$/, "$1-$2");
}

export function formatDateOnlyBr(value: string | null | undefined): string {
  if (!value) return "-";
  const dateOnly = value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return value;
}

export function formatDateBr(value: string): string {
  if (!/[T ]\d{2}:\d{2}/.test(value)) return formatDateOnlyBr(value);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return formatDateOnlyBr(value);
  const date = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(parsed).replace(/\//g, "-");
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(parsed);
  return `${date} ${time}`;
}

export function formatCurrencyFromCents(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
}

export function parseCurrencyToCents(value: string): number {
  const normalized = value.trim().replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function formatCurrencyInput(value: string): string {
  const cents = parseCurrencyToCents(value);
  return value.trim() ? formatCurrencyFromCents(cents) : "";
}
