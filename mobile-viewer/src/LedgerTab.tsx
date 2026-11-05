import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson, queryString } from "./api";
import { formatCurrencyBr, formatDateBr } from "./viewerFormat";
import { Alert } from "./renderer/design-system/components/Alert";
import { StatusBadge } from "./renderer/design-system/components/Badge";
import { Button } from "./renderer/design-system/components/Button";
import { Card } from "./renderer/design-system/components/Card";
import { EmptyState } from "./renderer/design-system/components/EmptyState";
import { FilterBar } from "./renderer/design-system/components/FilterBar";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { PageHeader } from "./renderer/design-system/components/PageHeader";

type EntryEffect = "INCREASE_RECEIVABLE" | "REDUCE_RECEIVABLE";
type FilterMode = "ALL" | EntryEffect;

interface ClientSummary { id: string; displayName: string; }
interface LedgerEntry {
  id: string;
  entryType: string;
  effect: EntryEffect;
  amountCents: number;
  entryDate: string;
  description: string;
  referenceNumber: string | null;
  notes: string | null;
  status: string;
  collectionDueDate: string | null;
  collectedAt: string | null;
  cancellationReason: string | null;
}
interface LedgerResponse {
  client: ClientSummary;
  summary: {
    totalServiceCents: number;
    liveUnbilledServiceCents: number;
    surchargeCents: number;
    advanceCents: number;
    creditCents: number;
    paymentCents: number;
    balanceCents: number;
  };
  entries: LedgerEntry[];
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  SERVICE_CHARGE: "Cobrança de serviço", ADVANCE_RECEIVED: "Adiantamento", PAYMENT_RECEIVED: "Pagamento",
  DISCOUNT: "Desconto", CREDIT: "Crédito", SURCHARGE: "Acréscimo", REIMBURSEMENT: "Reembolso",
  PREVIOUS_BALANCE: "Saldo anterior", MANUAL_ADJUSTMENT: "Ajuste manual", REVERSAL: "Estorno", LOAN: "Empréstimo", OTHER: "Outro"
};
const FILTER_LABELS: Record<FilterMode, string> = { ALL: "Todos", INCREASE_RECEIVABLE: "Aumentam o saldo", REDUCE_RECEIVABLE: "Reduzem o saldo" };

function currentMonthToTodayRange(): { start: string; end: string } {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return { start: `${today.getFullYear()}-${month}-01`, end: `${today.getFullYear()}-${month}-${day}` };
}

