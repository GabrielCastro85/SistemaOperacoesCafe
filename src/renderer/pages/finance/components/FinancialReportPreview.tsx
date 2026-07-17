import type { FinancialReportGeneration, FinancialReportPreview as Preview } from "../../../../shared/types/domain";
import { DataTable, DocumentPreviewCard } from "../../../design-system";
import { formatCurrencyFromCents } from "../../../../shared/utils/format";

export function FinancialReportPreview({ preview, reports, onOpen }: { preview: Preview | null; reports: FinancialReportGeneration[]; onOpen: (id: string) => void }): JSX.Element {
  return (
    <>
      <div className="cards">
        <article><span>Registros</span><strong>{preview?.recordCount ?? 0}</strong></article>
        <article><span>Total</span><strong>{formatCurrencyFromCents(preview?.totalFinalCents ?? 0)}</strong></article>
        <article><span>Pago</span><strong>{formatCurrencyFromCents(preview?.totalPaidCents ?? 0)}</strong></article>
        <article><span>Aberto</span><strong>{formatCurrencyFromCents(preview?.totalOpenCents ?? 0)}</strong></article>
      </div>
      <DataTable rows={reports} getRowKey={(row) => row.id} columns={[
        { key: "date", header: "Data", render: (row) => row.createdAt.slice(0, 10) },
        { key: "type", header: "Tipo", render: (row) => row.reportType },
        { key: "format", header: "Formato", render: (row) => row.format },
        { key: "file", header: "Arquivo", render: (row) => <DocumentPreviewCard title={row.fileName} type={row.format} hash={row.fileHash.slice(0, 12)} /> },
        { key: "actions", header: "Acoes", render: (row) => <button onClick={() => onOpen(row.id)}>Abrir</button> }
      ]} />
    </>
  );
}
