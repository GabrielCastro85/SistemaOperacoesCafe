const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  LOCKED: "Bloqueado",
  DRAFT: "Rascunho",
  PENDING: "Pendente",
  PENDING_REVIEW: "Em conferencia",
  CONFIRMED: "Confirmada",
  CANCELED: "Cancelada",
  CANCELLED: "Cancelada",
  ISSUED: "Emitida",
  SENT_FOR_SIGNATURE: "Enviada para assinatura",
  SIGNED: "Assinada",
  NOT_APPLICABLE: "Nao se aplica",
  NOT_SENT: "Nao enviada",
  WAITING_SIGNATURE: "Aguardando assinatura",
  PARTIALLY_SIGNED: "Parcialmente assinada",
  SIGNED_EXTERNALLY: "Assinada externamente",
  REJECTED: "Recusada",
  NOT_REQUIRED: "Nao obrigatoria",
  PAID: "Paga",
  PARTIALLY_PAID: "Parcialmente paga",
  OVERDUE: "Vencida",
  REPLACED: "Substituida",
  RESERVED: "Reservada",
  BILLED: "Cobrada",
  UNBILLED: "Nao cobrada",
  VALIDATED: "Validada",
  VALID: "Valido",
  INVALID: "Invalido",
  WARNING: "Com aviso",
  DUPLICATE: "Duplicada",
  ERROR: "Erro",
  IMPORTED: "Importada",
  SKIPPED: "Ignorada",
  REVERTED: "Revertida",
  INSPECTING: "Lendo arquivo",
  PROCESSING: "Processando",
  COMPLETED: "Concluida",
  COMPLETED_WITH_ERRORS: "Concluida com erros",
  FAILED: "Falhou",
  RUNNING: "Em execucao",
  OK: "Ok",
  SUCCESS: "Sucesso",
  DENIED: "Negado",
  OPEN: "Aberta",
  SCHEDULED: "Agendada",
  CONTESTED: "Contestada"
};

export function formatStatusLabel(status: string | null | undefined): string {
  if (!status) return "-";
  return STATUS_LABELS[status] ?? status;
}

export function formatCombinedStatusLabel(...statuses: Array<string | null | undefined>): string {
  return statuses.map(formatStatusLabel).join(" / ");
}
