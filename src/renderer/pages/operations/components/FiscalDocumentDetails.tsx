import type { FiscalDocumentDetail } from "../../../../shared/types/domain";

export function FiscalDocumentDetails({ detail }: { detail: FiscalDocumentDetail }): JSX.Element {
  return <div className="detail-panel"><h3>Nota {detail.document.documentNumber}</h3><p>{detail.items.length} item(ns), {detail.operations.length} operação(ões).</p></div>;
}
