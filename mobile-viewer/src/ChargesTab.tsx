import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson, queryString } from "./api";
import { formatCurrencyBr, formatDateBr } from "./viewerFormat";
import { PageHeader } from "./renderer/design-system/components/PageHeader";
import { FilterBar } from "./renderer/design-system/components/FilterBar";
import { Card } from "./renderer/design-system/components/Card";
import { EmptyState } from "./renderer/design-system/components/EmptyState";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { Alert } from "./renderer/design-system/components/Alert";

interface ClientSummary {
  id: string;
  displayName: string;
  sacks: number;
  receivableCents: number;
  receivedCents: number;
}

interface OpenNoteRow {
  id: string;
  documentNumber: string;
  series: string | null;
  operationDate: string;
  clientId: string;
  clientName: string;
  issuerName: string | null;
  destinationName: string | null;
  companyContext: string;
  companyTone: "villa" | "grao" | "other";
  operationScope: "INTERNAL" | "EXTERNAL";
  quantitySacks: string;
  rateCents: number;
  serviceAmountCents: number;
  hasPendingIssues: boolean;
}

function currentMonthToTodayRange(): { start: string; end: string } {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return { start: `${year}-${month}-01`, end: `${year}-${month}-${day}` };
}

function decimalBr(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) : value.replace(".", ",");
}

export function ChargesTab({ organizationId, legalEntityId }: { organizationId: string; legalEntityId?: string }): JSX.Element {
  const initial = currentMonthToTodayRange();
  const [periodStart, setPeriodStart] = useState(initial.start);
  const [periodEnd, setPeriodEnd] = useState(initial.end);
  const [clients, setClients] = useState<ClientSummary[] | null>(null);
  const [notes, setNotes] = useState<OpenNoteRow[] | null>(null);
  const [clientId, setClientId] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadClients = useCallback(async (): Promise<void> => {
    try {
      setClients(await apiJson(`/v1/viewer/clients?${queryString({ organizationId, legalEntityId, periodStart, periodEnd })}`));
    } catch (value) {
      setError(value instanceof Error ? value.message : "Falha ao carregar clientes.");
    }
  }, [organizationId, legalEntityId, periodStart, periodEnd]);

  const loadNotes = useCallback(async (): Promise<void> => {
    setError(null);
    setNotes(null);
    try {
      setNotes(await apiJson(`/v1/viewer/open-notes?${queryString({ organizationId, legalEntityId, periodStart, periodEnd, clientId: clientId || undefined })}`));
    } catch (value) {
      setError(value instanceof Error ? value.message : "Falha ao carregar notas em aberto.");
    }
  }, [organizationId, legalEntityId, periodStart, periodEnd, clientId]);

  useEffect(() => { if (organizationId) void loadClients(); }, [organizationId, loadClients]);
  useEffect(() => { if (organizationId) void loadNotes(); }, [organizationId, loadNotes]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return notes ?? [];
    return (notes ?? []).filter((note) => [note.documentNumber, note.clientName, note.issuerName, note.destinationName]
      .some((value) => value?.toLocaleLowerCase("pt-BR").includes(term)));
  }, [notes, search]);

  const selectedClient = clients?.find((client) => client.id === clientId);
  const totals = useMemo(() => filtered.reduce((result, note) => ({
    sacks: result.sacks + Number(note.quantitySacks || 0),
    amountCents: result.amountCents + note.serviceAmountCents
  }), { sacks: 0, amountCents: 0 }), [filtered]);

  return (
    <>
      <PageHeader eyebrow="Recebimentos" title="Notas em aberto" description="Notas que ainda não foram incluídas em uma cobrança, com as mesmas cores usadas no aplicativo." />
      <div className="viewer-period-filter">
        <label>Início<input className="ui-input" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
        <label>Fim<input className="ui-input" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
      </div>
      <FilterBar activeCount={(clientId ? 1 : 0) + (search ? 1 : 0)} onClear={() => { setClientId(""); setSearch(""); }}>
        <select className="ui-input" value={clientId} onChange={(event) => setClientId(event.target.value)}>
          <option value="">Todos os clientes</option>
          {(clients ?? []).map((client) => <option key={client.id} value={client.id}>{client.displayName}</option>)}
        </select>
        <input className="ui-input" type="search" placeholder="Buscar cliente, emitente, destino ou NF..." value={search} onChange={(event) => setSearch(event.target.value)} />
      </FilterBar>
      {notes && filtered.length > 0 ? (
        <Card
          eyebrow={selectedClient ? "Total do cliente no período" : "Total do filtro atual"}
          title={selectedClient?.displayName ?? "Todos os clientes"}
          className="viewer-open-notes-summary"
        >
          <div className="viewer-open-notes-summary__metrics">
            <span><small>Notas em aberto</small><strong>{filtered.length}</strong></span>
            <span><small>Sacas</small><strong>{totals.sacks.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}</strong></span>
            <span><small>Valor a pagar</small><strong>{formatCurrencyBr(totals.amountCents)}</strong></span>
          </div>
        </Card>
      ) : null}
      {error ? <Alert tone="danger" title="Falha ao carregar notas">{error}</Alert> : null}
      {!error && !notes ? <LoadingState label="Carregando notas em aberto..." /> : null}
      {notes && filtered.length === 0 ? <EmptyState title="Nenhuma nota em aberto encontrada" description="Ajuste o cliente ou o período. Notas já cobradas não aparecem nesta lista." /> : null}
      {filtered.length > 0 ? (
        <div className="viewer-open-note-list" role="table" aria-label="Notas em aberto">
          <div className="viewer-open-note-list__head" role="row">
            <span>Nota</span>
            <span>Cliente</span>
            <span>Emissão</span>
            <span>Operação</span>
            <span>Valor</span>
            <span>Status</span>
          </div>
          {filtered.map((note) => (
            <div key={note.id} className={`viewer-open-note-row viewer-company-accent--${note.companyTone}`} role="row">
              <span className="viewer-open-note-row__note" role="cell">
                <strong>NF {note.documentNumber}</strong>
                <small>{formatDateBr(note.operationDate)}</small>
              </span>
              <span role="cell">
                <strong>{note.clientName}</strong>
                <small>{note.companyContext}</small>
              </span>
              <span role="cell">
                <strong>{note.issuerName ?? "Emitente não identificado"}</strong>
                <small>Destino: {note.destinationName ?? "Não identificado"}</small>
              </span>
              <span role="cell">
                <strong>{note.operationScope === "INTERNAL" ? "Mesma UF" : "Outra UF"}</strong>
                <small>{decimalBr(note.quantitySacks)} sacas · {formatCurrencyBr(note.rateCents)}/saca</small>
              </span>
              <span className="viewer-open-note-row__amount" role="cell">
                <strong>{formatCurrencyBr(note.serviceAmountCents)}</strong>
                <small>{decimalBr(note.quantitySacks)} sacas</small>
              </span>
              <span role="cell">
                <span className="viewer-open-note__status">Não cobrada{note.hasPendingIssues ? " · Com pendências" : ""}</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
