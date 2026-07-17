import { EmptyState, PageHeader } from "../../../design-system";

export function SpreadsheetImportHistoryPage(): JSX.Element {
  return <section className="content-section"><PageHeader title="Histórico de planilhas" /><EmptyState title="Histórico integrado" description="O histórico está disponível na página de Notas e operações durante esta migração." /></section>;
}
