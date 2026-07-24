import type { Operation } from "../../../../shared/types/domain";
import { formatCurrencyFromCents, formatDateOnlyBr } from "../../../../shared/utils/format";
import { formatOperationScope } from "../../../../shared/utils/operationLabels";
import { DataTable } from "../../../design-system";
import { OperationStatusBadge } from "./OperationStatusBadge";

export function OperationTable({ operations }: { operations: Operation[] }): JSX.Element {
  return (
    <DataTable
      rows={operations}
      getRowKey={(row) => row.id}
      columns={[
        { key: "date", header: "Data", render: (row) => formatDateOnlyBr(row.operationDate) },
        { key: "type", header: "Compra/Venda", render: (row) => row.operationType },
        { key: "scope", header: "UF da venda", render: (row) => formatOperationScope(row.operationScope) },
        { key: "sacks", header: "Sacas", align: "right", render: (row) => row.quantitySacks },
        { key: "service", header: "Valor do serviço", align: "right", render: (row) => formatCurrencyFromCents(row.serviceAmountCents) },
        { key: "status", header: "Status", render: (row) => <OperationStatusBadge status={row.status} /> }
      ]}
    />
  );
}
