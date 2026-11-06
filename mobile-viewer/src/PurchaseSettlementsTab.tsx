import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson, queryString } from "./api";
import { formatCurrencyBr, formatDateBr } from "./storage";
import { PageHeader } from "./renderer/design-system/components/PageHeader";
import { FilterBar } from "./renderer/design-system/components/FilterBar";
import { Card } from "./renderer/design-system/components/Card";
import { Button } from "./renderer/design-system/components/Button";
import { StatusBadge } from "./renderer/design-system/components/Badge";
import { ConfirmationDialog } from "./renderer/design-system/components/ConfirmationDialog";
import { EmptyState } from "./renderer/design-system/components/EmptyState";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { Alert } from "./renderer/design-system/components/Alert";
import { Tabs } from "./renderer/design-system/components/Tabs";
import type { AccountPayableRow, AccountPayableStatus } from "./types";

// Acertos de entrada: junta as compras por saca de um fornecedor numa conta a
// pagar, com o detalhamento nota a nota. Regras no servidor
// (server/src/settlementManagement.ts), iguais a generatePurchaseSettlement.

const OPEN_STATUSES: AccountPayableStatus[] = ["DRAFT", "SCHEDULED", "OPEN", "PARTIALLY_PAID", "OVERDUE", "CONTESTED"];
type FilterMode = "OPEN" | "PAID" | "ALL";
const FILTER_LABELS: Record<FilterMode, string> = { OPEN: "Em aberto", PAID: "Pagos", ALL: "Todos" };

interface EligibleOperation {
  id: string; supplierPartnerId: string; supplierName: string; ownLegalEntityId: string; ownLegalEntityName: string; operationDate: string;
  documentNumber: string; issuerName: string | null; recipientName: string | null; productName: string | null; operationScope: string;
  quantitySacks: string; rateCents: number; amountCents: number;
}
interface SettlementLine { id: string; operationDate: string; documentNumber: string | null; productName: string | null; operationScope: string; quantitySacks: string; rateCents: number; amountCents: number; released: boolean }
interface Group { key: string; supplierPartnerId: string; supplierName: string; ownLegalEntityId: string; ownLegalEntityName: string; operations: EligibleOperation[]; sacks: number; amountCents: number }

