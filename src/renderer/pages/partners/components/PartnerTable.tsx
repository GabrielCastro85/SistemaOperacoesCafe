import type { BusinessPartner } from "../../../../shared/types/domain";
import { DataTable, StatusBadge } from "../../../design-system";

export function PartnerTable({ partners }: { partners: BusinessPartner[] }): JSX.Element {
  return (
    <DataTable
      rows={partners}
      getRowKey={(row) => row.id}
      columns={[
        { key: "name", header: "Nome", render: (row) => row.displayName },
        { key: "notes", header: "Observacoes", render: (row) => row.notes ?? "-" },
        { key: "roles", header: "Perfis", render: (row) => row.roles.join(", ") },
        { key: "status", header: "Status", render: (row) => <StatusBadge status={row.isActive ? "ACTIVE" : "INACTIVE"} label={row.isActive ? "Ativo" : "Inativo"} /> }
      ]}
    />
  );
}
