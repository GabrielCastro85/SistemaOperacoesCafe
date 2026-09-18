import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { BootstrapData, BusinessPartner, TransferReconciliation, TransferReconciliationAvailableInvoice, TransferReconciliationClientBalance } from "../../../shared/types/domain";
import { formatCurrencyFromCents, formatDateOnlyBr, parseCurrencyToCents } from "../../../shared/utils/format";
import { PageHeader } from "../../design-system";

type PaymentDraft = { id?: string; beneficiaryName: string; beneficiaryDocument: string; description: string; paymentDate: string; amount: string; notes: string };

const today = (): string => new Date().toISOString().slice(0, 10);
const emptyPayment = (): PaymentDraft => ({ beneficiaryName: "", beneficiaryDocument: "", description: "", paymentDate: today(), amount: "", notes: "" });

export function TransferReconciliationsPage({ data }: { data: BootstrapData }): JSX.Element {
  const organizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "";
  const [tab, setTab] = useState<"LIST" | "BALANCES">("LIST");
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [history, setHistory] = useState<TransferReconciliation[]>([]);
  const [balances, setBalances] = useState<TransferReconciliationClientBalance[]>([]);
  const [editing, setEditing] = useState(false);
  const [editorStep, setEditorStep] = useState<"INVOICES" | "PAYMENTS">("INVOICES");
  const [id, setId] = useState<string>();
  const [clientId, setClientId] = useState("");
  const [referenceDate, setReferenceDate] = useState(today());
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [invoices, setInvoices] = useState<TransferReconciliationAvailableInvoice[]>([]);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceLimit, setInvoiceLimit] = useState(10);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [payments, setPayments] = useState<PaymentDraft[]>([emptyPayment()]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!organizationId) return;
    // A lista de clientes e' essencial para iniciar uma conferencia. Ela deve
    // continuar disponivel mesmo se o historico ou o resumo ainda estiverem
    // aguardando a primeira sincronizacao/migracao neste computador.
    try {
      setPartners(await window.operationsCafe.listBusinessPartners({ role: "CLIENT", status: "active" }));
    } catch (error) {
      setPartners([]);
      setMessage(`Não foi possível carregar os clientes: ${error instanceof Error ? error.message : "falha inesperada"}`);
    }
    const [rowsResult, balancesResult] = await Promise.allSettled([
      window.operationsCafe.listTransferReconciliations({ organizationId, status: "ALL" }),
      window.operationsCafe.listTransferReconciliationClientBalances(organizationId)
    ]);
    if (rowsResult.status === "fulfilled") setHistory(rowsResult.value);
    if (balancesResult.status === "fulfilled") setBalances(balancesResult.value);
    const failure = rowsResult.status === "rejected" ? rowsResult.reason : balancesResult.status === "rejected" ? balancesResult.reason : null;
    if (failure) setMessage(`Clientes carregados, mas parte das conferências ainda não pôde ser consultada: ${failure instanceof Error ? failure.message : "falha inesperada"}`);
  }, [organizationId]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!clientId || !editing) { setInvoices([]); return; }
    let active = true;
    setLoadingInvoices(true);
    setMessage(null);
    void window.operationsCafe.listTransferReconciliationInvoices({ organizationId, clientPartnerId: clientId, reconciliationId: id })
      .then((rows) => {
        if (!active) return;
        setInvoices((Array.isArray(rows) ? rows : []).filter((row) => row && typeof row.fiscalDocumentId === "string").map((row) => ({
          ...row,
          documentNumber: String(row.documentNumber ?? ""), issueDate: String(row.issueDate ?? ""),
          invoiceTotalCents: Number.isFinite(Number(row.invoiceTotalCents)) ? Number(row.invoiceTotalCents) : 0,
          previouslyUsedCents: Number.isFinite(Number(row.previouslyUsedCents)) ? Number(row.previouslyUsedCents) : 0,
          availableCents: Number.isFinite(Number(row.availableCents)) ? Number(row.availableCents) : 0
        })));
      })
      .catch((error: unknown) => { if (active) { setInvoices([]); setMessage(`Não foi possível carregar as notas: ${error instanceof Error ? error.message : "falha inesperada"}`); } })
      .finally(() => { if (active) setLoadingInvoices(false); });
    return () => { active = false; };
  }, [clientId, editing, id, organizationId]);

  const totalSource = useMemo(() => Object.values(selected).reduce((sum, value) => sum + Math.max(0, parseCurrencyToCents(value || "0")), 0), [selected]);
  const totalPayments = useMemo(() => payments.reduce((sum, item) => sum + Math.max(0, parseCurrencyToCents(item.amount || "0")), 0), [payments]);
  const balance = totalSource - totalPayments;
  const filteredInvoices = useMemo(() => {
    const term = invoiceSearch.trim().toLocaleLowerCase("pt-BR");
    const rows = term ? invoices.filter((invoice) => [invoice.documentNumber, invoice.issuerName, invoice.recipientName, invoice.issueDate].some((value) => String(value ?? "").toLocaleLowerCase("pt-BR").includes(term))) : invoices;
    return rows.slice(0, invoiceLimit);
  }, [invoiceLimit, invoiceSearch, invoices]);
  const selectedInvoices = useMemo(() => invoices.filter((invoice) => invoice.fiscalDocumentId in selected), [invoices, selected]);

  function startNew(): void {
    setId(undefined); setClientId(""); setReferenceDate(today()); setTitle(""); setNotes(""); setSelected({}); setPayments([emptyPayment()]); setInvoiceSearch(""); setInvoiceLimit(10); setMessage(null); setEditorStep("INVOICES"); setEditing(true);
  }

  async function open(row: TransferReconciliation): Promise<void> {
    setBusy(true);
    try {
      const detail = await window.operationsCafe.getTransferReconciliation(row.id);
      setId(row.id); setClientId(row.clientPartnerId); setReferenceDate(row.referenceDate); setTitle(row.title ?? ""); setNotes(row.notes ?? "");
      setSelected(Object.fromEntries(detail.invoices.map((item) => [item.fiscalDocumentId, (item.sourceAmountCents / 100).toFixed(2).replace(".", ",")])));
      setPayments(detail.payments.length ? detail.payments.map((item) => ({ id: item.id, beneficiaryName: item.beneficiaryName, beneficiaryDocument: item.beneficiaryDocument ?? "", description: item.description ?? "", paymentDate: item.paymentDate ?? "", amount: (item.amountCents / 100).toFixed(2).replace(".", ","), notes: item.notes ?? "" })) : [emptyPayment()]);
      setEditorStep("PAYMENTS"); setEditing(true);
    } finally { setBusy(false); }
  }

  async function save(status: "DRAFT" | "COMPLETED"): Promise<void> {
    setMessage(null);
    const invoiceRows = Object.entries(selected).filter(([, value]) => parseCurrencyToCents(value || "0") > 0).map(([fiscalDocumentId, value]) => ({ fiscalDocumentId, sourceAmountCents: parseCurrencyToCents(value) }));
    const paymentRows = payments.filter((item) => item.beneficiaryName.trim() || parseCurrencyToCents(item.amount || "0") > 0).map((item) => ({ ...item, amountCents: parseCurrencyToCents(item.amount), beneficiaryDocument: item.beneficiaryDocument || null, description: item.description || null, paymentDate: item.paymentDate || null, notes: item.notes || null }));
    if (!clientId) { setMessage("Selecione o cliente."); return; }
    if (!invoiceRows.length) { setMessage("Selecione pelo menos uma nota e informe o valor usado."); return; }
    if (paymentRows.some((item) => !item.beneficiaryName.trim() || item.amountCents <= 0)) { setMessage("Preencha o favorecido e o valor de cada pagamento."); return; }
    setBusy(true);
    try {
      await window.operationsCafe.saveTransferReconciliation({ id, organizationId, clientPartnerId: clientId, referenceDate, title: title || null, notes: notes || null, status, invoices: invoiceRows, payments: paymentRows });
      await refresh(); setEditing(false); setMessage(status === "COMPLETED" ? "Conferência concluída." : "Rascunho salvo.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }

  function continueToPayments(): void {
    setMessage(null);
    if (!clientId) { setMessage("Selecione o cliente."); return; }
    if (!selectedInvoices.length || totalSource <= 0) { setMessage("Selecione pelo menos uma nota e informe o valor usado."); return; }
    const invalid = selectedInvoices.find((invoice) => {
      const used = parseCurrencyToCents(selected[invoice.fiscalDocumentId] || "0");
      return used <= 0 || used > invoice.availableCents;
    });
    if (invalid) { setMessage(`Confira o valor usado na nota ${invalid.documentNumber}. Ele deve ser maior que zero e não pode ultrapassar o disponível.`); return; }
    setEditorStep("PAYMENTS");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function cancel(rowId: string): Promise<void> {
    if (!window.confirm("Cancelar esta conferência? Ela deixará de compor o saldo do cliente.")) return;
    await window.operationsCafe.cancelTransferReconciliation(rowId); await refresh();
  }

  async function remove(row: TransferReconciliation): Promise<void> {
    if (!window.confirm(`Excluir definitivamente esta conferência de ${row.clientName}? Os valores usados voltarão a ficar disponíveis nas respectivas notas.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      await window.operationsCafe.deleteTransferReconciliation(row.id);
      await refresh();
      setMessage("Conferência excluída. Os valores das notas voltaram a ficar disponíveis.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível excluir a conferência."); }
    finally { setBusy(false); }
  }

  if (editing) return <main className="content-section transfer-page">
    <PageHeader eyebrow="Recebimentos" title={id ? "Editar conferência de repasse" : "Nova conferência de repasse"} description="Ferramenta de conferência. Este lançamento não altera cobranças, contas a receber ou o financeiro." actions={<button onClick={() => setEditing(false)}>Voltar</button>} />
    {message && <div className="transfer-message">{message}</div>}
    <div className="transfer-steps" aria-label="Etapas da conferência">
      <button className={editorStep === "INVOICES" ? "active" : "complete"} onClick={() => setEditorStep("INVOICES")}><span>1</span> Selecionar notas</button>
      <button className={editorStep === "PAYMENTS" ? "active" : ""} disabled={editorStep === "INVOICES"} onClick={() => setEditorStep("PAYMENTS")}><span>2</span> Informar pagamentos</button>
    </div>
    <div className="transfer-editor">
      <section className="transfer-form">
        <div className="transfer-fields">
          <label>Cliente<select value={clientId} disabled={Boolean(id)} onChange={(event) => { setClientId(event.target.value); setSelected({}); setInvoices([]); setInvoiceSearch(""); setInvoiceLimit(10); }}><option value="">Selecione</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.displayName}</option>)}</select></label>
          <label>Data de referência<input type="date" value={referenceDate} onChange={(event) => setReferenceDate(event.target.value)} /></label>
          <label>Título<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Repasse de setembro" /></label>
        </div>
        {editorStep === "INVOICES" ? <>
        <div className="transfer-section-title transfer-invoice-title"><div><h2>Selecione as notas fiscais</h2><p className="muted">Marque as notas que fazem parte deste repasse. Na próxima etapa você informará os pagamentos.</p></div><div className="transfer-invoice-title-actions">{selectedInvoices.length > 0 && <strong>{selectedInvoices.length} nota(s) selecionada(s)</strong>}<button className="primary" disabled={!selectedInvoices.length || loadingInvoices} onClick={continueToPayments}>Continuar para pagamentos</button></div></div>
        {!clientId ? <p className="muted">Selecione um cliente para listar as notas.</p> : loadingInvoices ? <div className="transfer-inline-loading">Carregando notas do cliente…</div> : invoices.length === 0 ? <div className="transfer-empty">Nenhuma nota de venda foi encontrada para este cliente.</div> : <>
          <div className="transfer-invoice-toolbar"><input type="search" value={invoiceSearch} onChange={(event) => { setInvoiceSearch(event.target.value); setInvoiceLimit(10); }} placeholder="Pesquisar por número, emitente, destinatário ou data" /><span>{invoices.length} nota(s) encontrada(s)</span></div>
          <div className="transfer-table">
          <div className="transfer-row transfer-head"><span></span><span>Nota</span><span>Emissão</span><span>Destinatário</span><span>Valor da nota</span><span>Disponível</span><span>Valor nesta conferência</span></div>
          {filteredInvoices.map((invoice) => { const checked = invoice.fiscalDocumentId in selected; const used = parseCurrencyToCents(selected[invoice.fiscalDocumentId] || "0"); return <div className={`transfer-row ${used > invoice.availableCents ? "transfer-warning" : ""}`} key={invoice.fiscalDocumentId}>
            <span><input type="checkbox" checked={checked} onChange={(event) => setSelected((current) => { const next = { ...current }; if (event.target.checked) next[invoice.fiscalDocumentId] = (Math.max(0, invoice.availableCents) / 100).toFixed(2).replace(".", ","); else delete next[invoice.fiscalDocumentId]; return next; })} /></span>
            <span>{invoice.documentNumber}</span><span>{formatDateOnlyBr(invoice.issueDate)}</span><span>{invoice.recipientName ?? "—"}</span><span>{formatCurrencyFromCents(invoice.invoiceTotalCents)}</span><span>{formatCurrencyFromCents(invoice.availableCents)}</span>
            <span>{checked ? <input value={selected[invoice.fiscalDocumentId]} onChange={(event) => setSelected((current) => ({ ...current, [invoice.fiscalDocumentId]: event.target.value }))} /> : "—"}{used > invoice.availableCents && <small> Acima do saldo disponível</small>}</span>
          </div>; })}
          </div>
          {filteredInvoices.length < (invoiceSearch ? invoices.filter((invoice) => [invoice.documentNumber, invoice.issuerName, invoice.recipientName, invoice.issueDate].some((value) => String(value ?? "").toLocaleLowerCase("pt-BR").includes(invoiceSearch.trim().toLocaleLowerCase("pt-BR")))).length : invoices.length) && <button onClick={() => setInvoiceLimit((value) => value + 10)}>Mostrar mais notas</button>}
        </>}
        </> : <>
        <div className="transfer-selected-summary">
          <div className="transfer-section-title"><div><h2>Notas selecionadas</h2><p className="muted">A lista completa ficou recolhida para facilitar o lançamento dos pagamentos.</p></div><button onClick={() => setEditorStep("INVOICES")}>Alterar notas</button></div>
          <div className="transfer-selected-list">{selectedInvoices.map((invoice) => <article key={invoice.fiscalDocumentId}><div><strong>Nota {invoice.documentNumber}</strong><small>{formatDateOnlyBr(invoice.issueDate)} · {invoice.recipientName ?? "Destinatário não informado"}</small></div><strong>{formatCurrencyFromCents(parseCurrencyToCents(selected[invoice.fiscalDocumentId] || "0"))}</strong></article>)}</div>
        </div>
        <div className="transfer-section-title"><h2>Pagamentos da lista</h2><button onClick={() => setPayments((rows) => [...rows, emptyPayment()])}>Adicionar pagamento</button></div>
        <div className="transfer-payments">{payments.map((payment, index) => <div className="transfer-payment" key={payment.id ?? index}>
          <label>Favorecido<input value={payment.beneficiaryName} onChange={(event) => setPayments((rows) => rows.map((row, i) => i === index ? { ...row, beneficiaryName: event.target.value } : row))} /></label>
          <label>CPF/CNPJ<input value={payment.beneficiaryDocument} onChange={(event) => setPayments((rows) => rows.map((row, i) => i === index ? { ...row, beneficiaryDocument: event.target.value } : row))} /></label>
          <label>Descrição<input value={payment.description} onChange={(event) => setPayments((rows) => rows.map((row, i) => i === index ? { ...row, description: event.target.value } : row))} /></label>
          <label>Data<input type="date" value={payment.paymentDate} onChange={(event) => setPayments((rows) => rows.map((row, i) => i === index ? { ...row, paymentDate: event.target.value } : row))} /></label>
          <label>Valor<input value={payment.amount} onChange={(event) => setPayments((rows) => rows.map((row, i) => i === index ? { ...row, amount: event.target.value } : row))} /></label>
          <label>Observação<input value={payment.notes} onChange={(event) => setPayments((rows) => rows.map((row, i) => i === index ? { ...row, notes: event.target.value } : row))} /></label>
          <button className="danger-action" onClick={() => setPayments((rows) => rows.length === 1 ? [emptyPayment()] : rows.filter((_, i) => i !== index))}>Remover</button>
        </div>)}</div>
        <label className="transfer-notes">Observações gerais (opcional)<textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Inclua alguma observação se desejar." /></label>
        </>}
      </section>
      <aside className={`transfer-summary ${balance > 0 ? "is-credit" : balance < 0 ? "is-debit" : "is-balanced"}`}>
        <small>VALOR DAS NOTAS</small><strong>{formatCurrencyFromCents(totalSource)}</strong>
        <small>PAGAMENTOS INFORMADOS</small><strong>{formatCurrencyFromCents(totalPayments)}</strong>
        <small>{balance > 0 ? "CRÉDITO DO CLIENTE" : balance < 0 ? "DÉBITO DO CLIENTE" : "SALDO"}</small><strong>{formatCurrencyFromCents(balance)}</strong>
        {editorStep === "PAYMENTS" && <div className="transfer-actions"><button disabled={busy} onClick={() => void save("DRAFT")}>Salvar rascunho</button><button className="primary" disabled={busy} onClick={() => void save("COMPLETED")}>Concluir conferência</button></div>}
      </aside>
    </div>
  </main>;

  return <main className="content-section transfer-page">
    <PageHeader eyebrow="Recebimentos" title="Conferência de repasses" description="Confira listas de pagamentos contra o valor das notas sem gerar cobrança ou movimentação financeira." actions={<button className="primary" onClick={startNew}>Nova conferência</button>} />
    {message && <div className="transfer-message">{message}</div>}
    <div className="settings-tabs"><button className={tab === "LIST" ? "active" : ""} onClick={() => setTab("LIST")}>Conferências</button><button className={tab === "BALANCES" ? "active" : ""} onClick={() => setTab("BALANCES")}>Saldos por cliente</button></div>
    {tab === "LIST" ? <div className="transfer-history">
      {history.length === 0 ? <p>Nenhuma conferência registrada.</p> : history.map((row) => <article key={row.id}>
        <div><strong>{row.clientName}</strong><small>{row.title || `Conferência de ${formatDateOnlyBr(row.referenceDate)}`}</small></div>
        <span>{row.status === "DRAFT" ? "Rascunho" : row.status === "COMPLETED" ? "Concluída" : "Cancelada"}</span>
        <span>Notas: <b>{formatCurrencyFromCents(row.totalSourceCents)}</b></span><span>Pagamentos: <b>{formatCurrencyFromCents(row.totalPaymentsCents)}</b></span>
        <span className={row.balanceCents > 0 ? "credit" : row.balanceCents < 0 ? "debit" : ""}>Saldo: <b>{formatCurrencyFromCents(row.balanceCents)}</b></span>
        <div><button disabled={busy || row.status === "CANCELLED"} onClick={() => void open(row)}>{row.status === "CANCELLED" ? "Cancelada" : "Editar"}</button>{row.status !== "CANCELLED" && <button className="danger-action" disabled={busy} onClick={() => void cancel(row.id)}>Cancelar</button>}<button className="danger-action" disabled={busy} onClick={() => void remove(row)}>Excluir</button></div>
      </article>)}
    </div> : <div className="transfer-balances"><div className="transfer-balance-row head"><span>Cliente</span><span>Crédito</span><span>Débito</span><span>Saldo líquido</span><span>Rascunhos</span></div>{balances.map((row) => <div className="transfer-balance-row" key={row.clientPartnerId}><strong>{row.clientName}</strong><span className="credit">{formatCurrencyFromCents(row.creditCents)}</span><span className="debit">{formatCurrencyFromCents(row.debitCents)}</span><strong className={row.netBalanceCents >= 0 ? "credit" : "debit"}>{formatCurrencyFromCents(row.netBalanceCents)}</strong><span>{row.openReconciliations}</span></div>)}</div>}
  </main>;
}
