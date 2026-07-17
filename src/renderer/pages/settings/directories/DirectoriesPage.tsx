import { Button, DataTable, PageHeader } from "../../../design-system";
import { useDiagnostics } from "../hooks/useAdminLists";

export function DirectoriesPage(): JSX.Element {
  const diagnostics = useDiagnostics();
  const rows = [
    { id: "database", label: "Banco", value: diagnostics?.databasePath ? "Gerenciado" : "Indisponivel" },
    { id: "documents", label: "Documentos", value: diagnostics?.documentsPath ? "Gerenciado" : "Indisponivel" },
    { id: "logs", label: "Logs", value: "Gerenciado pelo app" },
    { id: "settings", label: "Configuracoes", value: "Gerenciado pelo app" },
    { id: "backups", label: "Backups", value: "Reservado" }
  ];
  return <section className="content-section"><PageHeader eyebrow="Diretorios" title="Diretorios gerenciados" description="Exibe diretorios internos sem permitir caminho arbitrario nesta etapa." /><DataTable rows={rows} getRowKey={(row) => row.id} columns={[{ key: "label", header: "Diretorio", render: (row) => row.label }, { key: "value", header: "Status", render: (row) => row.value }, { key: "actions", header: "Acoes", render: () => <Button disabled>Verificacao local</Button> }]} /></section>;
}
