import { Alert, Badge, Button, Card, DataTable, EmptyState, Input, LoadingState, Select, StatusBadge, Tabs } from "../../design-system";

export function UiKitPage(): JSX.Element {
  return (
    <section className="content-section">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">Desenvolvimento</span>
          <h2>UI Kit</h2>
          <p>Catálogo interno de componentes visuais, tokens, estados e temas.</p>
        </div>
      </div>
      <div className="dashboard-grid">
        <Card title="Ações" eyebrow="Botões">
          <div className="inline-actions">
            <Button variant="primary">Salvar</Button>
            <Button>Cancelar</Button>
            <Button variant="danger">Excluir</Button>
          </div>
        </Card>
        <Card title="Formulários" eyebrow="Campos">
          <Input label="Cliente responsável" placeholder="Nome do cliente" />
          <Select label="Status" options={[{ value: "DRAFT", label: "Rascunho" }, { value: "ISSUED", label: "Emitida" }]} />
        </Card>
        <Card title="Status" eyebrow="Badges">
          <div className="inline-actions">
            <StatusBadge status="DRAFT" label="Rascunho" />
            <StatusBadge status="ISSUED" label="Emitida" />
            <StatusBadge status="SIGNED" label="Assinada" />
            <Badge tone="warning">Aguardando conferência</Badge>
          </div>
        </Card>
        <Card title="Feedback" eyebrow="Estados">
          <Alert tone="info" title="Informação">Mensagem persistente para orientar o operador.</Alert>
          <LoadingState label="Carregando prévia..." />
          <EmptyState title="Nenhum registro" description="Os dados aparecerão aqui após o primeiro cadastro." />
        </Card>
        <Card title="Tabela" eyebrow="DataTable">
          <DataTable
            columns={[
              { key: "name", header: "Nome", render: (row: { name: string; status: string }) => row.name },
              { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} label={row.status} /> }
            ]}
            rows={[{ name: "Villa Coffee", status: "ISSUED" }]}
            getRowKey={(row) => row.name}
          />
        </Card>
        <Card title="Abas" eyebrow="Navegação interna">
          <Tabs items={[{ id: "overview", label: "Visão geral" }, { id: "details", label: "Detalhes" }]} active="overview" onChange={() => undefined} />
        </Card>
      </div>
    </section>
  );
}
