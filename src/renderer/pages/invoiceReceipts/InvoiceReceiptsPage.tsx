import { useCallback, useEffect, useMemo, useState } from "react";
import type { BootstrapData, InvoiceReceiptDraft, InvoiceReceiptInvoice, InvoiceReceiptMode } from "../../../shared/types/domain";
import { formatCnpj, formatCurrencyFromCents, formatDateOnlyBr, parseCurrencyToCents } from "../../../shared/utils/format";
import { formatReceiptDocument, receiptCityLine, receiptSegments } from "../../../shared/utils/invoiceReceiptText";
import { PageHeader } from "../../design-system";

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function monthsAgoIso(months: number): string {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - months, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

// Recibo de pagamento no modelo padrao (Recibo de Pagamento DLG 652): escolhe
// as notas da empresa em operacao, confere os dados e gera o PDF.
export function InvoiceReceiptsPage({ data }: { data: BootstrapData }): JSX.Element {
  const ownLegalEntityId = data.profile?.defaultLegalEntityId ?? "";
  const ownName = data.legalEntities.find((entity) => entity.id === ownLegalEntityId)?.tradeName ?? "empresa em operação";
  const [mode, setMode] = useState<InvoiceReceiptMode>("SELLER");
  const [search, setSearch] = useState("");
  const [periodStart, setPeriodStart] = useState(monthsAgoIso(3));
  const [periodEnd, setPeriodEnd] = useState(todayIso());
  const [invoices, setInvoices] = useState<InvoiceReceiptInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<InvoiceReceiptDraft | null>(null);
  const [sacks, setSacks] = useState("");
  const [goods, setGoods] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(100);

  const load = useCallback(async () => {
    if (!ownLegalEntityId) return;
    setLoading(true);
    try {
      setInvoices(await window.operationsCafe.listInvoiceReceiptInvoices({ ownLegalEntityId, mode, search: search.trim() || null, periodStart: periodStart || null, periodEnd: periodEnd || null }));
    } catch (error) {
      setMessage(`Erro: ${error instanceof Error ? error.message : "falha ao listar as notas."}`);
    } finally { setLoading(false); }
  }, [ownLegalEntityId, mode, search, periodStart, periodEnd]);
  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer); }, [load]);
  useEffect(() => { setSelected([]); }, [mode, ownLegalEntityId]);
  useEffect(() => { setLimit(100); }, [mode, search, periodStart, periodEnd]);

  // Dados do recibo montados pelo servidor a partir das notas marcadas.
  useEffect(() => {
    if (!selected.length || !ownLegalEntityId) { setDraft(null); return; }
    let active = true;
    void window.operationsCafe.getInvoiceReceiptDraft({ ownLegalEntityId, fiscalDocumentIds: selected })
      .then((next) => {
        if (!active) return;
        setDraft(next);
        setSacks(next.sacks);
        setGoods(next.goodsDescription);
        setAmount(formatCurrencyFromCents(next.amountCents));
      })
      .catch((error: unknown) => { if (active) { setDraft(null); setMessage(`Erro: ${error instanceof Error ? error.message : "falha ao montar o recibo."}`); } });
    return () => { active = false; };
  }, [selected, ownLegalEntityId]);

  const amountCents = parseCurrencyToCents(amount || "0");
  const preview = useMemo(() => draft ? { ...draft, sacks: sacks.trim() || draft.sacks, goodsDescription: goods.trim() || draft.goodsDescription, amountCents, date } : null, [draft, sacks, goods, amountCents, date]);
  const allChecked = invoices.length > 0 && invoices.every((invoice) => selected.includes(invoice.fiscalDocumentId));

  function toggle(id: string, checked: boolean): void {
    setSelected((current) => checked ? [...current.filter((item) => item !== id), id] : current.filter((item) => item !== id));
  }

  async function generate(): Promise<void> {
    if (!preview || !draft) return;
    if (draft.problems.length) { setMessage(draft.problems[0]); return; }
    if (amountCents <= 0) { setMessage("Informe o valor recebido."); return; }
    setBusy(true);
    try {
      const saved = await window.operationsCafe.exportInvoiceReceiptPdf({ ownLegalEntityId, fiscalDocumentIds: selected, sacks: preview.sacks, goodsDescription: preview.goodsDescription, amountCents, date });
      if (saved) setMessage(`Recibo da NF ${draft.documentNumbers.join(", ")} gerado.`);
    } catch (error) {
      setMessage(`Erro: ${error instanceof Error ? error.message : "falha ao gerar o recibo."}`);
    } finally { setBusy(false); }
  }

  const counterpartyLabel = mode === "SELLER" ? "Comprador" : "Vendedor";
  return <main className="content-section invoice-receipt-page">
    <PageHeader eyebrow="Recebimentos" title="Recibos de pagamento" description={`Recibo no modelo padrão, gerado a partir das notas da ${ownName}.`} />
    {message ? <div className="transfer-message" role="status">{message}</div> : null}

    <section className="invoice-receipt-modes" role="radiogroup" aria-label="Tipo de recibo">
      <button type="button" role="radio" aria-checked={mode === "SELLER"} className={`invoice-receipt-mode${mode === "SELLER" ? " is-on" : ""}`} onClick={() => setMode("SELLER")}>
        <strong>Nós recebemos o pagamento</strong>
        <span>Notas emitidas pela {ownName} (venda). A {ownName} assina o recibo, com o logo.</span>
      </button>
      <button type="button" role="radio" aria-checked={mode === "BUYER"} className={`invoice-receipt-mode${mode === "BUYER" ? " is-on" : ""}`} onClick={() => setMode("BUYER")}>
        <strong>Nós pagamos</strong>
        <span>Notas emitidas para a {ownName} (compra). Quem assina é o vendedor; o recibo sai sem logo.</span>
      </button>
    </section>

    <div className="invoice-receipt-layout">
      <section className="invoice-receipt-notes">
        <div className="invoice-receipt-filters">
          <label>Buscar<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Número da nota, empresa ou CNPJ" /></label>
          <label>De<input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
          <label>Até<input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
        </div>
        <div className="invoice-receipt-table" role="table">
          <div className="invoice-receipt-row invoice-receipt-head" role="row">
            <span><input type="checkbox" aria-label="Marcar todas" checked={allChecked} disabled={!invoices.length} onChange={(event) => setSelected(event.target.checked ? invoices.map((invoice) => invoice.fiscalDocumentId) : [])} /></span>
            <span>Nota</span><span>Emissão</span><span>{counterpartyLabel}</span><span>Sacas</span><span>Valor</span>
          </div>
          {loading && !invoices.length ? <p className="muted invoice-receipt-empty">Carregando notas...</p> : null}
          {!loading && !invoices.length ? <p className="muted invoice-receipt-empty">Nenhuma nota {mode === "SELLER" ? "emitida pela" : "emitida para a"} {ownName} nesse período.</p> : null}
          {invoices.slice(0, limit).map((invoice) => {
            const checked = selected.includes(invoice.fiscalDocumentId);
            return <label key={invoice.fiscalDocumentId} className={`invoice-receipt-row${checked ? " is-on" : ""}`} role="row">
              <span><input type="checkbox" checked={checked} onChange={(event) => toggle(invoice.fiscalDocumentId, event.target.checked)} /></span>
              <span data-label="Nota"><strong>{invoice.documentNumber}</strong></span>
              <span data-label="Emissão">{formatDateOnlyBr(invoice.issueDate)}</span>
              <span data-label={counterpartyLabel}>{invoice.counterpartyName ?? "—"}{invoice.counterpartyDocument ? <small>{invoice.counterpartyDocument.replace(/\D/g, "").length === 14 ? formatCnpj(invoice.counterpartyDocument) : formatReceiptDocument(invoice.counterpartyDocument)}</small> : null}</span>
              <span data-label="Sacas">{invoice.sacks.replace(".", ",")}</span>
              <span data-label="Valor">{formatCurrencyFromCents(invoice.totalAmountCents)}</span>
            </label>;
          })}
        </div>
        {invoices.length > limit ? <button type="button" onClick={() => setLimit((value) => value + 100)}>Mostrar mais notas ({invoices.length - limit} restantes)</button> : null}
      </section>

      <aside className="invoice-receipt-side">
        {!draft ? <div className="invoice-receipt-placeholder">
          <strong>Marque uma ou mais notas</strong>
          <span>Notas do mesmo vendedor e comprador entram num recibo só, com a soma dos valores.</span>
        </div> : <>
          {draft.problems.length ? <div className="invoice-receipt-problems">{draft.problems.map((problem) => <p key={problem}>{problem}</p>)}</div> : null}
          <div className="invoice-receipt-fields">
            <label>Valor recebido (R$)<input value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
            <label>Data do recibo<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <label>Sacas<input value={sacks} onChange={(event) => setSacks(event.target.value)} /></label>
            <label>Mercadoria<input value={goods} onChange={(event) => setGoods(event.target.value)} /></label>
          </div>
          {preview ? <article className="invoice-receipt-paper" aria-label="Prévia do recibo">
            <h3>RECIBO DE PAGAMENTO</h3>
            <p>{receiptSegments(preview).map((segment, index) => segment.bold ? <strong key={index}>{segment.text}</strong> : <span key={index}>{segment.text}</span>)}</p>
            <p className="invoice-receipt-paper__city">{receiptCityLine(preview)}</p>
            <div className="invoice-receipt-paper__sign">
              <span className="invoice-receipt-paper__line" />
              <strong>{preview.seller.name.toLocaleUpperCase("pt-BR")}</strong>
              <small>{preview.seller.isOwn ? "Logo da empresa abaixo do nome" : "Assinatura do vendedor (sem logo)"}</small>
            </div>
          </article> : null}
          <button type="button" className="primary" disabled={busy || Boolean(draft.problems.length) || amountCents <= 0} onClick={() => void generate()}>{busy ? "Gerando..." : "Gerar PDF do recibo"}</button>
        </>}
      </aside>
    </div>
  </main>;
}
