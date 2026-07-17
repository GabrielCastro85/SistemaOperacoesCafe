import { EmptyState, PageHeader } from "../../design-system";

export function SystemSettingsPage(): JSX.Element {
  return <section className="content-section"><PageHeader eyebrow="Sistema" title="Sistema" description="Ajustes administrativos adicionais." /><EmptyState title="Sem ajustes adicionais" description="As configuracoes existentes foram separadas em rotas diretas." /></section>;
}
