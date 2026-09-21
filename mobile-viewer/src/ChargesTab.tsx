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

function currentYearRange(): { start: string; end: string } {
  const year = new Date().getFullYear();
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

function decimalBr(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) : value.replace(".", ",");
}

export function ChargesTab({ organizationId, legalEntityId }: { organizationId: string; legalEntityId?: string }): JSX.Element {
  const initial = currentYearRange();
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
      {selectedClient ? <Card eyebrow="Cliente selecionado" title={selectedClient.displayName}><p className="viewer-card-line">{selectedClient.sacks.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} sacas · A receber: {formatCurrencyBr(selectedClient.receivableCents)} · Recebido: {formatCurrencyBr(selectedClient.receivedCents)}</p></Card> : null}
      {notes && filtered.length > 0 ? <Card eyebrow="Notas não cobradas" title={`${filtered.length} nota(s)`}><p className="viewer-card-line"><strong>{totals.sacks.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} sacas</strong> · {formatCurrencyBr(totals.amountCents)} em serviços</p></Card> : null}
      {error ? <Alert tone="danger" title="Falha ao carregar notas">{error}</Alert> : null}
      {!error && !notes ? <LoadingState label="Carregando notas em aberto..." /> : null}
      {notes && filtered.length === 0 ? <EmptyState title="Nenhuma nota em aberto encontrada" description="Ajuste o cliente ou o período. Notas já cobradas não aparecem nesta lista." /> : null}
      {filtered.length > 0 ? <div className="viewer-card-grid viewer-open-note-grid">{filtered.map((note) => (
        <Card key={note.id} eyebrow={formatDateBr(note.operationDate)} title={`NF ${note.documentNumber}`} className={`viewer-company-accent--${note.companyTone}`}>
          <div className="viewer-open-note__status">Não cobrada{note.hasPendingIssues ? " · Com pendências" : ""}</div>
          <p className="viewer-open-note__client">{note.clientName}</p>
          {note.issuerName ? <p className="viewer-card-line">Emitida por <strong>{note.issuerName}</strong></p> : null}
          <p className="viewer-card-line">Destino: <strong>{note.destinationName ?? "Não identificado"}</strong></p>
          <p className="viewer-card-line viewer-card-line--muted">{note.companyContext}</p>
          <div className="viewer-open-note__numbers">
            <span><small>{note.operationScope === "INTERNAL" ? "Mesma UF" : "Outra UF"}</small><strong>{decimalBr(note.quantitySacks)} sacas</strong></span>
            <span><small>Tarifa</small><strong>{formatCurrencyBr(note.rateCents)}/saca</strong></span>
            <span><small>Valor</small><strong>{formatCurrencyBr(note.serviceAmountCents)}</strong></span>
          </div>
        </Card>
      ))}</div> : null}
    </>
  );
}
