import type { ServiceRateRule } from "../../../../shared/types/domain";
import { DataTable } from "../../../design-system";
import { formatCurrencyFromCents } from "../../../../shared/utils/format";

export function ServiceRateTable({ rules }: { rules: ServiceRateRule[] }): JSX.Element {
  return (
    <DataTable
      rows={rules}
      getRowKey={(row) => row.id}
      columns={[
        { key: "scope", header: "Escopo", render: (row) => row.operationScope },
        { key: "value", header: "Valor", align: "right", render: (row) => formatCurrencyFromCents(row.rateValueCents) },
        { key: "status", header: "Status", render: (row) => (row.isActive ? "Vigente" : "Inativa") }
      ]}
    />
  );
}
