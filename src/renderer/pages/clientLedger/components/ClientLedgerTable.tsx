import type { ClientLedgerEntry, LedgerEntryType } from "../../../../shared/types/domain";
import { DataTable, StatusBadge } from "../../../design-system";
import { formatCurrencyFromCents, formatDateBr } from "../../../../shared/utils/format";

const ENTRY_TYPE_LABELS: Record<LedgerEntryType, string> = {
  SERVICE_CHARGE: "Cobranca de servico",
  ADVANCE_RECEIVED: "Adiantamento",
  PAYMENT_RECEIVED: "Pagamento",
  DISCOUNT: "Desconto",
  CREDIT: "Credito",
  SURCHARGE: "Acrescimo",
  REIMBURSEMENT: "Reembolso",
  PREVIOUS_BALANCE: "Saldo anterior",
  MANUAL_ADJUSTMENT: "Ajuste manual",
  REVERSAL: "Estorno",
  LOAN: "Emprestimo",
  OTHER: "Outro"
};

export function ClientLedgerTable({ entries, onMarkLoanCollected }: { entries: ClientLedgerEntry[]; onMarkLoanCollected?: (id: string) => void | Promise<void> }): JSX.Element {
  return (
    <DataTable
      rows={entries}
      getRowKey={(row) => row.id}
      emptyLabel="Nenhum lancamento no periodo."
      columns={[
        { key: "date", header: "Data", render: (row) => formatDateBr(row.entryDate) },
        { key: "type", header: "Tipo", render: (row) => ENTRY_TYPE_LABELS[row.entryType] ?? row.entryType },
        { key: "description", header: "Descricao", render: (row) => row.description },
        {
          key: "amount",
          header: "Valor",
          align: "right",
          render: (row) => (
            <span className={row.effect === "INCREASE_RECEIVABLE" ? "ledger-amount-positive" : "ledger-amount-negative"}>
              {row.effect === "INCREASE_RECEIVABLE" ? "+" : "-"} {formatCurrencyFromCents(row.amountCents)}
            </span>
          )
        },
        { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} label={row.status === "CONFIRMED" ? "Confirmado" : row.status === "CANCELLED" ? "Cancelado" : "Rascunho"} /> },
        {
          key: "loan",
          header: "Cobranca do emprestimo",
          render: (row) => {
            if (row.entryType !== "LOAN" || !row.collectionDueDate) return row.entryType === "LOAN" ? "Sem data prevista" : "-";
            if (row.collectedAt) return `Cobrado em ${formatDateBr(row.collectedAt)}`;
            return (
              <span className="row-actions">
                <span>Previsto para {formatDateBr(row.collectionDueDate)}</span>
                {onMarkLoanCollected ? <button onClick={() => void onMarkLoanCollected(row.id)}>Marcar como cobrado</button> : null}
              </span>
            );
          }
        }
      ]}
    />
  );
}
