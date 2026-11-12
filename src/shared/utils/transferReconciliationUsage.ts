import type { TransferReconciliationInvoiceUsage } from "../types/domain.js";

// Textos do aviso "nota ja esta em outro repasse", usados na tela e na
// mensagem de erro ao salvar.

const money = (cents: number) => `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function brDate(value: string | null | undefined): string {
  if (!value) return "";
  const iso = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";
}

// Dia do repasse: o dia em que foi criado (e o que a lista de repasses mostra);
// sem ele, a data de referencia.
export function transferUsageDate(usage: TransferReconciliationInvoiceUsage): string {
  return brDate(usage.createdAt) || brDate(usage.referenceDate);
}

export function transferUsageName(usage: TransferReconciliationInvoiceUsage): string {
  return usage.title?.trim() || usage.clientName?.trim() || "sem título";
}

const STATUS_LABEL: Record<TransferReconciliationInvoiceUsage["status"], string> = { DRAFT: "rascunho", COMPLETED: "concluído", CANCELLED: "cancelado" };

// "Nota já está no repasse LUCAS do dia 12/11/2026 (concluído)."
export function transferUsageLabel(usage: TransferReconciliationInvoiceUsage): string {
  const date = transferUsageDate(usage);
  return `repasse ${transferUsageName(usage)}${date ? ` do dia ${date}` : ""} (${STATUS_LABEL[usage.status] ?? usage.status.toLowerCase()})`;
}

export function transferUsageSummary(usedIn: TransferReconciliationInvoiceUsage[]): string {
  if (!usedIn.length) return "";
  if (usedIn.length === 1) return `Nota já está no ${transferUsageLabel(usedIn[0])}.`;
  return `Nota já está em ${usedIn.length} repasses: ${usedIn.map(transferUsageLabel).join("; ")}.`;
}

export function transferOverLimitMessage(items: Array<{ documentNumber: string; sourceAmountCents: number; availableCents: number; usedIn: TransferReconciliationInvoiceUsage[] }>): string {
  const shown = items.slice(0, 5).map((item) => {
    const where = item.usedIn.length ? ` — também está no ${item.usedIn.map(transferUsageLabel).join(" e no ")}` : "";
    return `NF ${item.documentNumber}: informado ${money(item.sourceAmountCents)}, saldo ${money(Math.max(0, item.availableCents))}${where}`;
  });
  const rest = items.length > 5 ? ` E mais ${items.length - 5} nota(s).` : "";
  const subject = items.length === 1 ? "da nota" : `de ${items.length} notas`;
  return `O valor informado supera o saldo disponível ${subject}. ${shown.join(". ")}.${rest} Diminua o valor dessas notas aqui ou tire-as do outro repasse.`;
}
