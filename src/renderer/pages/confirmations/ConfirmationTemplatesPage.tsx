import type { DealConfirmationTemplate } from "../../../shared/types/domain";
import { DataTable, PageHeader, StatusBadge } from "../../design-system";

export function ConfirmationTemplatesPage({ templates }: { templates: DealConfirmationTemplate[] }): JSX.Element {
  return <section className="content-section"><PageHeader title="Templates de confirmação" /><DataTable rows={templates} getRowKey={(row) => row.id} columns={[{ key: "name", header: "Nome", render: (row) => row.name }, { key: "layout", header: "Layout", render: (row) => row.layoutMode }, { key: "status", header: "Status", render: (row) => <StatusBadge status={row.isActive ? "ACTIVE" : "INACTIVE"} label={row.isActive ? "Ativo" : "Inativo"} /> }]} /></section>;
}
