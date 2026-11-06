import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson, queryString } from "./api";
import { centsToInput, moneyToCents } from "./ChargeEditor";
import { formatCurrencyBr, formatDateBr } from "./viewerFormat";
import { PageHeader } from "./renderer/design-system/components/PageHeader";
import { FilterBar } from "./renderer/design-system/components/FilterBar";
import { Card } from "./renderer/design-system/components/Card";
import { Badge, StatusBadge } from "./renderer/design-system/components/Badge";
import { Button } from "./renderer/design-system/components/Button";
import { ConfirmationDialog } from "./renderer/design-system/components/ConfirmationDialog";
import { Drawer } from "./renderer/design-system/components/Drawer";
import { EmptyState } from "./renderer/design-system/components/EmptyState";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { Alert } from "./renderer/design-system/components/Alert";
import { Tabs } from "./renderer/design-system/components/Tabs";

// Conferencia de repasses: confere listas de pagamentos contra o valor das
// notas, sem gerar cobranca nem movimento financeiro. Regras no servidor
// (server/src/settlementManagement.ts), iguais ao AppRepository.

type Role = "CLIENT" | "SUPPLIER";
interface ReconciliationRow {
  id: string; clientName: string; counterpartyRole: Role; sourceMode: "INVOICES" | "MANUAL"; referenceDate: string; title: string | null;
  notes: string | null; status: string; totalSourceCents: number; totalPaymentsCents: number; balanceCents: number; invoiceCount: number; paymentCount: number;
}
interface Balance { clientPartnerId: string; clientName: string; creditCents: number; debitCents: number; netBalanceCents: number; openReconciliations: number }
interface AvailableInvoice { fiscalDocumentId: string; organizationName: string; documentNumber: string; issueDate: string; issuerName: string | null; recipientName: string | null; invoiceTotalCents: number; availableCents: number }
interface PaymentDraft { id?: string; beneficiaryName: string; beneficiaryDocument: string; description: string; paymentDate: string; amount: string; notes: string }
interface Detail {
  reconciliation: { id: string; clientPartnerId: string; clientName: string; counterpartyRole: Role; sourceMode: "INVOICES" | "MANUAL"; manualSourceCents: number | null; referenceDate: string; title: string | null; notes: string | null; status: string };
  invoices: Array<{ fiscalDocumentId: string; sourceAmountCents: number }>;
  payments: Array<{ id: string; beneficiaryName: string; beneficiaryDocument: string | null; description: string | null; paymentDate: string | null; amountCents: number; notes: string | null }>;
}

const today = (): string => new Date().toISOString().slice(0, 10);
const emptyPayment = (): PaymentDraft => ({ beneficiaryName: "", beneficiaryDocument: "", description: "", paymentDate: today(), amount: "", notes: "" });
const json = (method: string, body: unknown = {}): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const STATUS_LABEL: Record<string, string> = { DRAFT: "Rascunho", COMPLETED: "Concluída", CANCELLED: "Cancelada" };

