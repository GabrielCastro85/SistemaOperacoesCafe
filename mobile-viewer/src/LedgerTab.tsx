import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { apiJson, queryString } from "./api";
import { formatCurrencyBr, formatDateBr } from "./viewerFormat";
import { centsToInput, chargeLabel, moneyToCents as chargeMoneyToCents } from "./ChargeEditor";
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
  availableAmountCents: number | null;
}
interface OpenChargeOption { id: string; chargeNumber: string | null; referenceCode: string | null; periodStart: string; periodEnd: string; status: string; openAmountCents: number }
interface LeftoverPayment { id: string; paymentDate: string; amountCents: number; paymentMethod: string; transactionReference: string | null; availableAmountCents: number }
type ApplyTarget = { kind: "entry"; id: string; label: string; availableCents: number } | { kind: "payment"; id: string; label: string; availableCents: number };
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

type EditableEntryType = "ADVANCE_RECEIVED" | "DISCOUNT" | "CREDIT" | "SURCHARGE" | "REIMBURSEMENT" | "PREVIOUS_BALANCE" | "MANUAL_ADJUSTMENT" | "LOAN" | "OTHER";
interface LedgerForm {
  entryType: EditableEntryType;
  effect: EntryEffect;
  amount: string;
  entryDate: string;
  description: string;
  referenceNumber: string;
  notes: string;
  collectionDueDate: string;
  applyNow: boolean;
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

function moneyToCents(value: string): number {
  const normalized = value.trim().replace(/\s/g, "").replace(/R\$/gi, "");
  const decimal = normalized.includes(",") ? normalized.replace(/\./g, "").replace(",", ".") : normalized;
  const parsed = Number(decimal);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

const fixedEffects: Partial<Record<EditableEntryType, EntryEffect>> = {
  ADVANCE_RECEIVED: "REDUCE_RECEIVABLE", DISCOUNT: "REDUCE_RECEIVABLE", CREDIT: "REDUCE_RECEIVABLE",
  SURCHARGE: "INCREASE_RECEIVABLE", LOAN: "INCREASE_RECEIVABLE"
};

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
  const [notice, setNotice] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const emptyForm = useCallback((): LedgerForm => ({
    entryType: "ADVANCE_RECEIVED", effect: "REDUCE_RECEIVABLE", amount: "", entryDate: new Date().toISOString().slice(0, 10),
    description: "Adiantamento recebido", referenceNumber: "", notes: "", collectionDueDate: "", applyNow: true
  }), []);
  const [form, setForm] = useState<LedgerForm>(() => emptyForm());
  const [openCharges, setOpenCharges] = useState<OpenChargeOption[]>([]);
  const [leftovers, setLeftovers] = useState<LeftoverPayment[]>([]);
  const [applying, setApplying] = useState<ApplyTarget | null>(null);
  const [applyChargeId, setApplyChargeId] = useState("");
  const [applyAmount, setApplyAmount] = useState("");

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

  const loadApplyOptions = useCallback(async (): Promise<void> => {
    setApplying(null);
    if (!organizationId || !clientId || !legalEntityId) { setOpenCharges([]); setLeftovers([]); return; }
    try {
      const [charges, payments] = await Promise.all([
        apiJson<OpenChargeOption[]>(`/v1/viewer/charges?${queryString({ organizationId, legalEntityId, periodStart: "2000-01-01", periodEnd: "2099-12-31", clientId, status: "OPEN" })}`),
        apiJson<LeftoverPayment[]>(`/v1/manage/client-payments?${queryString({ organizationId, legalEntityId, clientPartnerId: clientId })}`).catch(() => [] as LeftoverPayment[])
      ]);
      setOpenCharges(charges.filter((charge) => !["CANCELLED", "REPLACED", "PAID"].includes(charge.status)));
      setLeftovers(payments.filter((payment) => payment.availableAmountCents > 0));
    } catch { setOpenCharges([]); setLeftovers([]); }
  }, [organizationId, legalEntityId, clientId]);

  useEffect(() => { void loadClients(); }, [loadClients]);
  useEffect(() => { void loadLedger(); }, [loadLedger]);
  useEffect(() => { void loadApplyOptions(); }, [loadApplyOptions]);

  const startApply = (target: ApplyTarget): void => {
    const candidates = target.kind === "payment" ? openCharges.filter((charge) => ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(charge.status)) : openCharges;
    const first = candidates[0];
    setApplying(target);
    setApplyChargeId(first?.id ?? "");
    setApplyAmount(centsToInput(Math.min(target.availableCents, first?.openAmountCents || target.availableCents)));
  };
  const confirmApply = async (): Promise<void> => {
    if (!applying || !applyChargeId) return;
    const amountCents = chargeMoneyToCents(applyAmount);
    if (amountCents <= 0) { setError("Informe um valor maior que zero."); return; }
    setSaving(true); setError(null); setNotice(null);
    try {
      const path = applying.kind === "entry"
        ? `/v1/manage/ledger-entries/${encodeURIComponent(applying.id)}/apply`
        : `/v1/manage/client-payments/${encodeURIComponent(applying.id)}/allocate`;
      await apiJson(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chargeId: applyChargeId, amountCents }) });
      const charge = openCharges.find((item) => item.id === applyChargeId);
      setNotice(`${formatCurrencyBr(amountCents)} de ${applying.label} ${applying.kind === "entry" ? "aplicados" : "baixados"} em ${charge ? chargeLabel(charge) : "cobrança"}.`);
      setApplying(null);
      await Promise.all([loadLedger(), loadApplyOptions()]);
    } catch (value) { setError(value instanceof Error ? value.message : "Não foi possível aplicar na cobrança."); }
    finally { setSaving(false); }
  };
  const markCollected = async (entry: LedgerEntry): Promise<void> => {
    setError(null); setNotice(null);
    try {
      await apiJson(`/v1/manage/ledger-entries/${encodeURIComponent(entry.id)}/collected`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      setNotice("Empréstimo marcado como recebido."); await loadLedger();
    } catch (value) { setError(value instanceof Error ? value.message : "Falha ao marcar o empréstimo."); }
  };

  const selectEntryType = (entryType: EditableEntryType): void => {
    const labels: Record<EditableEntryType, string> = {
      ADVANCE_RECEIVED: "Adiantamento recebido", DISCOUNT: "Desconto", CREDIT: "Crédito", SURCHARGE: "Acréscimo",
      REIMBURSEMENT: "Reembolso", PREVIOUS_BALANCE: "Saldo anterior", MANUAL_ADJUSTMENT: "Ajuste manual", LOAN: "Empréstimo", OTHER: "Outro lançamento"
    };
    setForm((current) => ({ ...current, entryType, effect: fixedEffects[entryType] ?? current.effect, description: labels[entryType] }));
  };

  const saveEntry = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!legalEntityId || !clientId) { setError("Selecione a empresa e o cliente antes de lançar."); return; }
    const amountCents = moneyToCents(form.amount);
    if (amountCents <= 0) { setError("Informe um valor maior que zero."); return; }
    setSaving(true); setError(null); setNotice(null);
    try {
      await apiJson("/v1/manage/ledger-entries", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          organizationId, legalEntityId, clientPartnerId: clientId, entryType: form.entryType,
          effect: fixedEffects[form.entryType] ?? form.effect, amountCents, entryDate: form.entryDate,
          description: form.description, referenceNumber: form.referenceNumber, notes: form.notes,
          collectionDueDate: form.collectionDueDate || null, applyNow: form.applyNow
        })
      });
      setNotice("Lançamento salvo e enviado para a sincronização dos computadores.");
      setShowEditor(false); setForm(emptyForm()); await loadLedger();
    } catch (value) { setError(value instanceof Error ? value.message : "Falha ao salvar o lançamento."); }
    finally { setSaving(false); }
  };

  const cancelEntry = async (entry: LedgerEntry): Promise<void> => {
    const reason = window.prompt("Informe o motivo do cancelamento deste lançamento:")?.trim();
    if (!reason) return;
    setError(null); setNotice(null);
    try {
      await apiJson(`/v1/manage/ledger-entries/${encodeURIComponent(entry.id)}/cancel`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason })
      });
      setNotice("Lançamento cancelado. O histórico foi preservado para auditoria."); await loadLedger();
    } catch (value) { setError(value instanceof Error ? value.message : "Falha ao cancelar o lançamento."); }
  };

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
      <PageHeader eyebrow="Recebimentos" title="Conta-corrente" description="Consulte e registre adiantamentos, créditos, acréscimos e demais lançamentos dos clientes."
        actions={<Button variant="primary" disabled={!clientId || !legalEntityId} onClick={() => setShowEditor((current) => !current)}>{showEditor ? "Fechar lançamento" : "Novo lançamento"}</Button>} />
      {showEditor && clientId && legalEntityId ? (
        <Card eyebrow="Conta-corrente" title="Novo lançamento" className="viewer-editor-card">
          <form onSubmit={(event) => void saveEntry(event)}>
            <div className="viewer-form-grid">
              <label>Tipo<select className="ui-input" value={form.entryType} onChange={(event) => selectEntryType(event.target.value as EditableEntryType)}>
                <option value="ADVANCE_RECEIVED">Adiantamento</option><option value="CREDIT">Crédito</option><option value="DISCOUNT">Desconto</option>
                <option value="SURCHARGE">Acréscimo</option><option value="LOAN">Empréstimo</option><option value="REIMBURSEMENT">Reembolso</option>
                <option value="PREVIOUS_BALANCE">Saldo anterior</option><option value="MANUAL_ADJUSTMENT">Ajuste manual</option><option value="OTHER">Outro</option>
              </select></label>
              {!fixedEffects[form.entryType] ? <label>Efeito<select className="ui-input" value={form.effect} onChange={(event) => setForm({ ...form, effect: event.target.value as EntryEffect })}>
                <option value="INCREASE_RECEIVABLE">Aumenta o saldo a receber</option><option value="REDUCE_RECEIVABLE">Reduz o saldo a receber</option>
              </select></label> : null}
              <label>Valor (R$)<input className="ui-input" required inputMode="decimal" placeholder="0,00" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
              <label>Data<input className="ui-input" type="date" required value={form.entryDate} onChange={(event) => setForm({ ...form, entryDate: event.target.value })} /></label>
              <label>Descrição<input className="ui-input" required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
              <label>Referência<input className="ui-input" value={form.referenceNumber} onChange={(event) => setForm({ ...form, referenceNumber: event.target.value })} /></label>
              <label>Vencimento da cobrança<input className="ui-input" type="date" value={form.collectionDueDate} onChange={(event) => setForm({ ...form, collectionDueDate: event.target.value })} /></label>
            </div>
            <label>Observações<textarea className="ui-input" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
            <label className="viewer-checkbox"><input type="checkbox" checked={form.applyNow} onChange={(event) => setForm({ ...form, applyNow: event.target.checked })} /> Aplicar ao saldo agora</label>
            <div className="viewer-form-actions"><Button onClick={() => setShowEditor(false)}>Cancelar</Button><Button type="submit" variant="primary" loading={saving}>Salvar lançamento</Button></div>
          </form>
        </Card>
      ) : null}
      {notice ? <Alert tone="success" title="Alteração concluída">{notice}</Alert> : null}
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
          {applying ? (
            <Card eyebrow={applying.kind === "entry" ? "Usar saldo em cobrança" : "Baixar sobra de pagamento"} title={`${applying.label} · disponível ${formatCurrencyBr(applying.availableCents)}`} className="viewer-editor-card">
              {openCharges.length === 0 ? <p className="viewer-card-line viewer-card-line--muted">Este cliente não tem cobrança aberta para receber o valor.</p> : (
                <div className="viewer-form-grid">
                  <label>Cobrança<select className="ui-input" value={applyChargeId} onChange={(event) => setApplyChargeId(event.target.value)}>
                    {openCharges.filter((charge) => applying.kind === "entry" || ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(charge.status)).map((charge) => (
                      <option key={charge.id} value={charge.id}>{chargeLabel(charge)} · em aberto {formatCurrencyBr(charge.openAmountCents)}</option>
                    ))}
                  </select></label>
                  <label>Valor (R$)<input className="ui-input" inputMode="decimal" value={applyAmount} onChange={(event) => setApplyAmount(event.target.value)} /></label>
                </div>
              )}
              <div className="viewer-form-actions"><Button onClick={() => setApplying(null)}>Cancelar</Button><Button variant="primary" loading={saving} disabled={!applyChargeId} onClick={() => void confirmApply()}>Aplicar</Button></div>
            </Card>
          ) : null}
          {leftovers.length ? (
            <Card eyebrow="Pagamentos com sobra" title="Valores recebidos ainda não baixados" className="viewer-ledger-summary">
              {leftovers.map((payment) => (
                <div key={payment.id} className="viewer-charge-payment-row">
                  <span>{formatDateBr(payment.paymentDate)} · {payment.paymentMethod.replaceAll("_", " ")}{payment.transactionReference ? ` · ${payment.transactionReference}` : ""} · sobra {formatCurrencyBr(payment.availableAmountCents)} de {formatCurrencyBr(payment.amountCents)}</span>
                  <Button onClick={() => startApply({ kind: "payment", id: payment.id, label: `pagamento de ${formatDateBr(payment.paymentDate)}`, availableCents: payment.availableAmountCents })}>Baixar em cobrança</Button>
                </div>
              ))}
            </Card>
          ) : null}
          {filtered.length === 0 ? <EmptyState title="Nenhum lançamento encontrado" description="Ajuste o período, a busca ou o tipo de movimento." /> : (
            <div className="viewer-ledger-list" role="table" aria-label="Histórico da conta-corrente">
              <div className="viewer-ledger-list__head" role="row"><span>Data</span><span>Tipo</span><span>Descrição</span><span>Valor</span><span>Status</span><span>Ação</span></div>
              {filtered.map((entry) => (
                <div key={entry.id} className={`viewer-ledger-row viewer-ledger-row--${entry.effect === "INCREASE_RECEIVABLE" ? "increase" : "reduce"}`} role="row">
                  <span role="cell">{formatDateBr(entry.entryDate)}</span>
                  <span role="cell"><strong>{ENTRY_TYPE_LABELS[entry.entryType] ?? entry.entryType}</strong>{entry.referenceNumber ? <small>{entry.referenceNumber}</small> : null}</span>
                  <span role="cell"><strong>{entry.description}</strong><small>{entry.cancellationReason ? `Cancelado: ${entry.cancellationReason}` : [entry.notes, entry.status === "CONFIRMED" && entry.availableAmountCents ? `Disponível: ${formatCurrencyBr(entry.availableAmountCents)}` : null, entry.entryType === "LOAN" && entry.collectedAt ? "Recebido" : null].filter(Boolean).join(" · ")}</small></span>
                  <span className="viewer-ledger-row__amount" role="cell"><strong>{entry.effect === "INCREASE_RECEIVABLE" ? "+" : "−"} {formatCurrencyBr(entry.amountCents)}</strong></span>
                  <span role="cell"><StatusBadge status={entry.status} /></span>
                  <span role="cell" className="viewer-ledger-row__actions">
                    {entry.status === "CONFIRMED" && (entry.availableAmountCents ?? 0) > 0 && legalEntityId
                      ? <Button onClick={() => startApply({ kind: "entry", id: entry.id, label: entry.description, availableCents: entry.availableAmountCents ?? 0 })}>Usar em cobrança</Button> : null}
                    {entry.entryType === "LOAN" && entry.status === "CONFIRMED" && !entry.collectedAt ? <Button onClick={() => void markCollected(entry)}>Marcar recebido</Button> : null}
                    {entry.status !== "CANCELLED" && !["SERVICE_CHARGE", "PAYMENT_RECEIVED", "REVERSAL"].includes(entry.entryType)
                      ? <Button variant="danger" onClick={() => void cancelEntry(entry)}>Cancelar</Button> : null}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </>
  );
}
