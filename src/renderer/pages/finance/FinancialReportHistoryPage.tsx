import { PageHeader } from "../../design-system";
import { FinancialReportPreview } from "./components/FinancialReportPreview";
import { useFinanceData } from "./hooks/useFinanceData";
import type { FinancePageProps } from "./types";

export function FinancialReportHistoryPage({ data, id }: FinancePageProps & { id?: string | null }): JSX.Element {
  const { finance } = useFinanceData(data);
  const reports = id ? finance.reports.filter((item) => item.id === id) : finance.reports;
  return <section className="content-section"><PageHeader eyebrow="Historico" title="Historico de relatorios" description="Arquivos gerados localmente com hash persistido." /><FinancialReportPreview preview={null} reports={reports} onOpen={(reportId) => void window.operationsCafe.openFinancialReport(reportId)} /></section>;
}
