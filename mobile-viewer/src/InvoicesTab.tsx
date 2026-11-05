import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson, queryString } from "./api";
import { companyColorClass } from "./companyColor";
import { formatCurrencyBr, formatDateBr } from "./viewerFormat";
import { Alert } from "./renderer/design-system/components/Alert";
import { Badge, StatusBadge } from "./renderer/design-system/components/Badge";
import { Button } from "./renderer/design-system/components/Button";
import { Card } from "./renderer/design-system/components/Card";
import { EmptyState } from "./renderer/design-system/components/EmptyState";
import { FilterBar } from "./renderer/design-system/components/FilterBar";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { PageHeader } from "./renderer/design-system/components/PageHeader";

type DirectionFilter = "ALL" | "INBOUND" | "OUTBOUND";
type StatusFilter = "ACTIVE" | "PENDING" | "CANCELED" | "ALL";

interface InvoiceRow {
  id: string;
  documentNumber: string;
  series: string | null;
  issueDate: string;
  status: string;
  direction: string;
  source: string;
  ownLegalEntityName: string;
  responsiblePartnerName: string | null;
  counterpartyName: string;
  issuerName: string | null;
  recipientName: string | null;
  totalAmountCents: number;
  sacks: number;
  productNames: string[];
  operationTypes: string[];
  hasPendingIssues: boolean;
  pendingNotes: string | null;
}

const DIRECTION_LABELS: Record<DirectionFilter, string> = { ALL: "Entradas e saídas", INBOUND: "Entradas", OUTBOUND: "Saídas" };
const STATUS_LABELS: Record<StatusFilter, string> = { ACTIVE: "Ativas", PENDING: "Com pendência", CANCELED: "Canceladas", ALL: "Todas" };
const SOURCE_LABELS: Record<string, string> = { XML: "XML", MANUAL: "Manual", SPREADSHEET: "Planilha", SEFAZ: "SEFAZ" };

function currentMonth(): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const end = new Date(year, now.getMonth() + 1, 0).getDate();
  return { start: `${year}-${month}-01`, end: `${year}-${month}-${String(end).padStart(2, "0")}` };
}

