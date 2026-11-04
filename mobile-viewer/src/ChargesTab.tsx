import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson, downloadChargePdf, queryString } from "./api";
import { companyColorClass } from "./companyColor";
import { formatCurrencyBr, formatDateBr } from "./viewerFormat";
import { Alert } from "./renderer/design-system/components/Alert";
import { StatusBadge } from "./renderer/design-system/components/Badge";
import { Button } from "./renderer/design-system/components/Button";
import { Card } from "./renderer/design-system/components/Card";
import { EmptyState } from "./renderer/design-system/components/EmptyState";
import { FilterBar } from "./renderer/design-system/components/FilterBar";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { PageHeader } from "./renderer/design-system/components/PageHeader";
import { Tabs } from "./renderer/design-system/components/Tabs";

interface ClientSummary { id: string; displayName: string; }

interface OpenNoteRow {
  id: string;
  documentNumber: string;
  operationDate: string;
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

interface ChargeRow {
  id: string;
  chargeNumber: string | null;
  referenceCode: string | null;
  clientName: string;
  legalEntityName: string;
  periodStart: string;
  periodEnd: string;
  issueDate: string | null;
  dueDate: string | null;
  status: string;
  finalAmountCents: number;
  paidAmountCents: number;
  openAmountCents: number;
}

type ChargeView = "OPEN_NOTES" | "ISSUED_CHARGES";
type ChargeStatusFilter = "OPEN" | "PAID" | "ALL";

const STATUS_LABELS: Record<ChargeStatusFilter, string> = { OPEN: "Em aberto", PAID: "Pagas", ALL: "Todas" };

function currentMonthToTodayRange(): { start: string; end: string } {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return { start: `${today.getFullYear()}-${month}-01`, end: `${today.getFullYear()}-${month}-${day}` };
}

function decimalBr(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) : value.replace(".", ",");
}

