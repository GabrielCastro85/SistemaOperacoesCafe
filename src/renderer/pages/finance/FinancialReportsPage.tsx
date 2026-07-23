import { useState } from "react";
import type { FinancialReportType } from "../../../shared/types/domain";
import { Button, DateInput, FilterBar, PageHeader, Select } from "../../design-system";
import { FinancialReportPreview } from "./components/FinancialReportPreview";
import { useFinanceData } from "./hooks/useFinanceData";
import { financialReportOptions, type FinancePageProps } from "./types";

export function FinancialReportsPage({ data }: FinancePageProps): JSX.Element {
  const { finance, organizationId, ownLegalEntityId, reload } = useFinanceData(data);
  const [reportType, setReportType] = useState<FinancialReportType>("ACCOUNTS_PAYABLE");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof window.operationsCafe.previewFinancialReport>> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const filters = { organizationId, ownLegalEntityId, dateStart: dateStart || null, dateEnd: dateEnd || null, categoryId: null, locationId: null, costCenterId: null, supplierPartnerId: null, status: null };
  async function refreshPreview(): Promise<void> {
    setPreview(await window.operationsCafe.previewFinancialReport({ ...filters, reportType }));
  }
  async function generate(format: "PDF" | "EXCEL"): Promise<void> {
    const report = await window.operationsCafe.generateFinancialReport({ reportType, format, filters });
    if (!report) {
      setMessage("Geracao cancelada. Nenhuma pasta foi escolhida.");
      return;
    }
    await reload();
    setMessage(`Relatorio ${format} salvo: ${report.fileName}`);
  }
  return <section className="content-section"><PageHeader eyebrow="Relatorios" title="Relatorios financeiros" description="Selecione filtros, visualize previa e gere PDF ou Excel local." actions={<><Button onClick={() => void generate("PDF")}>Gerar PDF</Button><Button onClick={() => void generate("EXCEL")}>Gerar Excel</Button></>} /><FilterBar activeCount={[dateStart, dateEnd].filter(Boolean).length}><Select label="Tipo" value={reportType} onChange={(event) => setReportType(event.target.value as FinancialReportType)}>{financialReportOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select><DateInput label="Inicio" value={dateStart} onChange={(event) => setDateStart(event.target.value)} /><DateInput label="Fim" value={dateEnd} onChange={(event) => setDateEnd(event.target.value)} /><Button onClick={() => void refreshPreview()}>Visualizar previa</Button></FilterBar>{message ? <p className="form-feedback">{message}</p> : null}<FinancialReportPreview preview={preview} reports={finance.reports} onOpen={(id) => void window.operationsCafe.openFinancialReport(id)} /></section>;
}
