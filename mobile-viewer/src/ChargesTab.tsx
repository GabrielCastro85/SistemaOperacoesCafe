import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson, downloadChargePdf, queryString } from "./api";
import { formatCurrencyBr, formatDateBr } from "./viewerFormat";
import { PageHeader } from "./renderer/design-system/components/PageHeader";
import { FilterBar } from "./renderer/design-system/components/FilterBar";
import { Card } from "./renderer/design-system/components/Card";
import { Button } from "./renderer/design-system/components/Button";
import { StatusBadge } from "./renderer/design-system/components/Badge";
import { EmptyState } from "./renderer/design-system/components/EmptyState";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { Alert } from "./renderer/design-system/components/Alert";
import { companyColorClass } from "./companyColor";

type FilterMode = "OPEN" | "PAID" | "ALL";
interface ClientSummary { id: string; displayName: string; sacks: number; receivableCents: number; receivedCents: number }
interface ChargeRow { id: string; clientId: string; clientName: string; legalEntityName: string; periodStart: string; periodEnd: string; dueDate: string | null; status: string; finalAmountCents: number; paidAmountCents: number; openAmountCents: number }

function currentYearRange(): { start: string; end: string } {
  const year = new Date().getFullYear();
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

export function ChargesTab({ organizationId, legalEntityId }: { organizationId: string; legalEntityId?: string }): JSX.Element {
  const initial = currentYearRange();
  const [periodStart, setPeriodStart] = useState(initial.start);
  const [periodEnd, setPeriodEnd] = useState(initial.end);
  const [clients, setClients] = useState<ClientSummary[] | null>(null);
  const [charges, setCharges] = useState<ChargeRow[] | null>(null);
  const [clientId, setClientId] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FilterMode>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const loadClients = useCallback(async (): Promise<void> => {
    try { setClients(await apiJson(`/v1/viewer/clients?${queryString({ organizationId, legalEntityId, periodStart, periodEnd })}`)); }
    catch (value) { setError(value instanceof Error ? value.message : "Falha ao carregar clientes."); }
  }, [organizationId, legalEntityId, periodStart, periodEnd]);
  const loadCharges = useCallback(async (): Promise<void> => {
    setError(null); setCharges(null);
    try { setCharges(await apiJson(`/v1/viewer/charges?${queryString({ organizationId, legalEntityId, periodStart, periodEnd, clientId: clientId || undefined, status })}`)); }
    catch (value) { setError(value instanceof Error ? value.message : "Falha ao carregar cobranças."); }
  }, [organizationId, legalEntityId, periodStart, periodEnd, clientId, status]);

  useEffect(() => { if (organizationId) void loadClients(); }, [organizationId, loadClients]);
  useEffect(() => { if (organizationId) void loadCharges(); }, [organizationId, loadCharges]);
  async function generatePdf(charge: ChargeRow): Promise<void> {
    setDownloading(charge.id); setError(null);
    try {
      const client = charge.clientName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-");
      await downloadChargePdf(charge.id, `${client}-${charge.periodStart}-a-${charge.periodEnd}.pdf`);
    } catch (value) { setError(value instanceof Error ? value.message : "Falha ao gerar o PDF."); }
    finally { setDownloading(null); }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (charges ?? []).filter((charge) => !term || charge.clientName.toLowerCase().includes(term));
  }, [charges, search]);
  const selectedClient = clients?.find((client) => client.id === clientId);

  return (
    <>
      <PageHeader eyebrow="Recebimentos" title="Cobranças" description="Consulte o cliente, confira os valores e gere o mesmo PDF usado no aplicativo." />
      <div className="viewer-period-filter">
        <label>Início<input className="ui-input" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
        <label>Fim<input className="ui-input" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
      </div>
      <FilterBar activeCount={(clientId ? 1 : 0) + (status !== "ALL" ? 1 : 0) + (search ? 1 : 0)} onClear={() => { setClientId(""); setStatus("ALL"); setSearch(""); }}>
        <select className="ui-input" value={clientId} onChange={(event) => setClientId(event.target.value)}>
          <option value="">Todos os clientes</option>
          {(clients ?? []).map((client) => <option key={client.id} value={client.id}>{client.displayName}</option>)}
        </select>
        <input className="ui-input" type="search" placeholder="Buscar cliente..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <div className="viewer-chip-row">
          {(["ALL", "OPEN", "PAID"] as FilterMode[]).map((item) => <Button key={item} variant={status === item ? "primary" : "secondary"} onClick={() => setStatus(item)}>{item === "ALL" ? "Todas" : item === "OPEN" ? "Em aberto" : "Pagas"}</Button>)}
        </div>
      </FilterBar>
      {selectedClient ? <Card eyebrow="Cliente selecionado" title={selectedClient.displayName}><p className="viewer-card-line">{selectedClient.sacks.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} sacas · A receber: {formatCurrencyBr(selectedClient.receivableCents)} · Recebido: {formatCurrencyBr(selectedClient.receivedCents)}</p></Card> : null}
      {error ? <Alert tone="danger" title="Falha ao carregar cobranças">{error}</Alert> : null}
      {!error && !charges ? <LoadingState label="Carregando cobranças..." /> : null}
      {charges && filtered.length === 0 ? <EmptyState title="Nenhuma cobrança encontrada" description="Ajuste o cliente, período ou situação." /> : null}
      {filtered.length > 0 ? <div className="viewer-card-grid">{filtered.map((charge) => (
        <Card key={charge.id} title={charge.clientName} actions={<StatusBadge status={charge.status} />} className={companyColorClass(charge.legalEntityName)}>
          <p className="viewer-card-line">{charge.legalEntityName}</p>
          <p className="viewer-card-line">{formatDateBr(charge.periodStart)} a {formatDateBr(charge.periodEnd)}</p>
          <p className="viewer-card-line">Total: {formatCurrencyBr(charge.finalAmountCents)} · Recebido: {formatCurrencyBr(charge.paidAmountCents)} · Em aberto: {formatCurrencyBr(charge.openAmountCents)}</p>
          <div className="viewer-card-actions"><Button variant="primary" loading={downloading === charge.id} onClick={() => void generatePdf(charge)}>Gerar PDF</Button></div>
        </Card>
      ))}</div> : null}
    </>
  );
}
