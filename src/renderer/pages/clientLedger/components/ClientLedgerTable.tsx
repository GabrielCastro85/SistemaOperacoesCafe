import type { ClientLedgerEntry } from "../../../../shared/types/domain";
import { DataTable, StatusBadge } from "../../../design-system";
import { formatCurrencyFromCents } from "../../../../shared/utils/format";

export function ClientLedgerTable({ entries }: { entries: ClientLedgerEntry[] }): JSX.Element {
  return (
    <DataTable
      rows={entries}
      getRowKey={(row) => row.id}
      columns={[
        { key: "date", header: "Data", render: (row) => row.entryDate },
        { key: "description", header: "Descricao", render: (row) => row.description },
        { key: "amount", header: "Valor", align: "right", render: (row) => formatCurrencyFromCents(row.amountCents) },
        { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} label={row.status} /> }
      ]}
    />
  );
}