function safeFilePart(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function ChargesTab({ organizationId, legalEntityId }: { organizationId: string; legalEntityId?: string }): JSX.Element {
  const initial = currentMonthToTodayRange();
  const [view, setView] = useState<ChargeView>("OPEN_NOTES");
  const [periodStart, setPeriodStart] = useState(initial.start);
  const [periodEnd, setPeriodEnd] = useState(initial.end);

  return (
    <>
      <PageHeader eyebrow="Recebimentos" title="Cobranças" description="Consulte notas ainda não cobradas e cobranças já emitidas pelo aplicativo." />
      <Tabs
        items={[{ id: "OPEN_NOTES", label: "Notas em aberto" }, { id: "ISSUED_CHARGES", label: "Cobranças emitidas" }]}
        active={view}
        onChange={setView}
      />
      <div className="viewer-period-filter viewer-charge-period">
        <label>Início<input className="ui-input" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
        <label>Fim<input className="ui-input" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
      </div>
      {view === "OPEN_NOTES"
        ? <OpenNotesPanel organizationId={organizationId} legalEntityId={legalEntityId} periodStart={periodStart} periodEnd={periodEnd} />
        : <IssuedChargesPanel organizationId={organizationId} legalEntityId={legalEntityId} periodStart={periodStart} periodEnd={periodEnd} />}
    </>
  );
}

interface PanelProps { organizationId: string; legalEntityId?: string; periodStart: string; periodEnd: string; }

function OpenNotesPanel({ organizationId, legalEntityId, periodStart, periodEnd }: PanelProps): JSX.Element {
  const [clients, setClients] = useState<ClientSummary[] | null>(null);
  const [notes, setNotes] = useState<OpenNoteRow[] | null>(null);
  const [clientId, setClientId] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadClients = useCallback(async (): Promise<void> => {
    try { setClients(await apiJson(`/v1/viewer/clients?${queryString({ organizationId, legalEntityId, periodStart, periodEnd })}`)); }
    catch (value) { setError(value instanceof Error ? value.message : "Falha ao carregar clientes."); }
  }, [organizationId, legalEntityId, periodStart, periodEnd]);

  const loadNotes = useCallback(async (): Promise<void> => {
    setError(null);
    setNotes(null);
    try { setNotes(await apiJson(`/v1/viewer/open-notes?${queryString({ organizationId, legalEntityId, periodStart, periodEnd, clientId: clientId || undefined })}`)); }
    catch (value) { setError(value instanceof Error ? value.message : "Falha ao carregar notas em aberto."); }
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
    sacks: result.sacks + Number(note.quantitySacks || 0), amountCents: result.amountCents + note.serviceAmountCents
  }), { sacks: 0, amountCents: 0 }), [filtered]);

  return (
    <>
      <FilterBar activeCount={(clientId ? 1 : 0) + (search ? 1 : 0)} onClear={() => { setClientId(""); setSearch(""); }}>
        <select className="ui-input" value={clientId} onChange={(event) => setClientId(event.target.value)}>
          <option value="">Todos os clientes</option>
          {(clients ?? []).map((client) => <option key={client.id} value={client.id}>{client.displayName}</option>)}
        </select>
        <input className="ui-input" type="search" placeholder="Buscar cliente, emitente, destino ou NF..." value={search} onChange={(event) => setSearch(event.target.value)} />
      </FilterBar>
      {notes && filtered.length > 0 ? (
        <Card eyebrow={selectedClient ? "Total do cliente no período" : "Total do filtro atual"} title={selectedClient?.displayName ?? "Todos os clientes"} className="viewer-open-notes-summary">
          <div className="viewer-open-notes-summary__metrics">
            <span><small>Notas em aberto</small><strong>{filtered.length}</strong></span>
            <span><small>Sacas</small><strong>{totals.sacks.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}</strong></span>
            <span><small>Valor a cobrar</small><strong>{formatCurrencyBr(totals.amountCents)}</strong></span>
          </div>
        </Card>
      ) : null}
      {error ? <Alert tone="danger" title="Falha ao carregar notas">{error}</Alert> : null}
      {!error && !notes ? <LoadingState label="Carregando notas em aberto..." /> : null}
      {notes && filtered.length === 0 ? <EmptyState title="Nenhuma nota em aberto encontrada" description="Ajuste o cliente ou o período. Notas já cobradas não aparecem nesta lista." /> : null}
      {filtered.length > 0 ? (
        <div className="viewer-open-note-list" role="table" aria-label="Notas em aberto">
          <div className="viewer-open-note-list__head" role="row"><span>Nota</span><span>Cliente</span><span>Emissão</span><span>Operação</span><span>Valor</span><span>Status</span></div>
          {filtered.map((note) => (
            <div key={note.id} className={`viewer-open-note-row viewer-company-accent--${note.companyTone}`} role="row">
              <span className="viewer-open-note-row__note" role="cell"><strong>NF {note.documentNumber}</strong><small>{formatDateBr(note.operationDate)}</small></span>
              <span role="cell"><strong>{note.clientName}</strong><small>{note.companyContext}</small></span>
              <span role="cell"><strong>{note.issuerName ?? "Emitente não identificado"}</strong><small>Destino: {note.destinationName ?? "Não identificado"}</small></span>
              <span role="cell"><strong>{note.operationScope === "INTERNAL" ? "Mesma UF" : "Outra UF"}</strong><small>{decimalBr(note.quantitySacks)} sacas · {formatCurrencyBr(note.rateCents)}/saca</small></span>
              <span className="viewer-open-note-row__amount" role="cell"><strong>{formatCurrencyBr(note.serviceAmountCents)}</strong><small>{decimalBr(note.quantitySacks)} sacas</small></span>
              <span role="cell"><span className="viewer-open-note__status">Não cobrada{note.hasPendingIssues ? " · Com pendências" : ""}</span></span>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function IssuedChargesPanel({ organizationId, legalEntityId, periodStart, periodEnd }: PanelProps): JSX.Element {
  const [clients, setClients] = useState<ClientSummary[] | null>(null);
  const [charges, setCharges] = useState<ChargeRow[] | null>(null);
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState<ChargeStatusFilter>("OPEN");
  const [search, setSearch] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadClients = useCallback(async (): Promise<void> => {
    try { setClients(await apiJson(`/v1/viewer/clients?${queryString({ organizationId, legalEntityId, periodStart, periodEnd })}`)); }
    catch (value) { setError(value instanceof Error ? value.message : "Falha ao carregar clientes."); }
  }, [organizationId, legalEntityId, periodStart, periodEnd]);

  const loadCharges = useCallback(async (): Promise<void> => {
    setError(null);
    setCharges(null);
    try { setCharges(await apiJson(`/v1/viewer/charges?${queryString({ organizationId, legalEntityId, periodStart, periodEnd, clientId: clientId || undefined, status })}`)); }
    catch (value) { setError(value instanceof Error ? value.message : "Falha ao carregar cobranças."); }
  }, [organizationId, legalEntityId, periodStart, periodEnd, clientId, status]);

  useEffect(() => { if (organizationId) void loadClients(); }, [organizationId, loadClients]);
  useEffect(() => { if (organizationId) void loadCharges(); }, [organizationId, loadCharges]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return charges ?? [];
    return (charges ?? []).filter((charge) => `${charge.chargeNumber ?? ""} ${charge.referenceCode ?? ""} ${charge.clientName} ${charge.legalEntityName}`
      .toLocaleLowerCase("pt-BR").includes(term));
  }, [charges, search]);
  const totals = useMemo(() => filtered.reduce((result, charge) => ({
    finalCents: result.finalCents + charge.finalAmountCents,
    paidCents: result.paidCents + charge.paidAmountCents,
    openCents: result.openCents + charge.openAmountCents
  }), { finalCents: 0, paidCents: 0, openCents: 0 }), [filtered]);

  async function download(charge: ChargeRow): Promise<void> {
    setError(null);
    setDownloadingId(charge.id);
    try {
      const identifier = charge.chargeNumber ?? charge.referenceCode ?? charge.id.slice(0, 8);
      await downloadChargePdf(charge.id, `cobranca-${safeFilePart(identifier)}-${safeFilePart(charge.clientName)}.pdf`);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Falha ao gerar o PDF da cobrança.");
    } finally { setDownloadingId(null); }
  }

  return (
    <>
      <FilterBar activeCount={(clientId ? 1 : 0) + (status !== "ALL" ? 1 : 0) + (search ? 1 : 0)} onClear={() => { setClientId(""); setStatus("ALL"); setSearch(""); }}>
        <select className="ui-input" value={clientId} onChange={(event) => setClientId(event.target.value)}>
          <option value="">Todos os clientes</option>
          {(clients ?? []).map((client) => <option key={client.id} value={client.id}>{client.displayName}</option>)}
        </select>
        <input className="ui-input" type="search" placeholder="Buscar cliente ou número da cobrança..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <div className="viewer-chip-row">
          {(Object.keys(STATUS_LABELS) as ChargeStatusFilter[]).map((filter) => (
            <Button key={filter} variant={status === filter ? "primary" : "secondary"} onClick={() => setStatus(filter)}>{STATUS_LABELS[filter]}</Button>
          ))}
        </div>
      </FilterBar>
      {charges && filtered.length > 0 ? (
        <Card eyebrow="Totais do filtro atual" title={`${filtered.length} cobrança(s)`} className="viewer-open-notes-summary">
          <div className="viewer-open-notes-summary__metrics">
            <span><small>Valor total</small><strong>{formatCurrencyBr(totals.finalCents)}</strong></span>
            <span><small>Valor pago</small><strong>{formatCurrencyBr(totals.paidCents)}</strong></span>
            <span><small>Saldo em aberto</small><strong>{formatCurrencyBr(totals.openCents)}</strong></span>
          </div>
        </Card>
      ) : null}
      {error ? <Alert tone="danger" title="Falha ao carregar cobranças">{error}</Alert> : null}
      {!error && !charges ? <LoadingState label="Carregando cobranças..." /> : null}
      {charges && filtered.length === 0 ? <EmptyState title="Nenhuma cobrança encontrada" description="Ajuste o período, o cliente ou a situação." /> : null}
      {filtered.length > 0 ? (
        <div className="viewer-card-grid viewer-charge-grid">
          {filtered.map((charge) => (
            <Card key={charge.id} eyebrow={charge.legalEntityName} title={charge.chargeNumber ? `Cobrança ${charge.chargeNumber}` : charge.referenceCode ?? "Cobrança"} actions={<StatusBadge status={charge.status} />} className={companyColorClass(charge.legalEntityName)}>
              <p className="viewer-card-line"><strong>{charge.clientName}</strong></p>
              <p className="viewer-card-line viewer-card-line--muted">Período: {formatDateBr(charge.periodStart)} a {formatDateBr(charge.periodEnd)}</p>
              <div className="viewer-charge-card__dates">
                <span><small>Emissão</small><strong>{charge.issueDate ? formatDateBr(charge.issueDate) : "Não emitida"}</strong></span>
                <span><small>Vencimento</small><strong>{charge.dueDate ? formatDateBr(charge.dueDate) : "Não informado"}</strong></span>
              </div>
              <div className="viewer-charge-card__values">
                <span><small>Total</small><strong>{formatCurrencyBr(charge.finalAmountCents)}</strong></span>
                <span><small>Pago</small><strong>{formatCurrencyBr(charge.paidAmountCents)}</strong></span>
                <span><small>Em aberto</small><strong>{formatCurrencyBr(charge.openAmountCents)}</strong></span>
              </div>
              <Button className="viewer-charge-card__download" loading={downloadingId === charge.id} onClick={() => void download(charge)}>Baixar PDF</Button>
            </Card>
          ))}
        </div>
      ) : null}
    </>
  );
}
