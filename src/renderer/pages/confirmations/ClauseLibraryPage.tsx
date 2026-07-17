import type { DealClauseTemplate } from "../../../shared/types/domain";
import { DataTable, PageHeader } from "../../design-system";

export function ClauseLibraryPage({ clauses }: { clauses: DealClauseTemplate[] }): JSX.Element {
  return <section className="content-section"><PageHeader title="Biblioteca de cláusulas" /><DataTable rows={clauses} getRowKey={(row) => row.id} columns={[{ key: "name", header: "Nome", render: (row) => row.name }, { key: "category", header: "Categoria", render: (row) => row.category }, { key: "title", header: "Título", render: (row) => row.title ?? "-" }]} /></section>;
}
