import type { ServiceRateRule } from "../../../../shared/types/domain";
import { DataTable } from "../../../design-system";
import { formatCurrencyFromCents } from "../../../../shared/utils/format";
import { formatOperationScope } from "../../../../shared/utils/operationLabels";

export function ServiceRateTable({ rules }: { rules: ServiceRateRule[] }): JSX.Element {
  return (
    <DataTable
      rows={rules}
      getRowKey={(row) => row.id}
      columns={[
        { key: "scope", header: "UF da venda", render: (row) => formatOperationScope(row.operationScope) },
        { key: "value", header: "Valor", align: "right", render: (row) => formatCurrencyFromCents(row.rateValueCents) },
        { key: "status", header: "Status", render: (row) => (row.isActive ? "Vigente" : "Inativa") }
      ]}
    />
  );
}
