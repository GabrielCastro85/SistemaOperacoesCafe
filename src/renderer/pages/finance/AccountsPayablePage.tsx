import { useEffect, useMemo, useRef, useState } from "react";
import type { AccountPayable, PayablePaymentMethod } from "../../../shared/types/domain";
import { formatCurrencyFromCents, formatDateOnlyBr, parseCurrencyToCents } from "../../../shared/utils/format";
import { PageHeader } from "../../design-system";
import { requestTextInput } from "../../utils/dialogs";
import { buildExpenseControlHtml } from "./expenseControlPrint";
import { useFinanceData } from "./hooks/useFinanceData";
import type { FinancePageProps } from "./types";

// Contas a pagar (despesas gerais) numa tela so: lista com o que vence, lancar
// conta numa janela (com repeticao mensal ou parcelas) e pagar pela propria
// linha. Antes: assistente de 5 etapas, conta nascia como rascunho, e
// "Registrar pagamento" pagava sempre a primeira conta em aberto.

type Tab = "OPEN" | "OVERDUE" | "PAID" | "ALL";
type Repeat = "ONCE" | "MONTHLY" | "INSTALLMENTS";

const METHODS: Array<[PayablePaymentMethod, string]> = [
  ["BOLETO", "Boleto"], ["PIX", "PIX"], ["BANK_TRANSFER", "Transferência"], ["DIRECT_DEBIT", "Débito automático"],
  ["CARD", "Cartão"], ["CASH", "Dinheiro"], ["CHECK", "Cheque"], ["OTHER", "Outro"]
];
const methodLabel = (value: string) => METHODS.find(([key]) => key === value)?.[1] ?? value;

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T12:00:00`) - Date.parse(`${fromIso}T12:00:00`)) / 86_400_000);
}

const isClosed = (payable: AccountPayable) => payable.status === "PAID" || payable.status === "CANCELLED";
const openOf = (payable: AccountPayable) => Math.max(0, payable.openAmountCents ?? payable.finalAmountCents ?? 0);

interface NewForm { description: string; payee: string; amount: string; dueDate: string; categoryId: string; method: PayablePaymentMethod; pixKey: string; repeat: Repeat; installments: string; notes: string }
interface PayForm { payable: AccountPayable; amount: string; date: string; method: PayablePaymentMethod; accountId: string; notes: string }

export function AccountsPayablePage({ data }: FinancePageProps): JSX.Element {
  const { finance, organizationId, ownLegalEntityId, reload, loading, error: loadError } = useFinanceData(data);
  const today = todayIso();
  const [tab, setTab] = useState<Tab>("OPEN");
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emptyNew = (): NewForm => ({ description: "", payee: "", amount: "", dueDate: today, categoryId: "", method: "BOLETO", pixKey: "", repeat: "ONCE", installments: "2", notes: "" });
  const [newForm, setNewForm] = useState<NewForm | null>(null);
  const [payForm, setPayForm] = useState<PayForm | null>(null);

  // Contas mensais: ao abrir a tela, completa ate 3 meses a frente de cada uma
  // (o servidor nao repete um mes que ja existe). Assim os meses seguintes
  // aparecem sozinhos, sem precisar lancar de novo.
  const generatedRef = useRef(false);
  useEffect(() => {
    const templates = finance.recurring.filter((template) => template.isActive && template.autoGenerateOnOpen);
    if (generatedRef.current || !templates.length) return;
    generatedRef.current = true;
    void (async () => {
      // O servidor gera N meses DEPOIS do ultimo gerado: pede so o que falta
      // para chegar ate 2 meses a frente do mes atual (ex.: em novembro, ate janeiro).
      const now = new Date();
      const targetIndex = now.getFullYear() * 12 + now.getMonth() + 2;
      let created = 0;
      for (const template of templates) {
        const last = template.lastGeneratedCompetence;
        const lastIndex = last ? Number(last.slice(0, 4)) * 12 + Number(last.slice(5, 7)) - 1 : null;
        const missing = lastIndex === null ? 3 : Math.min(12, targetIndex - lastIndex);
        if (missing <= 0) continue;
        try { created += (await window.operationsCafe.generatePayableRecurringPeriod(template.id, missing)).length; } catch { /* segue com as outras */ }
      }
      if (created) await reload();
    })();
  }, [finance.recurring, reload]);

  const categoryName = useMemo(() => Object.fromEntries(finance.categories.map((category) => [category.id, category.name])), [finance.categories]);
  const live = finance.payables.filter((payable) => payable.status !== "CANCELLED" && payable.status !== "DRAFT");
  const overdue = live.filter((payable) => !isClosed(payable) && openOf(payable) > 0 && payable.dueDate < today);
  const dueToday = live.filter((payable) => !isClosed(payable) && openOf(payable) > 0 && payable.dueDate === today);
  const next7 = live.filter((payable) => !isClosed(payable) && openOf(payable) > 0 && payable.dueDate > today && payable.dueDate <= addDaysIso(today, 7));
  const monthPrefix = today.slice(0, 7);
  const paidThisMonth = finance.payments.filter((payment) => payment.status !== "CANCELLED" && payment.paymentDate.startsWith(monthPrefix)).reduce((sum, payment) => sum + payment.amountCents, 0);
  const sum = (list: AccountPayable[]) => list.reduce((total, payable) => total + openOf(payable), 0);
  const drafts = finance.payables.filter((payable) => payable.status === "DRAFT");

  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return finance.payables
      .filter((payable) => {
        if (tab === "OPEN") return payable.status !== "CANCELLED" && !isClosed(payable) && openOf(payable) > 0;
        if (tab === "OVERDUE") return !isClosed(payable) && openOf(payable) > 0 && payable.dueDate < today && payable.status !== "DRAFT";
        if (tab === "PAID") return payable.status === "PAID";
        return true;
      })
      .filter((payable) => !month || payable.dueDate.startsWith(month))
      .filter((payable) => !term || [payable.description, payable.payeeNameSnapshot, categoryName[payable.categoryId] ?? ""].some((text) => text.toLocaleLowerCase("pt-BR").includes(term)))
      .sort((left, right) => tab === "PAID" ? right.dueDate.localeCompare(left.dueDate) : left.dueDate.localeCompare(right.dueDate));
  }, [finance.payables, tab, month, search, today, categoryName]);

  const months = useMemo(() => [...new Set(finance.payables.map((payable) => payable.dueDate.slice(0, 7)))].sort(), [finance.payables]);
  const monthLabel = (value: string) => new Date(`${value}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  async function saveNew(): Promise<void> {
    if (!newForm) return;
    const amountCents = parseCurrencyToCents(newForm.amount || "0");
    if (!newForm.description.trim()) { setMessage("Informe o que é a conta (descrição)."); return; }
    if (!newForm.payee.trim()) { setMessage("Informe para quem é o pagamento (favorecido)."); return; }
    if (amountCents <= 0) { setMessage("Informe o valor da conta."); return; }
    if (!newForm.categoryId) { setMessage("Escolha a categoria."); return; }
    const count = Number(newForm.installments);
    if (newForm.repeat === "INSTALLMENTS" && (!Number.isInteger(count) || count < 2 || count > 120)) { setMessage("Informe o número de parcelas (2 a 120)."); return; }
    setBusy(true);
    setMessage(null);
    const base = { organizationId, ownLegalEntityId, supplierPartnerId: null, supplierLegalEntityId: null, payeeNameSnapshot: newForm.payee.trim(), categoryId: newForm.categoryId, defaultCostCenterId: null, defaultLocationId: null, description: newForm.description.trim() };
    try {
      if (newForm.repeat === "MONTHLY") {
        const template = await window.operationsCafe.createPayableRecurringTemplate({ ...base, amountMode: "FIXED", fixedAmountCents: amountCents, estimatedAmountCents: null, frequency: "MONTHLY", dueDay: Number(newForm.dueDate.slice(8, 10)), generationLeadDays: 7, startDate: `${newForm.dueDate.slice(0, 8)}01`, endDate: null, autoGenerateOnOpen: true, isActive: true });
        await window.operationsCafe.generatePayableRecurringPeriod(template.id, 3);
        setMessage(`Conta mensal "${base.description}" criada: os próximos 3 meses já estão na lista e os seguintes aparecem sozinhos.`);
      } else if (newForm.repeat === "INSTALLMENTS") {
        await window.operationsCafe.createPayableInstallmentGroup({ ...base, totalAmountCents: amountCents, installmentCount: count, firstDueDate: newForm.dueDate, intervalType: "MONTHLY" });
        setMessage(`"${base.description}" lançada em ${count} parcelas mensais.`);
      } else {
        const detail = await window.operationsCafe.createAccountPayableDraft({ ...base, payeeTaxIdSnapshot: null, source: "MANUAL", documentType: null, documentNumber: null, competenceDate: `${newForm.dueDate.slice(0, 8)}01`, issueDate: null, dueDate: newForm.dueDate, originalAmountCents: amountCents, discountCents: 0, interestCents: 0, penaltyCents: 0, otherAdditionsCents: 0, amountStatus: "CONFIRMED", plannedPaymentMethod: newForm.method, pixKey: newForm.method === "PIX" ? newForm.pixKey.trim() || null : null, notes: newForm.notes.trim() || null, internalNotes: null });
        await window.operationsCafe.confirmAccountPayable(detail.payable.id);
        setMessage(`Conta "${base.description}" lançada para ${formatDateOnlyBr(newForm.dueDate)}.`);
      }
      setNewForm(null);
      setTab("OPEN");
      await reload();
    } catch (error) {
      setMessage(`Erro: ${error instanceof Error ? error.message : "não foi possível lançar a conta."}`);
    } finally { setBusy(false); }
  }

  // Categoria nova direto na janela (ex.: "Salarios"), ja selecionada em seguida.
  async function createCategory(): Promise<void> {
    const name = (await requestTextInput({ title: "Nova categoria de despesa", label: "Nome da categoria (ex.: Salários, Combustível)", required: true }))?.trim();
    if (!name || !newForm) return;
    const existing = finance.categories.find((category) => category.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"));
    if (existing) { setNewForm({ ...newForm, categoryId: existing.id }); return; }
    try {
      const created = await window.operationsCafe.createExpenseCategory({ organizationId, parentCategoryId: null, name, code: null, expenseNature: /sal[aá]rio|pr[oó]-?labore|folha|funcion/i.test(name) ? "PERSONNEL" : /imposto|taxa|tributo/i.test(name) ? "TAX" : "OTHER", description: null, isActive: true });
      await reload();
      setNewForm((current) => current ? { ...current, categoryId: created.id } : current);
    } catch (error) { setMessage(`Erro: ${error instanceof Error ? error.message : "não foi possível criar a categoria."}`); }
  }

  async function savePayment(): Promise<void> {
    if (!payForm) return;
    const amountCents = parseCurrencyToCents(payForm.amount || "0");
    const open = openOf(payForm.payable);
    if (amountCents <= 0) { setMessage("Informe o valor pago."); return; }
    if (amountCents > open) { setMessage(`O valor pago é maior que o saldo da conta (${formatCurrencyFromCents(open)}).`); return; }
    setBusy(true);
    setMessage(null);
    try {
      const payment = await window.operationsCafe.createPayablePayment({ organizationId, ownLegalEntityId: payForm.payable.ownLegalEntityId || ownLegalEntityId, financialAccountId: payForm.accountId || null, paymentDate: payForm.date, amountCents, paymentMethod: payForm.method, transactionReference: null, payeeNameSnapshot: payForm.payable.payeeNameSnapshot, notes: payForm.notes.trim() || null, attachmentPath: null, attachmentHash: null });
      await window.operationsCafe.allocatePayablePayment({ payablePaymentId: payment.id, accountPayableId: payForm.payable.id, amountCents });
      setMessage(amountCents === open ? `"${payForm.payable.description}" paga.` : `Pagamento parcial registrado: falta ${formatCurrencyFromCents(open - amountCents)}.`);
      setPayForm(null);
      await reload();
    } catch (error) {
      setMessage(`Erro: ${error instanceof Error ? error.message : "não foi possível registrar o pagamento."}`);
    } finally { setBusy(false); }
  }

  // Folha "Controle de despesas" do mes (filtro de mes, ou o mes atual),
  // com as contas pagas marcadas como PAGO.
  function printControl(): void {
    const target = month || monthPrefix;
    const list = finance.payables.filter((payable) => payable.status !== "CANCELLED" && payable.status !== "DRAFT" && payable.dueDate.startsWith(target));
    const html = buildExpenseControlHtml(list.map((payable) => ({
      dueDate: payable.dueDate,
      // parcela vem na coluna propria (em roxo); tira o "1/3" repetido do nome
      description: payable.description.replace(/\s+\d+\/\d+$/, ""),
      payee: payable.payeeNameSnapshot,
      installment: payable.installmentNumber && payable.installmentCount ? `${payable.installmentNumber}/${payable.installmentCount}` : null,
      amountCents: payable.finalAmountCents ?? 0,
      paidCents: payable.paidAmountCents ?? 0,
      status: payable.status === "PAID" ? "PAID" : (payable.paidAmountCents ?? 0) > 0 ? "PARTIAL" : "OPEN",
      pixKey: payable.pixKey
    })), { title: `Controle de despesas ${monthLabel(target)}`, subtitle: `${monthLabel(target)} · impresso em ${formatDateOnlyBr(today)}` });
    const win = window.open("", "_blank");
    if (!win) { setMessage("O navegador bloqueou a janela de impressão. Permita pop-ups para o site e tente de novo."); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  async function cancel(payable: AccountPayable): Promise<void> {
    const reason = await requestTextInput({ title: `Cancelar "${payable.description}"`, label: "Motivo do cancelamento", required: true });
    if (!reason) return;
    try { await window.operationsCafe.cancelAccountPayable(payable.id, reason); setMessage("Conta cancelada."); await reload(); }
    catch (error) { setMessage(`Erro: ${error instanceof Error ? error.message : "não foi possível cancelar."}`); }
  }

  async function confirmDraft(payable: AccountPayable): Promise<void> {
    try { await window.operationsCafe.confirmAccountPayable(payable.id); await reload(); }
    catch (error) { setMessage(`Erro: ${error instanceof Error ? error.message : "não foi possível confirmar."}`); }
  }

  const situation = (payable: AccountPayable): { label: string; tone: string } => {
    if (payable.status === "CANCELLED") return { label: "Cancelada", tone: "muted" };
    if (payable.status === "PAID") return { label: "Paga", tone: "ok" };
    if (payable.status === "DRAFT") return { label: "Rascunho", tone: "muted" };
    if (payable.dueDate < today) { const late = daysBetween(payable.dueDate, today); return { label: `Atrasada ${late} dia${late === 1 ? "" : "s"}`, tone: "danger" }; }
    if (payable.dueDate === today) return { label: "Vence hoje", tone: "warn" };
    if (payable.status === "PARTIALLY_PAID") return { label: "Paga em parte", tone: "warn" };
    const days = daysBetween(today, payable.dueDate);
    return { label: days <= 7 ? `Vence em ${days} dia${days === 1 ? "" : "s"}` : "A pagar", tone: days <= 7 ? "soon" : "neutral" };
  };

  const summaryCard = (label: string, value: number, count: number | null, tone: string, onClick: () => void, active: boolean) => (
    <button type="button" className={`payables-summary__card payables-summary__card--${tone}${active ? " is-active" : ""}`} onClick={onClick}>
      <span>{label}</span>
      <strong>{formatCurrencyFromCents(value)}</strong>
      {count !== null ? <small>{count} conta{count === 1 ? "" : "s"}</small> : <small>pagamentos registrados</small>}
    </button>
  );

  return (
    <main className="content-section payables-page">
      <PageHeader eyebrow="Financeiro" title="Contas a pagar" description="Despesas da empresa: lance a conta, acompanhe o vencimento e registre o pagamento na própria linha." actions={<button type="button" className="primary" onClick={() => { setMessage(null); setNewForm(emptyNew()); }}>Nova conta</button>} />
      {message ? <div className="transfer-message" role="status">{message}</div> : null}
      {loadError ? <div className="transfer-message" role="alert">Não foi possível carregar as contas: {loadError}</div> : null}

      <section className="payables-summary" aria-label="Resumo">
        {summaryCard("Vencidas", sum(overdue), overdue.length, "danger", () => setTab("OVERDUE"), tab === "OVERDUE")}
        {summaryCard("Vencem hoje", sum(dueToday), dueToday.length, "warn", () => { setTab("OPEN"); setMonth(""); }, false)}
        {summaryCard("Próximos 7 dias", sum(next7), next7.length, "soon", () => { setTab("OPEN"); setMonth(""); }, false)}
        {summaryCard("Pago neste mês", paidThisMonth, null, "ok", () => { setTab("PAID"); setMonth(monthPrefix); }, tab === "PAID")}
      </section>

      {drafts.length ? <div className="payables-drafts">
        <strong>{drafts.length} conta{drafts.length === 1 ? "" : "s"} em rascunho</strong> (lançadas pelo jeito antigo e não confirmadas): {drafts.slice(0, 4).map((payable) => <button key={payable.id} type="button" onClick={() => void confirmDraft(payable)}>Confirmar "{payable.description}"</button>)}
      </div> : null}

      <div className="payables-toolbar">
        <div className="ui-tabs" role="tablist">
          {([["OPEN", "A pagar"], ["OVERDUE", "Vencidas"], ["PAID", "Pagas"], ["ALL", "Todas"]] as Array<[Tab, string]>).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}
        </div>
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por descrição, favorecido ou categoria" />
        <select value={month} onChange={(event) => setMonth(event.target.value)} aria-label="Mês do vencimento">
          <option value="">Todos os meses</option>
          {months.map((value) => <option key={value} value={value}>{monthLabel(value)}</option>)}
        </select>
        <button type="button" onClick={printControl}>Imprimir controle {month ? "do mês" : "deste mês"}</button>
      </div>

      <div className="payables-list">
        <div className="payables-row payables-row--head"><span>Vencimento</span><span>Conta</span><span>Categoria</span><span>Valor</span><span>Saldo</span><span>Situação</span><span /></div>
        {loading && !finance.payables.length ? <p className="muted payables-empty">Carregando contas...</p> : null}
        {!loading && !rows.length ? <p className="payables-empty">{tab === "OVERDUE" ? "Nenhuma conta vencida." : tab === "PAID" ? "Nenhuma conta paga nesse filtro." : "Nenhuma conta a pagar. Use “Nova conta” para lançar a primeira."}</p> : null}
        {rows.map((payable) => {
          const state = situation(payable);
          const open = openOf(payable);
          return <div key={payable.id} className={`payables-row payables-row--${state.tone}`}>
            <span data-label="Vencimento"><strong>{formatDateOnlyBr(payable.dueDate)}</strong></span>
            <span data-label="Conta"><strong>{payable.description}</strong><small>{payable.payeeNameSnapshot}{payable.installmentNumber && payable.installmentCount ? ` · parcela ${payable.installmentNumber}/${payable.installmentCount}` : ""}{payable.recurringTemplateId ? " · mensal" : ""}{payable.plannedPaymentMethod ? ` · ${methodLabel(payable.plannedPaymentMethod)}` : ""}</small></span>
            <span data-label="Categoria">{categoryName[payable.categoryId] ?? "—"}</span>
            <span data-label="Valor">{formatCurrencyFromCents(payable.finalAmountCents ?? 0)}</span>
            <span data-label="Saldo"><strong>{formatCurrencyFromCents(open)}</strong></span>
            <span data-label="Situação"><em className={`payables-badge payables-badge--${state.tone}`}>{state.label}</em></span>
            <span className="payables-actions">
              {!isClosed(payable) && payable.status !== "DRAFT" && open > 0 ? <button type="button" className="primary" onClick={() => { setMessage(null); setPayForm({ payable, amount: formatCurrencyFromCents(open).replace("R$", "").trim(), date: today, method: payable.plannedPaymentMethod ?? "PIX", accountId: finance.accounts[0]?.id ?? "", notes: "" }); }}>Pagar</button> : null}
              <button type="button" onClick={() => { window.location.hash = `#/finance/payables/${payable.id}`; }}>Detalhes</button>
              {!isClosed(payable) ? <button type="button" onClick={() => void cancel(payable)}>Cancelar</button> : null}
            </span>
          </div>;
        })}
      </div>

      {newForm ? <div className="partner-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setNewForm(null); }}>
        <section className="partner-modal payables-modal" role="dialog" aria-modal="true" aria-label="Nova conta a pagar">
          <header className="partner-modal__header"><div><span>Contas a pagar</span><strong>Nova conta</strong></div><button type="button" className="partner-modal__close" onClick={() => setNewForm(null)} aria-label="Fechar">x</button></header>
          <div className="partner-modal__body payables-form">
            <label className="payables-form__wide">O que é a conta<input autoFocus value={newForm.description} onChange={(event) => setNewForm({ ...newForm, description: event.target.value })} placeholder="Ex.: Energia elétrica do armazém" /></label>
            <label className="payables-form__wide">Para quem pagar (favorecido)<input value={newForm.payee} onChange={(event) => setNewForm({ ...newForm, payee: event.target.value })} placeholder="Ex.: Cemig" /></label>
            <label>{newForm.repeat === "INSTALLMENTS" ? "Valor total (R$)" : "Valor (R$)"}<input inputMode="decimal" value={newForm.amount} onChange={(event) => setNewForm({ ...newForm, amount: event.target.value })} placeholder="0,00" /></label>
            <label>{newForm.repeat === "ONCE" ? "Vencimento" : "Primeiro vencimento"}<input type="date" value={newForm.dueDate} onChange={(event) => setNewForm({ ...newForm, dueDate: event.target.value })} /></label>
            <label>Categoria<select value={newForm.categoryId} onChange={(event) => { if (event.target.value === "__new__") void createCategory(); else setNewForm({ ...newForm, categoryId: event.target.value }); }}><option value="">Escolha a categoria</option>{finance.categories.filter((category) => category.isActive).sort((left, right) => left.name.localeCompare(right.name, "pt-BR")).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}<option value="__new__">+ Nova categoria...</option></select></label>
            <label>Forma de pagamento<select value={newForm.method} onChange={(event) => setNewForm({ ...newForm, method: event.target.value as PayablePaymentMethod })}>{METHODS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            {newForm.method === "PIX" ? <label className="payables-form__wide">Chave PIX (opcional)<input value={newForm.pixKey} onChange={(event) => setNewForm({ ...newForm, pixKey: event.target.value })} /></label> : null}
            <fieldset className="payables-form__wide payables-repeat">
              <legend>Repetição</legend>
              {([["ONCE", "Só esta vez"], ["MONTHLY", "Todo mês (mesmo valor)"], ["INSTALLMENTS", "Parcelado"]] as Array<[Repeat, string]>).map(([key, label]) => <label key={key} className={`payables-repeat__option${newForm.repeat === key ? " is-on" : ""}`}><input type="radio" name="payables-repeat" checked={newForm.repeat === key} onChange={() => setNewForm({ ...newForm, repeat: key })} />{label}</label>)}
              {newForm.repeat === "INSTALLMENTS" ? <label className="payables-repeat__count">Número de parcelas<input inputMode="numeric" value={newForm.installments} onChange={(event) => setNewForm({ ...newForm, installments: event.target.value.replace(/\D/g, "") })} /></label> : null}
              <small>{newForm.repeat === "MONTHLY" ? "Lança os próximos 3 meses e continua gerando sozinho todo mês, no mesmo dia." : newForm.repeat === "INSTALLMENTS" ? "Divide o valor total em parcelas mensais a partir do primeiro vencimento." : "Uma conta só."}</small>
            </fieldset>
            {newForm.repeat === "ONCE" ? <label className="payables-form__wide">Observação (opcional)<input value={newForm.notes} onChange={(event) => setNewForm({ ...newForm, notes: event.target.value })} /></label> : null}
          </div>
          <footer className="partner-modal__footer"><button type="button" onClick={() => setNewForm(null)} disabled={busy}>Cancelar</button><button type="button" className="primary" disabled={busy} onClick={() => void saveNew()}>{busy ? "Lançando..." : "Lançar conta"}</button></footer>
        </section>
      </div> : null}

      {payForm ? <div className="partner-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setPayForm(null); }}>
        <section className="partner-modal payables-modal" role="dialog" aria-modal="true" aria-label="Registrar pagamento">
          <header className="partner-modal__header"><div><span>Registrar pagamento</span><strong>{payForm.payable.description}</strong></div><button type="button" className="partner-modal__close" onClick={() => setPayForm(null)} aria-label="Fechar">x</button></header>
          <div className="partner-modal__body payables-form">
            <p className="payables-form__wide payables-pay-info">{payForm.payable.payeeNameSnapshot} · vence {formatDateOnlyBr(payForm.payable.dueDate)} · saldo <strong>{formatCurrencyFromCents(openOf(payForm.payable))}</strong></p>
            <label>Valor pago (R$)<input autoFocus inputMode="decimal" value={payForm.amount} onChange={(event) => setPayForm({ ...payForm, amount: event.target.value })} /></label>
            <label>Data do pagamento<input type="date" value={payForm.date} onChange={(event) => setPayForm({ ...payForm, date: event.target.value })} /></label>
            <label>Forma de pagamento<select value={payForm.method} onChange={(event) => setPayForm({ ...payForm, method: event.target.value as PayablePaymentMethod })}>{METHODS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            {finance.accounts.length ? <label>Pago pela conta<select value={payForm.accountId} onChange={(event) => setPayForm({ ...payForm, accountId: event.target.value })}><option value="">Não informar</option>{finance.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label> : null}
            <label className="payables-form__wide">Observação (opcional)<input value={payForm.notes} onChange={(event) => setPayForm({ ...payForm, notes: event.target.value })} placeholder="Ex.: comprovante no WhatsApp" /></label>
            <small className="payables-form__wide muted">Pode pagar só uma parte: o saldo continua na lista até quitar.</small>
          </div>
          <footer className="partner-modal__footer"><button type="button" onClick={() => setPayForm(null)} disabled={busy}>Cancelar</button><button type="button" className="primary" disabled={busy} onClick={() => void savePayment()}>{busy ? "Registrando..." : "Registrar pagamento"}</button></footer>
        </section>
      </div> : null}
    </main>
  );
}
