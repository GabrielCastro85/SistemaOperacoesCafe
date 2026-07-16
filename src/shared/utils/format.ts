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

export function formatDateBr(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function formatCurrencyFromCents(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
}