export function TransferReconciliationsTab({ organizationId, legalEntityId }: { organizationId: string; legalEntityId?: string }): JSX.Element {
  const [view, setView] = useState<"LIST" | "BALANCES">("LIST");
  const [rows, setRows] = useState<ReconciliationRow[] | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id?: string } | null>(null);
  const [dialog, setDialog] = useState<{ kind: "cancel" | "delete"; row: ReconciliationRow } | null>(null);

  const load = useCallback(async () => {
    setRows(null);
    setError(null);
    try {
      setRows(await apiJson<ReconciliationRow[]>(`/v1/viewer/transfer-reconciliations?${queryString({ organizationId, legalEntityId })}`));
      setBalances(await apiJson<Balance[]>(`/v1/manage/transfer-reconciliations/balances?${queryString({ organizationId })}`).catch(() => []));
    } catch (value) {
      setError(value instanceof Error ? value.message : "Falha ao carregar repasses.");
    }
  }, [organizationId, legalEntityId]);
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (rows ?? []).filter((row) => !term || `${row.clientName} ${row.title ?? ""} ${STATUS_LABEL[row.status] ?? row.status}`.toLowerCase().includes(term));
  }, [rows, search]);

  const confirmDialog = async (): Promise<void> => {
    if (!dialog) return;
    const { kind, row } = dialog;
    setDialog(null); setError(null);
    try {
      if (kind === "cancel") await apiJson(`/v1/manage/transfer-reconciliations/${encodeURIComponent(row.id)}/cancel`, json("POST"));
      else await apiJson(`/v1/manage/transfer-reconciliations/${encodeURIComponent(row.id)}`, { method: "DELETE" });
      setNotice(kind === "cancel" ? `Conferência de ${row.clientName} cancelada. Ela deixou de compor o saldo.` : `Conferência de ${row.clientName} excluída.${row.sourceMode === "INVOICES" ? " Os valores das notas voltaram a ficar disponíveis." : ""}`);
      await load();
    } catch (value) { setError(value instanceof Error ? value.message : "Não foi possível concluir."); }
  };

  return <>
    <PageHeader eyebrow="Recebimentos" title="Conferência de repasses" description="Confira listas de pagamentos contra o valor das notas, sem gerar cobrança ou movimento financeiro."
      actions={<Button variant="primary" onClick={() => setEditing({})}>Nova conferência</Button>} />
    <Tabs items={[{ id: "LIST", label: "Conferências" }, { id: "BALANCES", label: "Saldos por cliente" }]} active={view} onChange={setView} />
    {notice ? <Alert tone="success" title="Conferência atualizada">{notice}</Alert> : null}
    {error ? <Alert tone="danger" title="Não foi possível concluir">{error}</Alert> : null}
    {!error && !rows ? <LoadingState label="Carregando conferências..." /> : null}
    {rows && view === "LIST" ? <>
      <FilterBar activeCount={search.trim() ? 1 : 0} onClear={() => setSearch("")}>
        <input className="ui-input" type="search" placeholder="Buscar cliente, fornecedor ou título..." value={search} onChange={(event) => setSearch(event.target.value)} />
      </FilterBar>
      {filtered.length === 0 ? <EmptyState title="Nenhuma conferência encontrada" description="Ajuste a busca ou crie uma nova conferência." /> :
        <div className="viewer-card-grid">{filtered.map((row) => <Card key={row.id} title={row.clientName} actions={<StatusBadge status={row.status} />}>
          <p className="viewer-card-line">{row.counterpartyRole === "SUPPLIER" ? "Fornecedor" : "Cliente"} · {formatDateBr(row.referenceDate)}</p>
          {row.title ? <p className="viewer-card-line">{row.title}</p> : null}
          <p className="viewer-card-line">Origem: {row.sourceMode === "MANUAL" ? "Valor informado" : `${row.invoiceCount} nota(s)`} · {row.paymentCount} pagamento(s)</p>
          <p className="viewer-card-line">Valor: {formatCurrencyBr(row.totalSourceCents)} · Pago: {formatCurrencyBr(row.totalPaymentsCents)}</p>
          <p className="viewer-card-line"><strong>{row.balanceCents > 0 ? "Crédito" : row.balanceCents < 0 ? "Débito" : "Saldo"}: {formatCurrencyBr(row.balanceCents)}</strong></p>
          <div className="viewer-charge-card__actions">
            {row.status !== "CANCELLED" ? <Button variant="primary" onClick={() => setEditing({ id: row.id })}>Editar</Button> : null}
            {row.status !== "CANCELLED" ? <Button onClick={() => setDialog({ kind: "cancel", row })}>Cancelar</Button> : null}
            <Button variant="danger" onClick={() => setDialog({ kind: "delete", row })}>Excluir</Button>
          </div>
        </Card>)}</div>}
    </> : null}
    {rows && view === "BALANCES" ? (balances.length === 0 ? <EmptyState title="Nenhum saldo" description="Conferências concluídas de clientes aparecem aqui." /> :
      <div className="viewer-ledger-list" role="table" aria-label="Saldos por cliente">
        <div className="viewer-ledger-list__head viewer-transfer-balance" role="row"><span>Cliente</span><span>Crédito</span><span>Débito</span><span>Saldo líquido</span><span>Rascunhos</span></div>
        {balances.map((row) => <div key={row.clientPartnerId} className="viewer-ledger-row viewer-transfer-balance" role="row">
          <span role="cell"><strong>{row.clientName}</strong></span><span role="cell">{formatCurrencyBr(row.creditCents)}</span><span role="cell">{formatCurrencyBr(row.debitCents)}</span>
          <span role="cell"><strong>{formatCurrencyBr(row.netBalanceCents)}</strong></span><span role="cell">{row.openReconciliations}</span>
        </div>)}
      </div>) : null}
    {editing ? <ReconciliationDrawer organizationId={organizationId} id={editing.id} onClose={() => setEditing(null)}
      onSaved={(message) => { setEditing(null); setNotice(message); void load(); }} /> : null}
    <ConfirmationDialog open={Boolean(dialog)} title={dialog?.kind === "cancel" ? "Cancelar conferência" : "Excluir conferência"} confirmLabel={dialog?.kind === "cancel" ? "Cancelar conferência" : "Excluir"}
      onCancel={() => setDialog(null)} onConfirm={() => void confirmDialog()}>
      {dialog?.kind === "cancel" ? "Ela deixará de compor o saldo e os valores usados das notas voltam a ficar disponíveis." : "A conferência é apagada de vez. Os valores usados das notas voltam a ficar disponíveis."}
    </ConfirmationDialog>
  </>;
}

