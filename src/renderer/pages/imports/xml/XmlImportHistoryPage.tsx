import { EmptyState, PageHeader } from "../../../design-system";

export function XmlImportHistoryPage(): JSX.Element {
  return <section className="content-section"><PageHeader title="Histórico de XML" /><EmptyState title="Histórico integrado" description="O histórico de XML está disponível na página de Notas e operações durante esta migração." /></section>;
}