const json = (method: string, body: unknown = {}): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const sacksLabel = (value: number | string): string => Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
function monthStart(): string { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`; }
const today = (): string => new Date().toISOString().slice(0, 10);

export function PurchaseSettlementsTab({ organizationId, legalEntityId }: { organizationId: string; legalEntityId?: string }): JSX.Element {
  const [view, setView] = useState<"GENERATE" | "HISTORY">("GENERATE");
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <>
      <PageHeader eyebrow="Pagamentos" title="Acertos de entrada" description="Agrupe as notas de entrada por fornecedor, confira sacas e valor por saca, e gere a conta a pagar." />
      <Tabs items={[{ id: "GENERATE", label: "Gerar acerto" }, { id: "HISTORY", label: "Histórico" }]} active={view} onChange={(next) => { setView(next); setNotice(null); }} />
      {notice ? <Alert tone="success" title="Acerto atualizado">{notice}</Alert> : null}
      {view === "GENERATE"
        ? <GeneratePanel organizationId={organizationId} legalEntityId={legalEntityId} onCreated={(message) => { setNotice(message); setView("HISTORY"); }} />
        : <HistoryPanel organizationId={organizationId} legalEntityId={legalEntityId} onChanged={setNotice} />}
    </>
  );
}

function GeneratePanel({ organizationId, legalEntityId, onCreated }: { organizationId: string; legalEntityId?: string; onCreated: (message: string) => void }): JSX.Element {
  const [periodStart, setPeriodStart] = useState(monthStart);
  const [periodEnd, setPeriodEnd] = useState(today);
  const [supplierId, setSupplierId] = useState("");
  const [options, setOptions] = useState<{ suppliers: Array<{ id: string; displayName: string }>; categories: Array<{ id: string; name: string }> } | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [dueDate, setDueDate] = useState(today);
  const [operations, setOperations] = useState<EligibleOperation[] | null>(null);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiJson<NonNullable<typeof options>>(`/v1/manage/purchase-settlements/options?${queryString({ organizationId })}`).then((loaded) => {
      setOptions(loaded);
      setCategoryId((current) => current || loaded.categories[0]?.id || "");
    }).catch((value) => setError(value instanceof Error ? value.message : "Falha ao carregar fornecedores e categorias."));
  }, [organizationId]);
  const load = useCallback(async (): Promise<void> => {
    setOperations(null); setError(null); setExcluded([]);
    try {
      setOperations(await apiJson<EligibleOperation[]>(`/v1/manage/purchase-settlements/eligible?${queryString({ organizationId, legalEntityId, supplierPartnerId: supplierId || undefined, periodStart, periodEnd })}`));
    } catch (value) { setError(value instanceof Error ? value.message : "Falha ao buscar as notas de entrada."); setOperations([]); }
  }, [organizationId, legalEntityId, supplierId, periodStart, periodEnd]);
  useEffect(() => { void load(); }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const operation of operations ?? []) {
      const key = `${operation.supplierPartnerId}:${operation.ownLegalEntityId}`;
      const group = map.get(key) ?? { key, supplierPartnerId: operation.supplierPartnerId, supplierName: operation.supplierName, ownLegalEntityId: operation.ownLegalEntityId, ownLegalEntityName: operation.ownLegalEntityName, operations: [], sacks: 0, amountCents: 0 };
      group.operations.push(operation);
      if (!excluded.includes(operation.id)) { group.sacks += Number(operation.quantitySacks || 0); group.amountCents += operation.amountCents; }
      map.set(key, group);
    }
    return [...map.values()].sort((left, right) => left.supplierName.localeCompare(right.supplierName, "pt-BR"));
  }, [operations, excluded]);

  const generate = async (group: Group): Promise<void> => {
    const ids = group.operations.filter((operation) => !excluded.includes(operation.id)).map((operation) => operation.id);
    if (!ids.length) { setError("Deixe pelo menos uma nota marcada."); return; }
    if (!categoryId) { setError("Escolha a categoria financeira da conta a pagar."); return; }
    setBusy(group.key); setError(null);
    try {
      const result = await apiJson<{ amountCents: number }>("/v1/manage/purchase-settlements", json("POST", {
        organizationId, ownLegalEntityId: group.ownLegalEntityId, supplierPartnerId: group.supplierPartnerId, operationIds: ids, categoryId, dueDate,
        notes: `Acerto de entrada por saca de ${formatDateBr(periodStart)} a ${formatDateBr(periodEnd)}`
      }));
      onCreated(`Acerto de ${group.supplierName} gerado em contas a pagar: ${formatCurrencyBr(result.amountCents)} em ${ids.length} nota(s).`);
    } catch (value) { setError(value instanceof Error ? value.message : "Não foi possível gerar o acerto."); }
    finally { setBusy(null); }
  };

  return (
    <>
      <FilterBar activeCount={supplierId ? 1 : 0} onClear={() => setSupplierId("")}>
        <select className="ui-input" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
          <option value="">Todos os fornecedores</option>
          {(options?.suppliers ?? []).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.displayName}</option>)}
        </select>
        <div className="viewer-period-filter viewer-period-filter--inline">
          <label>Início<input className="ui-input" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
          <label>Fim<input className="ui-input" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
        </div>
        <div className="viewer-period-filter viewer-period-filter--inline">
          <label>Categoria<select className="ui-input" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            {(options?.categories ?? []).length === 0 ? <option value="">Nenhuma categoria cadastrada</option> : null}
            {(options?.categories ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select></label>
          <label>Vencimento<input className="ui-input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
        </div>
      </FilterBar>
      {error ? <Alert tone="danger" title="Não foi possível concluir">{error}</Alert> : null}
      {!operations ? <LoadingState label="Buscando notas de entrada..." /> : null}
      {operations && groups.length === 0 ? <EmptyState title="Nenhuma nota de entrada para acertar" description="Só entram compras confirmadas, sem pendência, com regra de entrada por saca e ainda não acertadas." /> : null}
      <div className="viewer-card-grid">
        {groups.map((group) => (
          <Card key={group.key} eyebrow={group.ownLegalEntityName} title={group.supplierName}>
            <div className="viewer-charge-card__values">
              <span><small>Notas</small><strong>{group.operations.length - group.operations.filter((operation) => excluded.includes(operation.id)).length}</strong></span>
              <span><small>Sacas</small><strong>{sacksLabel(group.sacks)}</strong></span>
              <span><small>A pagar</small><strong>{formatCurrencyBr(group.amountCents)}</strong></span>
            </div>
            {expanded === group.key ? (
              <div className="viewer-charge-payments">
                {group.operations.map((operation) => (
                  <label key={operation.id} className="viewer-charge-payment-row viewer-confirmation-pick">
                    <span><input type="checkbox" checked={!excluded.includes(operation.id)} onChange={(event) => setExcluded((current) => event.target.checked ? current.filter((id) => id !== operation.id) : [...current, operation.id])} />
                      {" "}NF {operation.documentNumber} · {formatDateBr(operation.operationDate)} · {sacksLabel(operation.quantitySacks)} sc × {formatCurrencyBr(operation.rateCents)}</span>
                    <strong>{formatCurrencyBr(operation.amountCents)}</strong>
                  </label>
                ))}
              </div>
            ) : null}
            <div className="viewer-charge-card__actions">
              <Button onClick={() => setExpanded((current) => current === group.key ? null : group.key)}>{expanded === group.key ? "Esconder notas" : "Ver notas"}</Button>
              <Button variant="primary" loading={busy === group.key} onClick={() => void generate(group)}>Gerar acerto</Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function HistoryPanel({ organizationId, legalEntityId, onChanged }: { organizationId: string; legalEntityId?: string; onChanged: (message: string) => void }): JSX.Element {
  const [payables, setPayables] = useState<AccountPayableRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("OPEN");
  const [lines, setLines] = useState<Record<string, SettlementLine[]>>({});
  const [cancelling, setCancelling] = useState<AccountPayableRow | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    setPayables(null);
    try {
      const rows = await apiJson<AccountPayableRow[]>(`/v1/viewer/payables?${queryString({ organizationId, legalEntityId })}`);
      setPayables(rows.filter((row) => row.source === "IMPORT"));
    } catch (value) { setError(value instanceof Error ? value.message : "Falha ao carregar acertos."); }
  }, [organizationId, legalEntityId]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (payables ?? []).filter((payable) => {
      if (filter === "OPEN" && !OPEN_STATUSES.includes(payable.status)) return false;
      if (filter === "PAID" && payable.status !== "PAID") return false;
      return !term || `${payable.supplier?.display_name ?? ""} ${payable.payee_name_snapshot} ${payable.description}`.toLowerCase().includes(term);
    });
  }, [payables, search, filter]);

  const toggleLines = async (id: string): Promise<void> => {
    if (lines[id]) { setLines((current) => { const next = { ...current }; delete next[id]; return next; }); return; }
    try {
      const loaded = await apiJson<SettlementLine[]>(`/v1/manage/purchase-settlements/${encodeURIComponent(id)}/operations`);
      setLines((current) => ({ ...current, [id]: loaded }));
    } catch (value) { setError(value instanceof Error ? value.message : "Falha ao carregar as notas do acerto."); }
  };
  const confirmCancel = async (): Promise<void> => {
    if (!cancelling || reason.trim().length < 3) return;
    const target = cancelling;
    setCancelling(null); setError(null);
    try {
      await apiJson(`/v1/manage/purchase-settlements/${encodeURIComponent(target.id)}/cancel`, json("POST", { reason }));
      setReason("");
      onChanged(`Acerto de ${target.supplier?.display_name ?? target.payee_name_snapshot} cancelado. As notas voltaram para "a acertar".`);
      await load();
    } catch (value) { setError(value instanceof Error ? value.message : "Não foi possível cancelar o acerto."); }
  };

  return (
    <>
      {error ? <Alert tone="danger" title="Não foi possível concluir">{error}</Alert> : null}
      {!error && !payables ? <LoadingState label="Carregando acertos..." /> : null}
      {payables ? <>
        <FilterBar activeCount={(filter !== "ALL" ? 1 : 0) + (search.trim() ? 1 : 0)} onClear={() => { setSearch(""); setFilter("ALL"); }}>
          <input type="search" className="ui-input" placeholder="Buscar fornecedor..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="viewer-chip-row">
            {(Object.keys(FILTER_LABELS) as FilterMode[]).map((mode) => <Button key={mode} variant={filter === mode ? "primary" : "secondary"} onClick={() => setFilter(mode)}>{FILTER_LABELS[mode]}</Button>)}
          </div>
        </FilterBar>
        {filtered.length === 0 ? <EmptyState title="Nenhum acerto encontrado" description="Ajuste a busca ou o filtro para ver outros resultados." /> : (
          <div className="viewer-card-grid">
            {filtered.map((payable) => (
              <Card key={payable.id} eyebrow={payable.own_legal_entity?.trade_name} title={payable.supplier?.display_name ?? payable.payee_name_snapshot} actions={<StatusBadge status={payable.status} />}>
                <p className="viewer-card-line">{payable.description}</p>
                <p className="viewer-card-line">Vencimento: {formatDateBr(payable.due_date)}</p>
                <p className="viewer-card-line">Total: {formatCurrencyBr(payable.final_amount_cents ?? 0)}{(payable.open_amount_cents ?? 0) > 0 ? ` · Em aberto: ${formatCurrencyBr(payable.open_amount_cents ?? 0)}` : ""}</p>
                {lines[payable.id] ? <div className="viewer-charge-payments">
                  {lines[payable.id].map((line) => <div key={line.id} className="viewer-charge-payment-row">
                    <span>NF {line.documentNumber ?? "—"} · {formatDateBr(line.operationDate)} · {sacksLabel(line.quantitySacks)} sc × {formatCurrencyBr(line.rateCents)}{line.released ? " · liberada" : ""}</span>
                    <strong>{formatCurrencyBr(line.amountCents)}</strong>
                  </div>)}
                </div> : null}
                <div className="viewer-charge-card__actions">
                  <Button onClick={() => void toggleLines(payable.id)}>{lines[payable.id] ? "Esconder notas" : "Ver notas"}</Button>
                  {payable.status !== "CANCELLED" && payable.paid_amount_cents === 0 ? <Button variant="danger" onClick={() => setCancelling(payable)}>Cancelar acerto</Button> : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </> : null}
      <ConfirmationDialog open={Boolean(cancelling)} title="Cancelar acerto" confirmLabel="Cancelar acerto" onCancel={() => setCancelling(null)} onConfirm={() => void confirmCancel()}>
        <p>A conta a pagar é cancelada e as notas voltam a ficar disponíveis para um novo acerto.</p>
        <textarea className="ui-input" rows={3} placeholder="Motivo (obrigatório)" value={reason} onChange={(event) => setReason(event.target.value)} />
      </ConfirmationDialog>
    </>
  );
}
