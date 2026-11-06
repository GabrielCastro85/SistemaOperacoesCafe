import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson, downloadChargePdf, queryString } from "./api";
import { ChargeDrawer, downloadChargeControl, printChargeControl, ReceivePaymentDrawer } from "./ChargeEditor";
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
  clientId: string;
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
  payments: Array<{
    id: string;
    paymentDate: string;
    amountCents: number;
    paymentMethod: string;
    transactionReference: string | null;
    notes: string | null;
  }>;
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

function currencyInputToCents(value: string): number {
  const cleaned = value.trim().replace(/\s/g, "").replace(/R\$/gi, "");
  if (!cleaned) return 0;
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function ChargesTab({ organizationId, legalEntityId }: { organizationId: string; legalEntityId?: string }): JSX.Element {
  const initial = currentMonthToTodayRange();
  const [view, setView] = useState<ChargeView>("OPEN_NOTES");
  const [periodStart, setPeriodStart] = useState(initial.start);
  const [periodEnd, setPeriodEnd] = useState(initial.end);
  const [openChargeId, setOpenChargeId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <>
      <PageHeader eyebrow="Recebimentos" title="Cobranças" description="Gere, confira, ajuste e emita cobranças, e registre os recebimentos." />
      <Tabs
        items={[{ id: "OPEN_NOTES", label: "Notas em aberto" }, { id: "ISSUED_CHARGES", label: "Cobranças emitidas" }]}
        active={view}
        onChange={(next) => { setView(next); setNotice(null); }}
      />
      <div className="viewer-period-filter viewer-charge-period">
        <label>Início<input className="ui-input" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
        <label>Fim<input className="ui-input" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
      </div>
      {notice ? <Alert tone="success" title="Cobrança atualizada">{notice}</Alert> : null}
      {view === "OPEN_NOTES"
        ? <OpenNotesPanel key={refreshKey} organizationId={organizationId} legalEntityId={legalEntityId} periodStart={periodStart} periodEnd={periodEnd} onOpenCharge={setOpenChargeId} />
        : <IssuedChargesPanel key={refreshKey} organizationId={organizationId} legalEntityId={legalEntityId} periodStart={periodStart} periodEnd={periodEnd} onOpenCharge={setOpenChargeId} />}
      <ChargeDrawer chargeId={openChargeId} organizationId={organizationId}
        onClose={() => { setOpenChargeId(null); setRefreshKey((current) => current + 1); }}
        onChanged={(message) => setNotice(message)} />
    </>
  );
}

interface PanelProps { organizationId: string; legalEntityId?: string; periodStart: string; periodEnd: string; onOpenCharge: (id: string) => void; }

function OpenNotesPanel({ organizationId, legalEntityId, periodStart, periodEnd, onOpenCharge }: PanelProps): JSX.Element {
  const [clients, setClients] = useState<ClientSummary[] | null>(null);
  const [notes, setNotes] = useState<OpenNoteRow[] | null>(null);
  const [clientId, setClientId] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [chargeNotes, setChargeNotes] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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
  useEffect(() => { setSelectedIds([]); }, [clientId, periodStart, periodEnd]);

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
  const selectedNotes = useMemo(() => (notes ?? []).filter((note) => selectedIds.includes(note.id)), [notes, selectedIds]);
  const selectedAmount = selectedNotes.reduce((sum, note) => sum + note.serviceAmountCents, 0);

  function toggleNote(id: string): void {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function issueCharge(): Promise<void> {
    if (!legalEntityId || !clientId || !selectedIds.length) return;
    setIssuing(true); setError(null); setMessage(null);
    try {
      await apiJson("/v1/manage/client-charges/issue", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, legalEntityId, clientPartnerId: clientId, operationIds: selectedIds, periodStart, periodEnd, dueDate: dueDate || null, notes: chargeNotes })
      });
      setMessage(`Cobrança de ${formatCurrencyBr(selectedAmount)} emitida para ${selectedClient?.displayName ?? "o cliente"}.`);
      setSelectedIds([]); setDueDate(""); setChargeNotes("");
      await loadNotes();
    } catch (value) { setError(value instanceof Error ? value.message : "Falha ao emitir cobrança."); }
    finally { setIssuing(false); }
  }

  async function createDraft(): Promise<void> {
    if (!legalEntityId || !clientId || !selectedIds.length) return;
    setIssuing(true); setError(null); setMessage(null);
    try {
      const created = await apiJson<{ id: string }>("/v1/manage/client-charges/drafts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, legalEntityId, clientPartnerId: clientId, operationIds: selectedIds, periodStart, periodEnd, dueDate: dueDate || null, notes: chargeNotes })
      });
      setSelectedIds([]); setDueDate(""); setChargeNotes("");
      onOpenCharge(created.id);
      await loadNotes();
    } catch (value) { setError(value instanceof Error ? value.message : "Falha ao gerar o rascunho."); }
    finally { setIssuing(false); }
  }

  return (
    <>
      <FilterBar activeCount={(clientId ? 1 : 0) + (search ? 1 : 0)} onClear={() => { setClientId(""); setSearch(""); }}>
        <select className="ui-input" value={clientId} onChange={(event) => { setClientId(event.target.value); setMessage(null); }}>
          <option value="">Todos os clientes</option>
          {(clients ?? []).map((client) => <option key={client.id} value={client.id}>{client.displayName}</option>)}
        </select>
        <input className="ui-input" type="search" placeholder="Buscar cliente, emitente, destino ou NF..." value={search} onChange={(event) => setSearch(event.target.value)} />
      </FilterBar>
      {!clientId ? <Alert tone="info" title="Escolha um cliente para emitir">A seleção das notas é liberada depois que você escolhe o responsável pela cobrança.</Alert> : null}
      {message ? <Alert tone="success" title="Cobrança emitida">{message}</Alert> : null}
      {selectedIds.length ? <Card eyebrow="Nova cobrança" title={`${selectedIds.length} nota(s) selecionada(s) · ${formatCurrencyBr(selectedAmount)}`} className="viewer-charge-issue-card">
        <small>No rascunho dá para conferir, aplicar desconto, acréscimo, CT-e e créditos antes de emitir.</small>
        <div className="viewer-charge-issue-fields">
          <label>Vencimento<input className="ui-input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
          <label>Observação<input className="ui-input" value={chargeNotes} onChange={(event) => setChargeNotes(event.target.value)} placeholder="Opcional" /></label>
          <Button loading={issuing} onClick={() => void createDraft()}>Gerar rascunho</Button>
          <Button variant="primary" loading={issuing} onClick={() => void issueCharge()}>Emitir direto</Button>
        </div>
      </Card> : null}
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
              <span className="viewer-open-note-row__note" role="cell"><label className="viewer-open-note-select"><input type="checkbox" disabled={!clientId || note.hasPendingIssues} checked={selectedIds.includes(note.id)} onChange={() => toggleNote(note.id)} /><span><strong>NF {note.documentNumber}</strong><small>{formatDateBr(note.operationDate)}</small></span></label></span>
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

function IssuedChargesPanel({ organizationId, legalEntityId, periodStart, periodEnd, onOpenCharge }: PanelProps): JSX.Element {
  const [clients, setClients] = useState<ClientSummary[] | null>(null);
  const [charges, setCharges] = useState<ChargeRow[] | null>(null);
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState<ChargeStatusFilter>("OPEN");
  const [search, setSearch] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [paymentChargeId, setPaymentChargeId] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  function openPayment(charge: ChargeRow): void {
    setPaymentChargeId(charge.id);
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentAmount((charge.openAmountCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setPaymentMethod("PIX");
    setPaymentReference("");
    setPaymentNotes("");
    setError(null);
    setMessage(null);
  }

  async function savePayment(charge: ChargeRow): Promise<void> {
    const amountCents = currencyInputToCents(paymentAmount);
    if (!amountCents) { setError("Informe um valor de pagamento maior que zero."); return; }
    setSavingPayment(true); setError(null); setMessage(null);
    try {
      await apiJson("/v1/manage/client-payments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chargeId: charge.id, paymentDate, amountCents, paymentMethod, transactionReference: paymentReference, notes: paymentNotes })
      });
      setPaymentChargeId(null);
      setMessage(`Pagamento de ${formatCurrencyBr(amountCents)} registrado em ${charge.clientName}.`);
      await loadCharges();
    } catch (value) { setError(value instanceof Error ? value.message : "Falha ao registrar pagamento."); }
    finally { setSavingPayment(false); }
  }

  async function cancelPayment(paymentId: string): Promise<void> {
    const reason = window.prompt("Informe o motivo do estorno deste pagamento:")?.trim();
    if (!reason) return;
    setError(null); setMessage(null);
    try {
      await apiJson(`/v1/manage/client-payments/${encodeURIComponent(paymentId)}/cancel`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason })
      });
      setMessage("Pagamento estornado. A cobrança voltou ao saldo em aberto.");
      await loadCharges();
    } catch (value) { setError(value instanceof Error ? value.message : "Falha ao estornar pagamento."); }
  }

  const selectedClientName = clients?.find((client) => client.id === clientId)?.displayName ?? "cliente";
  const controlDescription = `${clientId ? selectedClientName : "Todos os clientes"} · ${formatDateBr(periodStart)} a ${formatDateBr(periodEnd)}`;
  async function exportControl(kind: "xlsx" | "print"): Promise<void> {
    setExporting(true); setError(null);
    try {
      const ids = filtered.map((charge) => charge.id);
      if (kind === "xlsx") await downloadChargeControl(ids, controlDescription); else await printChargeControl(ids, controlDescription);
    } catch (value) { setError(value instanceof Error ? value.message : "Falha ao gerar o controle."); }
    finally { setExporting(false); }
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
          <div className="viewer-charge-card__actions">
            <Button loading={exporting} onClick={() => void exportControl("xlsx")}>Controle em Excel</Button>
            <Button loading={exporting} onClick={() => void exportControl("print")}>Imprimir controle</Button>
            {clientId && legalEntityId ? <Button variant="primary" onClick={() => setReceiving(true)}>Receber e distribuir</Button> : null}
          </div>
        </Card>
      ) : null}
      {message ? <Alert tone="success" title="Cobrança atualizada">{message}</Alert> : null}
      {error ? <Alert tone="danger" title="Não foi possível concluir">{error}</Alert> : null}
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
              {charge.payments.length ? <div className="viewer-charge-payments">
                <strong>Pagamentos registrados</strong>
                {charge.payments.map((payment) => <div key={payment.id} className="viewer-charge-payment-row">
                  <span>{formatDateBr(payment.paymentDate)} · {formatCurrencyBr(payment.amountCents)} · {payment.paymentMethod.replaceAll("_", " ")}</span>
                  <Button variant="secondary" onClick={() => void cancelPayment(payment.id)}>Estornar</Button>
                </div>)}
              </div> : null}
              {paymentChargeId === charge.id ? <div className="viewer-charge-payment-form">
                <label>Data<input className="ui-input" type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label>
                <label>Valor recebido<input className="ui-input" inputMode="decimal" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></label>
                <label>Forma<select className="ui-input" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                  <option value="PIX">PIX</option><option value="BANK_TRANSFER">Transferência bancária</option><option value="CASH">Dinheiro</option>
                  <option value="CHECK">Cheque</option><option value="OFFSET">Compensação</option><option value="OTHER">Outra</option>
                </select></label>
                <label>Referência<input className="ui-input" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Opcional" /></label>
                <label className="viewer-charge-payment-form__notes">Observação<input className="ui-input" value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} placeholder="Opcional" /></label>
                <div className="viewer-charge-payment-form__actions"><Button variant="secondary" onClick={() => setPaymentChargeId(null)}>Cancelar</Button><Button loading={savingPayment} onClick={() => void savePayment(charge)}>Confirmar pagamento</Button></div>
              </div> : null}
              <div className="viewer-charge-card__actions">
                <Button variant="primary" onClick={() => onOpenCharge(charge.id)}>Abrir</Button>
                <Button className="viewer-charge-card__download" loading={downloadingId === charge.id} onClick={() => void download(charge)}>Baixar PDF</Button>
                {charge.openAmountCents > 0 && ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(charge.status)
                  ? <Button onClick={() => openPayment(charge)}>Registrar pagamento</Button> : null}
              </div>
            </Card>
          ))}
        </div>
      ) : null}
      {legalEntityId && clientId ? <ReceivePaymentDrawer open={receiving} organizationId={organizationId} legalEntityId={legalEntityId} clientId={clientId} clientName={selectedClientName}
        charges={(charges ?? []).filter((charge) => charge.clientId === clientId)} onClose={() => setReceiving(false)}
        onDone={(text) => { setReceiving(false); setMessage(text); void loadCharges(); }} /> : null}
    </>
  );
}
