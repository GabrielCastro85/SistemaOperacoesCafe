import React, { useCallback, useEffect, useState } from "react";
import type { BillingPeriodicity, BillingSummary, BootstrapData, BusinessPartner, ClientCharge, ClientChargeDetail, Operation, PartnerRateSummaryRow } from "../../../shared/types/domain";
import { formatCurrencyFromCents, parseCurrencyToCents } from "../../../shared/utils/format";
import { EmptyState, PageHeader, Tabs } from "../../design-system";
import { Feedback } from "../../components/feedback/Feedback";
import { SelectField, TextField } from "../../components/forms/LegacyFields";
import { AdminBlock, FormGrid } from "../../components/layout/SectionPrimitives";
import { requestTextInput } from "../../utils/dialogs";

function decimalTextBr(value: string | null | undefined): string {
  return value ? value.replace(".", ",") : "0";
}

const PERIODICITY_ITEMS: Array<{ id: BillingPeriodicity; label: string }> = [
  { id: "WEEKLY", label: "Semanal" },
  { id: "MONTHLY", label: "Mensal" },
  { id: "QUARTERLY", label: "Trimestral" }
];

export function ChargesPage({ data }: { data: BootstrapData }): JSX.Element {
  const organizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "";
  const ownLegalEntityId = data.profile?.defaultLegalEntityId ?? data.legalEntities.find((item) => item.organizationId === organizationId)?.id ?? "";
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [charges, setCharges] = useState<ClientCharge[]>([]);
  const [eligible, setEligible] = useState<Operation[]>([]);
  const [detail, setDetail] = useState<ClientChargeDetail | null>(null);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [partnerSummary, setPartnerSummary] = useState<PartnerRateSummaryRow[]>([]);
  const [includeAlreadyBilled, setIncludeAlreadyBilled] = useState(false);
  const [clientId, setClientId] = useState("");
  const [periodicity, setPeriodicity] = useState<BillingPeriodicity>("MONTHLY");
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().slice(0, 8) + "01");
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [advanceInput, setAdvanceInput] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [surchargeInput, setSurchargeInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [searchedOperations, setSearchedOperations] = useState(false);

  const load = useCallback(async () => {
    const clients = await window.operationsCafe.listBusinessPartners({ organizationId, role: "CLIENT", status: "active" });
    setPartners(clients);
    setClientId((current) => current || clients[0]?.id || "");
    setCharges(await window.operationsCafe.listClientCharges({ organizationId, status: "all" }));
    setSummary(await window.operationsCafe.getBillingSummary(organizationId));
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setEligible([]); setSearchedOperations(false); }, [clientId]);

  const loadPartnerSummary = useCallback(async () => {
    if (!ownLegalEntityId) return;
    setPartnerSummary(await window.operationsCafe.getPartnerRateSummary({ organizationId, ownLegalEntityId, periodStart, periodEnd, includeAlreadyBilled }));
  }, [organizationId, ownLegalEntityId, periodStart, periodEnd, includeAlreadyBilled]);

  useEffect(() => { void loadPartnerSummary(); }, [loadPartnerSummary]);

  async function suggestPeriod(): Promise<void> {
    if (!clientId || !ownLegalEntityId) { setMessage("Selecione um cliente antes de sugerir o periodo."); return; }
    const [period] = await window.operationsCafe.suggestChargePeriods({ organizationId, ownLegalEntityId, clientPartnerId: clientId, periodicity, referenceDate: periodEnd });
    if (period) { setPeriodStart(period.periodStart); setPeriodEnd(period.periodEnd); setMessage(`Periodo sugerido: ${period.label}`); }
    else setMessage("Nao foi possivel sugerir um periodo para esse cliente.");
  }

  async function findOperations(): Promise<void> {
    const found = await window.operationsCafe.findEligibleChargeOperations({ organizationId, ownLegalEntityId, clientPartnerId: clientId, periodStart, periodEnd });
    setEligible(found);
    setSearchedOperations(true);
    setMessage(found.length > 0 ? `${found.length} operacao(oes) elegivel(is) encontrada(s) no periodo.` : "Nenhuma operacao elegivel encontrada nesse periodo para esse cliente.");
  }

  async function createDraft(): Promise<void> {
    try {
      const draft = await window.operationsCafe.createClientChargeDraft({ organizationId, ownLegalEntityId, clientPartnerId: clientId, billingProfileId: null, periodicity, periodStart, periodEnd, dueDate, notes: null, internalNotes: null, operationIds: eligible.map((item) => item.id) });
      setDetail(draft);
      setMessage("Rascunho gerado e operacoes reservadas.");
      await load();
      await loadPartnerSummary();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao gerar cobranca."}`);
    }
  }

  async function generateDraftForPartner(row: PartnerRateSummaryRow): Promise<void> {
    try {
      const operations = await window.operationsCafe.findEligibleChargeOperations({ organizationId, ownLegalEntityId, clientPartnerId: row.partnerId, periodStart, periodEnd });
      if (operations.length === 0) { setMessage(`Nenhuma operacao em aberto para ${row.partnerDisplayName} no periodo.`); return; }
      const draft = await window.operationsCafe.createClientChargeDraft({ organizationId, ownLegalEntityId, clientPartnerId: row.partnerId, billingProfileId: null, periodicity, periodStart, periodEnd, dueDate, notes: null, internalNotes: null, operationIds: operations.map((item) => item.id) });
      setClientId(row.partnerId);
      setDetail(draft);
      setMessage(`Rascunho gerado para ${row.partnerDisplayName}.`);
      await load();
      await loadPartnerSummary();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao gerar rascunho."}`);
    }
  }

  async function issue(): Promise<void> {
    if (!detail) return;
    const issued = await window.operationsCafe.issueClientCharge(detail.charge.id);
    setDetail(issued);
    setMessage("Cobranca emitida com documentos.");
    await load();
  }

  async function applyAdjustments(): Promise<void> {
    if (!detail) return;
    let current = detail;
    const advanceCents = Math.round(Number(advanceInput.replace(",", ".") || "0") * 100);
    const discountCents = Math.round(Number(discountInput.replace(",", ".") || "0") * 100);
    const surchargeCents = Math.round(Number(surchargeInput.replace(",", ".") || "0") * 100);
    if (advanceCents > 0) {
      current = await window.operationsCafe.addChargeAdjustment({ clientChargeId: current.charge.id, ledgerEntryId: null, adjustmentType: "ADVANCE", effect: "REDUCE_RECEIVABLE", description: "Adiantamento", amountCents: advanceCents, sortOrder: 10, reason: "Ajuste manual" });
    }
    if (discountCents > 0) {
      current = await window.operationsCafe.addChargeAdjustment({ clientChargeId: current.charge.id, ledgerEntryId: null, adjustmentType: "DISCOUNT", effect: "REDUCE_RECEIVABLE", description: "Desconto", amountCents: discountCents, sortOrder: 20, reason: "Ajuste manual" });
    }
    if (surchargeCents > 0) {
      current = await window.operationsCafe.addChargeAdjustment({ clientChargeId: current.charge.id, ledgerEntryId: null, adjustmentType: "SURCHARGE", effect: "INCREASE_RECEIVABLE", description: "Acrescimo", amountCents: surchargeCents, sortOrder: 30, reason: "Ajuste manual" });
    }
    setDetail(current);
    setAdvanceInput("");
    setDiscountInput("");
    setSurchargeInput("");
  }

  async function registerPayment(): Promise<void> {
    if (!detail) return;
    const value = await requestTextInput({ title: "Registrar recebimento", label: "Valor recebido (R$)" });
    if (!value) return;
    const amountCents = parseCurrencyToCents(value);
    const payment = await window.operationsCafe.createClientPayment({ organizationId, ownLegalEntityId, clientPartnerId: detail.charge.clientPartnerId, paymentDate: new Date().toISOString().slice(0, 10), amountCents, paymentMethod: "PIX", bankAccountDescription: null, transactionReference: null, notes: null, attachmentPath: null });
    setDetail(await window.operationsCafe.allocateClientPayment({ clientPaymentId: payment.id, clientChargeId: detail.charge.id, amountCents }));
    await load();
  }

  async function openDocument(kind: "pdf" | "excel" | "image"): Promise<void> {
    if (!detail) return;
    try {
      await window.operationsCafe.openChargeDocument({ chargeId: detail.charge.id, kind });
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao abrir documento."}`);
    }
  }

  return (
    <section className="content-section settings">
      <PageHeader eyebrow="Cobrancas" title="Cobranca por periodo" description="Fechamentos semanais, mensais e trimestrais por cliente, com ajustes e documentos prontos." />
      <div className="cards">
        <article><span>Total a receber</span><strong>{formatCurrencyFromCents(summary?.openCents ?? 0)}</strong></article>
        <article><span>Recebido</span><strong>{formatCurrencyFromCents(summary?.receivedCents ?? 0)}</strong></article>
        <article><span>Creditos</span><strong>{formatCurrencyFromCents(summary?.availableCreditsCents ?? 0)}</strong></article>
        <article><span>Operacoes nao cobradas</span><strong>{summary?.unbilledOperations ?? 0}</strong></article>
      </div>

      <AdminBlock title="Gerar cobranca">
        <FormGrid>
          <SelectField label="Cliente" value={clientId} onChange={setClientId} options={partners.map((item) => [item.id, item.displayName])} />
          <TextField label="Inicio" value={periodStart} onChange={setPeriodStart} />
          <TextField label="Fim" value={periodEnd} onChange={setPeriodEnd} />
          <TextField label="Vencimento" value={dueDate} onChange={setDueDate} />
        </FormGrid>
        <div className="inline-actions" style={{ marginBottom: "var(--space-4)" }}>
          <span className="muted">Periodicidade:</span>
          <Tabs items={PERIODICITY_ITEMS} active={periodicity} onChange={setPeriodicity} />
        </div>
        <div className="toolbar">
          <button onClick={() => void suggestPeriod()}>Sugerir periodo</button>
          <button onClick={() => void findOperations()}>Buscar operacoes</button>
        </div>

        <div className="charges-columns">
          <div className="charges-column">
            <h3>Operacoes incluidas no periodo</h3>
            {eligible.length ? (
              <div className="table">
                <div className="table-head charge-operation-grid"><span>Data</span><span>Tipo</span><span>Sacas</span><span>R$/saca</span><span>Servico</span><span>Status</span></div>
                {eligible.map((op) => <div key={op.id} className="table-row charge-operation-grid"><span>{op.operationDate}</span><span>{op.operationScope}</span><span>{decimalTextBr(op.quantitySacks)}</span><span>{formatCurrencyFromCents(op.appliedRateValueCents)}</span><span>{formatCurrencyFromCents(op.serviceAmountCents)}</span><span>{op.billingStatus}</span></div>)}
              </div>
            ) : (
              <EmptyState
                title={searchedOperations ? "Nenhuma operacao elegivel" : "Nenhuma operacao carregada"}
                description={searchedOperations ? "Esse cliente nao tem operacoes confirmadas e nao cobradas nesse periodo. Confira as datas ou se as notas dele ja foram confirmadas em 'Notas e operacoes'." : "Clique em 'Buscar operacoes' para listar as operacoes elegiveis do cliente no periodo."}
              />
            )}
          </div>

          <div className="charges-column">
            <h3>Ajustes e valores</h3>
            <div className="kv-list">
              <div><dt>Adiantamento (R$)</dt><dd><input value={advanceInput} onChange={(event) => setAdvanceInput(event.target.value)} placeholder="0,00" disabled={!detail} /></dd></div>
              <div><dt>Descontos (R$)</dt><dd><input value={discountInput} onChange={(event) => setDiscountInput(event.target.value)} placeholder="0,00" disabled={!detail} /></dd></div>
              <div><dt>Acrescimos (R$)</dt><dd><input value={surchargeInput} onChange={(event) => setSurchargeInput(event.target.value)} placeholder="0,00" disabled={!detail} /></dd></div>
            </div>
            <div className="toolbar">
              <button onClick={() => void applyAdjustments()} disabled={!detail}>Aplicar ajustes</button>
            </div>
            <div className="charges-final-card">
              <span>Valor final a cobrar</span>
              <strong>{formatCurrencyFromCents(detail?.charge.finalAmountCents ?? 0)}</strong>
              {!detail ? (
                <button className="primary" onClick={() => void createDraft()} disabled={eligible.length === 0}>Gerar rascunho</button>
              ) : ["DRAFT", "PENDING_REVIEW"].includes(detail.charge.status) ? (
                <button className="primary" onClick={() => void issue()}>Gerar cobranca</button>
              ) : (
                <div className="inline-actions">
                  <button onClick={() => void openDocument("pdf")}>PDF</button>
                  <button onClick={() => void openDocument("excel")}>Excel</button>
                  <button onClick={() => void openDocument("image")}>Imagem</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </AdminBlock>

      <AdminBlock title="Resumo do periodo por cliente">
        <p className="muted">Sacas e valor de servico por cliente, separado entre operacoes internas e externas. Clientes sem movimento no periodo aparecem zerados.</p>
        <label className="inline-check"><input type="checkbox" checked={includeAlreadyBilled} onChange={(event) => setIncludeAlreadyBilled(event.target.checked)} /> Incluir operacoes ja cobradas</label>
        <div className="table">
          <div className="table-head partner-summary-grid"><span>Cliente</span><span>Sacas interno</span><span>Sacas externo</span><span>Valor interno</span><span>Valor externo</span><span>Total</span><span>Acoes</span></div>
          {partnerSummary.map((row) => (
            <div key={row.partnerId} className="table-row partner-summary-grid">
              <span>{row.partnerDisplayName}</span>
              <span>{decimalTextBr(row.internalSacks)}</span>
              <span>{decimalTextBr(row.externalSacks)}</span>
              <span>{formatCurrencyFromCents(row.internalAmountCents)}</span>
              <span>{formatCurrencyFromCents(row.externalAmountCents)}</span>
              <span>{formatCurrencyFromCents(row.totalAmountCents)}</span>
              <span><button disabled={row.operationCount === 0} onClick={() => void generateDraftForPartner(row)}>Gerar rascunho</button></span>
            </div>
          ))}
        </div>
      </AdminBlock>

      {detail ? <AdminBlock title={`Detalhe ${detail.charge.chargeNumber ?? "Rascunho"}`}>
        <div className="cards">
          <article><span>Subtotal</span><strong>{formatCurrencyFromCents(detail.charge.subtotalServicesCents)}</strong></article>
          <article><span>Ajustes +</span><strong>{formatCurrencyFromCents(detail.charge.additionsCents)}</strong></article>
          <article><span>Ajustes -</span><strong>{formatCurrencyFromCents(detail.charge.deductionsCents)}</strong></article>
          <article><span>Total</span><strong>{formatCurrencyFromCents(detail.charge.finalAmountCents)}</strong></article>
          <article><span>Aberto</span><strong>{formatCurrencyFromCents(detail.charge.openAmountCents)}</strong></article>
        </div>
        <div className="toolbar"><button onClick={() => void registerPayment()}>Registrar pagamento</button></div>
      </AdminBlock> : null}

      <AdminBlock title="Historico de cobrancas">
        <div className="table"><div className="table-head charge-grid"><span>Numero</span><span>Cliente</span><span>Periodo</span><span>Total</span><span>Pago</span><span>Aberto</span><span>Status</span><span>Acoes</span></div>{charges.map((charge) => <div key={charge.id} className="table-row charge-grid"><span>{charge.chargeNumber ?? "Rascunho"}</span><span>{partners.find((item) => item.id === charge.clientPartnerId)?.displayName ?? charge.clientPartnerId}</span><span>{charge.periodStart} a {charge.periodEnd}</span><span>{formatCurrencyFromCents(charge.finalAmountCents)}</span><span>{formatCurrencyFromCents(charge.paidAmountCents)}</span><span>{formatCurrencyFromCents(charge.openAmountCents)}</span><span>{charge.status}</span><span><button onClick={() => window.operationsCafe.getClientCharge(charge.id).then(setDetail)}>Abrir</button></span></div>)}</div>
      </AdminBlock>
      <Feedback message={message} />
    </section>
  );
}
