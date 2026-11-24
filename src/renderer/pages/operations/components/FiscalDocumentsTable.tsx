import type { FiscalDocument } from "../../../../shared/types/domain";
import { formatCurrencyFromCents, formatDateOnlyBr } from "../../../../shared/utils/format";
import { StatusBadge } from "../../../design-system";
import type { DocumentSortKey, SortDirection } from "../operationsFormatters";

// Dados de exibicao de cada linha, calculados pela pagina (mesma regra de antes).
export interface FiscalDocumentRowView {
  ownEntityName: string | null;
  partyKind: { label: string; tone: "client" | "supplier" | "both" } | null;
  clientName: string;
  serviceLabel: string;
  alertLabel: string;
  rowState: string | null;
}

// Tabela de notas lancadas: cabecalho ordenavel e linhas com as acoes Abrir e Excluir.
// O estado vazio entra como filho, no mesmo lugar de antes.
export function FiscalDocumentsTable({ rows, sort, onSort, sortIndicator, onOpen, onDelete, children }: {
  rows: Array<{ doc: FiscalDocument; view: FiscalDocumentRowView }>;
  sort: { key: DocumentSortKey | null; direction: SortDirection };
  onSort: (key: DocumentSortKey) => void;
  sortIndicator: (key: DocumentSortKey) => string;
  onOpen: (documentId: string) => void;
  onDelete: (document: FiscalDocument) => void;
  children?: React.ReactNode;
}): JSX.Element {
  return (
    <div className="table"><div className="table-head invoice-grid"><button type="button" className={`table-sort-button${sort.key === "number" ? " active" : ""}`} onClick={() => onSort("number")} aria-label={`Ordenar notas por numero ${sort.key === "number" && sort.direction === "asc" ? "do maior para o menor" : "do menor para o maior"}`}><span>Numero</span><span className="table-sort-indicator" aria-hidden="true">{sortIndicator("number")}</span></button><button type="button" className={`table-sort-button${sort.key === "client" ? " active" : ""}`} onClick={() => onSort("client")} aria-label={`Ordenar notas por cliente ${sort.key === "client" && sort.direction === "asc" ? "de Z a A" : "de A a Z"}`}><span>Cliente/corretor</span><span className="table-sort-indicator" aria-hidden="true">{sortIndicator("client")}</span></button><span>Emissao</span><span>Status</span><span>Valor NF</span><span>Servico</span><span>Alerta</span><span>Acoes</span></div>{rows.map(({ doc, view }) => (
      <div key={doc.id} className={`table-row invoice-grid${view.partyKind ? ` invoice-row--${view.partyKind.tone}` : ""}${view.rowState ? ` invoice-row--state-${view.rowState}` : ""}`}><span>{doc.documentNumber}{view.ownEntityName ? <small>Emitida por {view.ownEntityName}</small> : null}</span><span className="invoice-party">{view.partyKind ? <em className={`party-kind party-kind--${view.partyKind.tone}`}>{view.partyKind.label}</em> : null}<span>{view.clientName}</span></span><span>{formatDateOnlyBr(doc.issueDate)}</span><span><StatusBadge status={doc.status} /></span><span>{formatCurrencyFromCents(doc.totalAmountCents)}</span><span>{view.serviceLabel}</span><span title={view.alertLabel !== "-" ? view.alertLabel : undefined}>{view.alertLabel}</span><span className="row-actions"><button onClick={() => onOpen(doc.id)}>Abrir</button><button className="danger" onClick={() => void onDelete(doc)}>Excluir</button></span></div>
    ))}
    {children}
    </div>
  );
}