function ReconciliationDrawer({ organizationId, id, onClose, onSaved }: { organizationId: string; id?: string; onClose: () => void; onSaved: (message: string) => void }): JSX.Element {
  const [loading, setLoading] = useState(Boolean(id));
  const [role, setRole] = useState<Role>("CLIENT");
  const [partners, setPartners] = useState<Array<{ id: string; displayName: string }>>([]);
  const [partnerId, setPartnerId] = useState("");
  const [referenceDate, setReferenceDate] = useState(today());
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceMode, setSourceMode] = useState<"INVOICES" | "MANUAL">("INVOICES");
  const [manualAmount, setManualAmount] = useState("");
  const [invoices, setInvoices] = useState<AvailableInvoice[] | null>(null);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [limit, setLimit] = useState(15);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [payments, setPayments] = useState<PaymentDraft[]>([emptyPayment()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void apiJson<Detail>(`/v1/manage/transfer-reconciliations/${encodeURIComponent(id)}`).then((detail) => {
      const r = detail.reconciliation;
      setRole(r.counterpartyRole); setPartnerId(r.clientPartnerId); setReferenceDate(r.referenceDate); setTitle(r.title ?? ""); setNotes(r.notes ?? "");
      setSourceMode(r.sourceMode); setManualAmount(r.manualSourceCents == null ? "" : centsToInput(r.manualSourceCents));
      setSelected(Object.fromEntries(detail.invoices.map((item) => [item.fiscalDocumentId, centsToInput(item.sourceAmountCents)])));
      setPayments(detail.payments.length ? detail.payments.map((item) => ({ id: item.id, beneficiaryName: item.beneficiaryName, beneficiaryDocument: item.beneficiaryDocument ?? "", description: item.description ?? "", paymentDate: item.paymentDate ?? "", amount: centsToInput(item.amountCents), notes: item.notes ?? "" })) : [emptyPayment()]);
    }).catch((value) => setError(value instanceof Error ? value.message : "Falha ao carregar a conferência.")).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => {
    void apiJson<Array<{ id: string; displayName: string }>>(`/v1/manage/transfer-reconciliations/partners?${queryString({ organizationId, role })}`).then(setPartners).catch(() => setPartners([]));
  }, [organizationId, role]);
  useEffect(() => {
    if (!partnerId || sourceMode !== "INVOICES") { setInvoices(null); return; }
    setInvoices(null);
    void apiJson<AvailableInvoice[]>(`/v1/manage/transfer-reconciliations/invoices?${queryString({ organizationId, partnerId, role, reconciliationId: id })}`)
      .then(setInvoices).catch((value) => setError(value instanceof Error ? value.message : "Falha ao carregar as notas."));
  }, [organizationId, partnerId, role, sourceMode, id]);

  const totalSource = sourceMode === "MANUAL" ? Math.max(0, moneyToCents(manualAmount)) : Object.values(selected).reduce((sum, value) => sum + Math.max(0, moneyToCents(value)), 0);
  const totalPayments = payments.reduce((sum, item) => sum + Math.max(0, moneyToCents(item.amount)), 0);
  const balance = totalSource - totalPayments;
  const visible = useMemo(() => {
    const term = invoiceSearch.trim().toLocaleLowerCase("pt-BR");
    const list = (invoices ?? []).filter((invoice) => !term || [invoice.organizationName, invoice.documentNumber, invoice.issuerName, invoice.recipientName, invoice.issueDate].some((value) => String(value ?? "").toLocaleLowerCase("pt-BR").includes(term)));
    // Notas ja marcadas ficam sempre no topo.
    return [...list.filter((invoice) => invoice.fiscalDocumentId in selected), ...list.filter((invoice) => !(invoice.fiscalDocumentId in selected))];
  }, [invoices, invoiceSearch, selected]);
  const updatePayment = (index: number, patch: Partial<PaymentDraft>): void => setPayments((rows) => rows.map((row, i) => i === index ? { ...row, ...patch } : row));

  const save = async (status: "DRAFT" | "COMPLETED"): Promise<void> => {
    setError(null);
    if (!partnerId) { setError(`Selecione ${role === "SUPPLIER" ? "o fornecedor" : "o cliente"}.`); return; }
    const invoiceRows = sourceMode === "MANUAL" ? [] : Object.entries(selected).map(([fiscalDocumentId, value]) => ({ fiscalDocumentId, sourceAmountCents: moneyToCents(value) })).filter((item) => item.sourceAmountCents > 0);
    const paymentRows = payments.filter((item) => moneyToCents(item.amount) > 0).map((item) => ({
      id: item.id, beneficiaryName: item.beneficiaryName, beneficiaryDocument: item.beneficiaryDocument || null, description: item.description || null,
      paymentDate: item.paymentDate || null, amountCents: moneyToCents(item.amount), notes: item.notes || null
    }));
    if (sourceMode === "INVOICES" && !invoiceRows.length) { setError("Selecione pelo menos uma nota e informe o valor usado."); return; }
    if (paymentRows.some((item) => !item.beneficiaryName.trim())) { setError("Informe o favorecido de cada pagamento com valor."); return; }
    setBusy(true);
    try {
      await apiJson("/v1/manage/transfer-reconciliations", json("POST", {
        id, organizationId, clientPartnerId: partnerId, counterpartyRole: role, sourceMode, manualSourceCents: sourceMode === "MANUAL" ? totalSource : null,
        referenceDate, title: title || null, notes: notes || null, status, invoices: invoiceRows, payments: paymentRows
      }));
      onSaved(status === "COMPLETED" ? "Conferência concluída." : "Rascunho da conferência salvo.");
    } catch (value) { setError(value instanceof Error ? value.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  };

  const party = (invoice: AvailableInvoice) => (role === "SUPPLIER" ? invoice.issuerName : invoice.recipientName) ?? "—";
  return (
    <Drawer open title={id ? "Editar conferência de repasse" : "Nova conferência de repasse"} onClose={onClose}>
      <div className="viewer-invoice-editor">
        {error ? <Alert tone="danger" title="Não foi possível concluir">{error}</Alert> : null}
        {loading ? <LoadingState label="Carregando conferência..." /> : <>
          <div className="viewer-invoice-editor__grid">
            <label>Exibir notas de<select className="ui-select" value={role} disabled={Boolean(id)} onChange={(event) => { setRole(event.target.value as Role); setPartnerId(""); setSelected({}); }}>
              <option value="CLIENT">Clientes (notas de saída)</option><option value="SUPPLIER">Fornecedores (notas de entrada)</option>
            </select></label>
            <label>{role === "SUPPLIER" ? "Fornecedor" : "Cliente"}<select className="ui-select" value={partnerId} disabled={Boolean(id)} onChange={(event) => { setPartnerId(event.target.value); setSelected({}); }}>
              <option value="">Selecione</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.displayName}</option>)}
            </select></label>
            <label>Data de referência<input className="ui-input" type="date" value={referenceDate} onChange={(event) => setReferenceDate(event.target.value)} /></label>
            <label>Título<input className="ui-input" placeholder="Ex.: Repasse de outubro" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label>Origem do valor<select className="ui-select" value={sourceMode} disabled={Boolean(id)} onChange={(event) => { setSourceMode(event.target.value as "INVOICES" | "MANUAL"); setSelected({}); setManualAmount(""); }}>
              <option value="INVOICES">Notas fiscais</option><option value="MANUAL">Valor manual (sem notas)</option>
            </select></label>
            {sourceMode === "MANUAL" ? <label>Valor inicial<input className="ui-input" inputMode="decimal" placeholder="0,00" value={manualAmount} onChange={(event) => setManualAmount(event.target.value)} /></label> : <span />}
          </div>

          {sourceMode === "INVOICES" ? (
            <div className="viewer-invoice-editor__section">
              <strong>Notas ({Object.keys(selected).length} marcada(s))</strong>
              {!partnerId ? <small>Selecione {role === "SUPPLIER" ? "o fornecedor" : "o cliente"} para listar as notas.</small> : !invoices ? <LoadingState label="Carregando notas..." /> : <>
                <input className="ui-input" type="search" placeholder="Buscar número, emitente, destinatário ou data" value={invoiceSearch} onChange={(event) => { setInvoiceSearch(event.target.value); setLimit(15); }} />
                {visible.length === 0 ? <small>Nenhuma nota encontrada.</small> : null}
                {visible.slice(0, limit).map((invoice) => {
                  const checked = invoice.fiscalDocumentId in selected;
                  const used = moneyToCents(selected[invoice.fiscalDocumentId] ?? "");
                  return <div className="viewer-invoice-editor__line" key={invoice.fiscalDocumentId}>
                    <span><strong><label className="viewer-checkbox"><input type="checkbox" checked={checked} onChange={(event) => setSelected((current) => {
                      const next = { ...current };
                      if (event.target.checked) next[invoice.fiscalDocumentId] = centsToInput(Math.max(0, invoice.availableCents)); else delete next[invoice.fiscalDocumentId];
                      return next;
                    })} /> NF {invoice.documentNumber}</label></strong><small>{formatDateBr(invoice.issueDate)} · {invoice.organizationName}</small></span>
                    <span>{party(invoice)}<small>Nota {formatCurrencyBr(invoice.invoiceTotalCents)} · disponível {formatCurrencyBr(invoice.availableCents)}</small></span>
                    <span>{checked ? <input className="ui-input" inputMode="decimal" aria-label="Valor nesta conferência" value={selected[invoice.fiscalDocumentId]} onChange={(event) => setSelected((current) => ({ ...current, [invoice.fiscalDocumentId]: event.target.value }))} /> : null}
                      {checked && used > invoice.availableCents ? <small className="viewer-text-danger">Acima do disponível</small> : null}</span>
                  </div>;
                })}
                {visible.length > limit ? <Button onClick={() => setLimit((value) => value + 15)}>Mostrar mais notas</Button> : null}
              </>}
            </div>
          ) : null}

          <div className="viewer-invoice-editor__section">
            <strong>Pagamentos <Button variant="ghost" onClick={() => setPayments((rows) => [...rows, emptyPayment()])}>Adicionar pagamento</Button></strong>
            {payments.map((payment, index) => (
              <div className="viewer-confirmation-add viewer-transfer-payment" key={payment.id ?? `new-${index}`}>
                <input className="ui-input" placeholder="Favorecido" value={payment.beneficiaryName} onChange={(event) => updatePayment(index, { beneficiaryName: event.target.value })} />
                <input className="ui-input" placeholder="CPF/CNPJ" value={payment.beneficiaryDocument} onChange={(event) => updatePayment(index, { beneficiaryDocument: event.target.value })} />
                <input className="ui-input" placeholder="Descrição" value={payment.description} onChange={(event) => updatePayment(index, { description: event.target.value })} />
                <input className="ui-input" type="date" value={payment.paymentDate} onChange={(event) => updatePayment(index, { paymentDate: event.target.value })} />
                <input className="ui-input" inputMode="decimal" placeholder="Valor" value={payment.amount} onChange={(event) => updatePayment(index, { amount: event.target.value })} />
                <input className="ui-input" placeholder="Observação" value={payment.notes} onChange={(event) => updatePayment(index, { notes: event.target.value })} />
                <Button variant="ghost" onClick={() => setPayments((rows) => rows.length === 1 ? [emptyPayment()] : rows.filter((_, i) => i !== index))}>Remover</Button>
              </div>
            ))}
            <label>Observações gerais<textarea className="ui-input" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          </div>

          <dl className="viewer-invoice-editor__facts viewer-charge-totals">
            <div><dt>{sourceMode === "MANUAL" ? "Valor inicial" : "Valor das notas"}</dt><dd>{formatCurrencyBr(totalSource)}</dd></div>
            <div><dt>Pagamentos</dt><dd>{formatCurrencyBr(totalPayments)}</dd></div>
            <div><dt>{balance > 0 ? `Crédito ${role === "SUPPLIER" ? "do fornecedor" : "do cliente"}` : balance < 0 ? `Débito ${role === "SUPPLIER" ? "do fornecedor" : "do cliente"}` : "Saldo"}</dt><dd><Badge tone={balance > 0 ? "success" : balance < 0 ? "danger" : "neutral"}>{formatCurrencyBr(balance)}</Badge></dd></div>
          </dl>
          <footer className="viewer-invoice-editor__footer">
            <Button onClick={onClose}>Fechar</Button>
            <Button loading={busy} onClick={() => void save("DRAFT")}>Salvar rascunho</Button>
            <Button variant="primary" loading={busy} onClick={() => void save("COMPLETED")}>Concluir conferência</Button>
          </footer>
        </>}
      </div>
    </Drawer>
  );
}