export function LedgerTab({ organizationId, legalEntityId }: { organizationId: string; legalEntityId?: string }): JSX.Element {
  const initial = currentMonthToTodayRange();
  const [periodStart, setPeriodStart] = useState(initial.start);
  const [periodEnd, setPeriodEnd] = useState(initial.end);
  const [clients, setClients] = useState<ClientSummary[] | null>(null);
  const [clientId, setClientId] = useState("");
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [filter, setFilter] = useState<FilterMode>("ALL");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadClients = useCallback(async (): Promise<void> => {
    if (!organizationId) return;
    try {
      const loaded = await apiJson<ClientSummary[]>(`/v1/viewer/clients?${queryString({ organizationId, legalEntityId, periodStart, periodEnd })}`);
      setClients(loaded);
      setClientId((current) => loaded.some((client) => client.id === current) ? current : "");
    } catch (value) { setError(value instanceof Error ? value.message : "Falha ao carregar clientes."); }
  }, [organizationId, legalEntityId, periodStart, periodEnd]);

  const loadLedger = useCallback(async (): Promise<void> => {
    if (!organizationId || !clientId) { setData(null); return; }
    setError(null);
    setData(null);
    try {
      setData(await apiJson<LedgerResponse>(`/v1/viewer/ledger?${queryString({ organizationId, legalEntityId, periodStart, periodEnd, clientId })}`));
    } catch (value) { setError(value instanceof Error ? value.message : "Falha ao carregar a conta-corrente."); }
  }, [organizationId, legalEntityId, periodStart, periodEnd, clientId]);

  useEffect(() => { void loadClients(); }, [loadClients]);
  useEffect(() => { void loadLedger(); }, [loadLedger]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return (data?.entries ?? []).filter((entry) => {
      if (filter !== "ALL" && entry.effect !== filter) return false;
      if (!term) return true;
      return `${ENTRY_TYPE_LABELS[entry.entryType] ?? entry.entryType} ${entry.description} ${entry.referenceNumber ?? ""} ${entry.notes ?? ""}`
        .toLocaleLowerCase("pt-BR").includes(term);
    });
  }, [data, filter, search]);

  return (
    <>
      <PageHeader eyebrow="Recebimentos" title="Conta-corrente" description="Consulte saldos, adiantamentos, créditos, pagamentos e demais lançamentos dos clientes." />
      <FilterBar activeCount={(clientId ? 1 : 0) + (filter !== "ALL" ? 1 : 0) + (search ? 1 : 0) + 2} onClear={() => { setClientId(""); setFilter("ALL"); setSearch(""); const range = currentMonthToTodayRange(); setPeriodStart(range.start); setPeriodEnd(range.end); }}>
        <select className="ui-input" value={clientId} onChange={(event) => setClientId(event.target.value)}>
          <option value="">Selecione um cliente</option>
          {(clients ?? []).map((client) => <option key={client.id} value={client.id}>{client.displayName}</option>)}
        </select>
        <div className="viewer-period-filter viewer-period-filter--inline">
          <label>Início<input className="ui-input" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
          <label>Fim<input className="ui-input" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
        </div>
        <input className="ui-input" type="search" placeholder="Buscar tipo, descrição ou referência..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <div className="viewer-chip-row">
          {(Object.keys(FILTER_LABELS) as FilterMode[]).map((mode) => <Button key={mode} variant={filter === mode ? "primary" : "secondary"} onClick={() => setFilter(mode)}>{FILTER_LABELS[mode]}</Button>)}
        </div>
      </FilterBar>
      {error ? <Alert tone="danger" title="Falha ao carregar conta-corrente">{error}</Alert> : null}
      {!clientId ? <EmptyState title="Selecione um cliente" description="Escolha o cliente acima para consultar o saldo e o histórico do período." /> : null}
      {clientId && !error && !data ? <LoadingState label="Carregando conta-corrente..." /> : null}
      {data ? (
        <>
          <Card eyebrow="Resumo da conta-corrente" title={data.client.displayName} className="viewer-ledger-summary">
            <div className="viewer-ledger-summary__grid">
              <span><small>Total dos serviços</small><strong>{formatCurrencyBr(data.summary.totalServiceCents)}</strong></span>
              <span><small>Acréscimos/Empréstimos</small><strong>{formatCurrencyBr(data.summary.surchargeCents)}</strong></span>
              <span><small>Adiantamentos</small><strong>{formatCurrencyBr(data.summary.advanceCents)}</strong></span>
              <span><small>Créditos</small><strong>{formatCurrencyBr(data.summary.creditCents)}</strong></span>
              <span><small>Pagamentos recebidos</small><strong>{formatCurrencyBr(data.summary.paymentCents)}</strong></span>
              <span className="viewer-ledger-summary__balance"><small>Saldo a receber</small><strong>{formatCurrencyBr(data.summary.balanceCents)}</strong></span>
            </div>
            {data.summary.liveUnbilledServiceCents > 0 ? <p className="viewer-card-line viewer-card-line--muted">Inclui {formatCurrencyBr(data.summary.liveUnbilledServiceCents)} de notas confirmadas ainda sem cobrança emitida.</p> : null}
          </Card>
          {filtered.length === 0 ? <EmptyState title="Nenhum lançamento encontrado" description="Ajuste o período, a busca ou o tipo de movimento." /> : (
            <div className="viewer-ledger-list" role="table" aria-label="Histórico da conta-corrente">
              <div className="viewer-ledger-list__head" role="row"><span>Data</span><span>Tipo</span><span>Descrição</span><span>Valor</span><span>Status</span></div>
              {filtered.map((entry) => (
                <div key={entry.id} className={`viewer-ledger-row viewer-ledger-row--${entry.effect === "INCREASE_RECEIVABLE" ? "increase" : "reduce"}`} role="row">
                  <span role="cell">{formatDateBr(entry.entryDate)}</span>
                  <span role="cell"><strong>{ENTRY_TYPE_LABELS[entry.entryType] ?? entry.entryType}</strong>{entry.referenceNumber ? <small>{entry.referenceNumber}</small> : null}</span>
                  <span role="cell"><strong>{entry.description}</strong><small>{entry.cancellationReason ? `Cancelado: ${entry.cancellationReason}` : entry.notes ?? ""}</small></span>
                  <span className="viewer-ledger-row__amount" role="cell"><strong>{entry.effect === "INCREASE_RECEIVABLE" ? "+" : "−"} {formatCurrencyBr(entry.amountCents)}</strong></span>
                  <span role="cell"><StatusBadge status={entry.status} /></span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </>
  );
}
