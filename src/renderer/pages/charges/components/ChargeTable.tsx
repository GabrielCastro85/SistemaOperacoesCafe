import type { ClientCharge } from "../../../../shared/types/domain";
import { DataTable, StatusBadge } from "../../../design-system";
import { formatCurrencyFromCents } from "../../../../shared/utils/format";

export function ChargeTable({ charges }: { charges: ClientCharge[] }): JSX.Element {
  return (
    <DataTable
      rows={charges}
      getRowKey={(row) => row.id}
      columns={[
        { key: "number", header: "Cobranca", render: (row) => row.chargeNumber ?? "Rascunho" },
        { key: "period", header: "Periodo", render: (row) => `${row.periodStart} a ${row.periodEnd}` },
        { key: "open", header: "Em aberto", align: "right", render: (row) => formatCurrencyFromCents(row.openAmountCents) },
        { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} label={row.status} /> }
      ]}
    />
  );
}
