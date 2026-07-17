import { Alert, DataTable, PageHeader } from "../../../design-system";
import type { SettingsPageProps } from "../types";

export function DocumentSequencesPage({ data }: SettingsPageProps): JSX.Element {
  const rows = data.legalEntities.map((entity) => ({ id: entity.id, entity: entity.tradeName, type: "Cobranca / Confirmacao", prefix: entity.documentPrefix ?? "-", year: new Date().getFullYear(), number: "Gerenciado pelo backend", active: entity.isActive ? "Ativa" : "Inativa" }));
  return <section className="content-section"><PageHeader eyebrow="Numeracoes" title="Numeracoes de documentos" description="Configuracoes de sequencia sao sensiveis e nao devem reduzir numeros ja emitidos." /><Alert variant="warning" title="Edicao protegida">Alteracoes futuras exigem confirmacao e validacao no backend.</Alert><DataTable rows={rows} getRowKey={(row) => row.id} columns={[{ key: "entity", header: "CNPJ proprio", render: (row) => row.entity }, { key: "type", header: "Tipo", render: (row) => row.type }, { key: "prefix", header: "Prefixo", render: (row) => row.prefix }, { key: "year", header: "Ano", render: (row) => row.year }, { key: "number", header: "Numero atual", render: (row) => row.number }, { key: "status", header: "Status", render: (row) => row.active }]} /></section>;
}
