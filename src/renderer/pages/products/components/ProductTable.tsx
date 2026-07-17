import type { Product } from "../../../../shared/types/domain";
import { DataTable, StatusBadge } from "../../../design-system";

export function ProductTable({ products }: { products: Product[] }): JSX.Element {
  return (
    <DataTable
      rows={products}
      getRowKey={(row) => row.id}
      columns={[
        { key: "name", header: "Nome", render: (row) => row.name },
        { key: "code", header: "Codigo", render: (row) => row.code ?? "-" },
        { key: "status", header: "Status", render: (row) => <StatusBadge status={row.isActive ? "ACTIVE" : "INACTIVE"} label={row.isActive ? "Ativo" : "Inativo"} /> }
      ]}
    />
  );
}