function formatSacks(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export function InvoicesTab({ organizationId, legalEntityId }: { organizationId: string; legalEntityId?: string }): JSX.Element {
  const initial = currentMonth();
  const [periodStart, setPeriodStart] = useState(initial.start);
  const [periodEnd, setPeriodEnd] = useState(initial.end);
  const [direction, setDirection] = useState<DirectionFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ACTIVE");
  const [search, setSearch] = useState("");
  const [documents, setDocuments] = useState<InvoiceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!organizationId) return;
    setError(null);
    setDocuments(null);
    try {
      setDocuments(await apiJson(`/v1/viewer/invoices?${queryString({
        organizationId, legalEntityId, periodStart, periodEnd, direction, status
      })}`));
    } catch (value) {
      setError(value instanceof Error ? value.message : "Falha ao carregar as notas fiscais.");
    }
  }, [organizationId, legalEntityId, periodStart, periodEnd, direction, status]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return documents ?? [];
    return (documents ?? []).filter((document) => [
      document.documentNumber, document.series, document.counterpartyName, document.responsiblePartnerName,
      document.ownLegalEntityName, document.issuerName, document.recipientName, ...document.productNames
    ].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(term));
  }, [documents, search]);

  const totals = useMemo(() => ({
    count: filtered.length,
    sacks: filtered.reduce((sum, document) => sum + document.sacks, 0),
    amountCents: filtered.reduce((sum, document) => sum + document.totalAmountCents, 0),
    pending: filtered.filter((document) => document.hasPendingIssues || document.status === "PENDING").length
  }), [filtered]);

  return (
    <>
      <PageHeader eyebrow="Operações" title="Notas e operações" description="Consulte entradas e saídas que já chegaram ao servidor central, sem alterar os lançamentos do aplicativo." />
      <FilterBar
        activeCount={(direction !== "ALL" ? 1 : 0) + (status !== "ALL" ? 1 : 0) + (search.trim() ? 1 : 0)}
        onClear={() => { setDirection("ALL"); setStatus("ALL"); setSearch(""); }}
      >
        <div className="viewer-period-filter viewer-period-filter--inline">
          <label>Início<input className="ui-input" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
          <label>Fim<input className="ui-input" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
        </div>
        <input className="ui-input" type="search" placeholder="Buscar nota, empresa, fornecedor, cliente ou produto..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <div className="viewer-filter-groups">
          <div className="viewer-chip-row">
            {(Object.keys(DIRECTION_LABELS) as DirectionFilter[]).map((mode) => (
              <Button key={mode} variant={direction === mode ? "primary" : "secondary"} onClick={() => setDirection(mode)}>{DIRECTION_LABELS[mode]}</Button>
            ))}
          </div>
          <div className="viewer-chip-row">
            {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((mode) => (
              <Button key={mode} variant={status === mode ? "primary" : "secondary"} onClick={() => setStatus(mode)}>{STATUS_LABELS[mode]}</Button>
            ))}
          </div>
        </div>
      </FilterBar>
      {error ? <Alert tone="danger" title="Falha ao carregar notas">{error}</Alert> : null}
      {!error && !documents ? <LoadingState label="Carregando notas e operações..." /> : null}
      {documents ? (
        <Card className="viewer-open-notes-summary">
          <div className="viewer-open-notes-summary__metrics viewer-invoice-summary__metrics">
            <span><small>Notas no filtro</small><strong>{totals.count.toLocaleString("pt-BR")}</strong></span>
            <span><small>Sacas</small><strong>{formatSacks(totals.sacks)}</strong></span>
            <span><small>Valor fiscal</small><strong>{formatCurrencyBr(totals.amountCents)}</strong></span>
            <span><small>Com pendência</small><strong>{totals.pending.toLocaleString("pt-BR")}</strong></span>
          </div>
        </Card>
      ) : null}
      {documents && filtered.length === 0 ? <EmptyState title="Nenhuma nota encontrada" description="Ajuste o período, o sentido, a situação ou a busca." /> : null}
      {documents && filtered.length > 0 ? (
        <div className="viewer-invoice-list">
          <div className="viewer-invoice-list__head" aria-hidden="true">
            <span>Nota / emissão</span><span>Sentido / empresa</span><span>Contraparte / responsável</span><span>Produto / sacas</span><span>Valor fiscal</span><span>Situação</span>
          </div>
          {filtered.map((document) => (
            <article key={document.id} className={`viewer-invoice-row ${companyColorClass(document.ownLegalEntityName)}`}>
              <span className="viewer-invoice-row__note"><strong>NF {document.documentNumber}{document.series ? `/${document.series}` : ""}</strong><small>{formatDateBr(document.issueDate)}</small></span>
              <span><Badge tone={document.direction === "INBOUND" ? "info" : document.direction === "OUTBOUND" ? "success" : "neutral"}>{document.direction === "INBOUND" ? "Entrada" : document.direction === "OUTBOUND" ? "Saída" : "Não identificada"}</Badge><small>{document.ownLegalEntityName}</small></span>
              <span><strong>{document.counterpartyName}</strong><small>{document.responsiblePartnerName ? `Responsável: ${document.responsiblePartnerName}` : "Sem responsável comercial"}</small></span>
              <span><strong>{document.productNames.slice(0, 2).join(" · ") || "Produto não informado"}</strong><small>{formatSacks(document.sacks)} sacas</small></span>
              <span className="viewer-invoice-row__amount"><strong>{formatCurrencyBr(document.totalAmountCents)}</strong><small>{SOURCE_LABELS[document.source] ?? document.source}</small></span>
              <span><StatusBadge status={document.status} />{document.hasPendingIssues ? <Badge tone="warning">Revisar</Badge> : null}</span>
            </article>
          ))}
        </div>
      ) : null}
    </>
  );
}
