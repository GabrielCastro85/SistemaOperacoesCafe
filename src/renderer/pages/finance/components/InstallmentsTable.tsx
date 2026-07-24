import type { AccountPayable } from "../../../../shared/types/domain";
import { DataTable, StatusBadge } from "../../../design-system";
import { formatCurrencyFromCents, formatDateOnlyBr } from "../../../../shared/utils/format";

export function InstallmentsTable({ payables }: { payables: AccountPayable[] }): JSX.Element {
  const installments = payables.filter((item) => item.source === "INSTALLMENT" || item.installmentGroupId);
  return <DataTable rows={installments} getRowKey={(row) => row.id} columns={[
    { key: "description", header: "Descricao", render: (row) => row.description },
    { key: "supplier", header: "Fornecedor", render: (row) => row.payeeNameSnapshot },
    { key: "parcel", header: "Parcela", render: (row) => `${row.installmentNumber ?? "-"} / ${row.installmentCount ?? "-"}` },
    { key: "due", header: "Vencimento", render: (row) => formatDateOnlyBr(row.dueDate) },
    { key: "amount", header: "Valor", align: "right", render: (row) => formatCurrencyFromCents(row.finalAmountCents ?? 0) },
    { key: "paid", header: "Pago", align: "right", render: (row) => formatCurrencyFromCents(row.paidAmountCents) },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} label={row.status} /> }
  ]} />;
}
