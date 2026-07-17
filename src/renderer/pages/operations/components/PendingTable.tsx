import { DataTable } from "../../../design-system";

export function PendingTable({ pending }: { pending: string[] }): JSX.Element {
  return <DataTable rows={pending.map((item, index) => ({ id: String(index), description: item }))} getRowKey={(row) => row.id} columns={[{ key: "severity", header: "Gravidade", render: () => "Aviso" }, { key: "description", header: "Descrição", render: (row) => row.description }]} />;
}
