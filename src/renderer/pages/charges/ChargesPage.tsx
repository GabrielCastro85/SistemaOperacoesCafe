import React, { useCallback, useEffect, useRef, useState } from "react";
import type { BillingPeriodicity, BillingSummary, BootstrapData, BusinessPartner, BusinessPartnerLegalEntity, ClientCharge, ClientChargeDetail, FiscalDocument, Operation, PartnerRateSummaryRow } from "../../../shared/types/domain";
import { formatCurrencyFromCents, formatCurrencyInput, formatDateOnlyBr, parseCurrencyToCents } from "../../../shared/utils/format";
import { DateInput, EmptyState, PageHeader, Tabs } from "../../design-system";
import { Feedback } from "../../components/feedback/Feedback";
import { PartnerQuickSearch } from "../../components/forms/PartnerQuickSearch";
import { AdminBlock, FormGrid } from "../../components/layout/SectionPrimitives";
import { requestDecision, requestTextInput } from "../../utils/dialogs";
import { useAutoScroll } from "../../hooks/useAutoScroll";
import { formatOperationScope } from "../../../shared/utils/operationLabels";
import { formatCombinedStatusLabel, formatStatusLabel } from "../../../shared/utils/statusLabels";

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
  const activeLegalEntity = data.legalEntities.find((item) => item.id === ownLegalEntityId) ?? null;
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [partnerLegalEntities, setPartnerLegalEntities] = useState<BusinessPartnerLegalEntity[]>([]);
  const [charges, setCharges] = useState<ClientCharge[]>([]);
  const [eligible, setEligible] = useState<Operation[]>([]);
  const [clientPeriodOperations, setClientPeriodOperations] = useState<Operation[]>([]);
  const [operationDocuments, setOperationDocuments] = useState<Record<string, FiscalDocument>>({});
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
  const [chargesTab, setChargesTab] = useState<"gerar" | "resumo" | "historico">("gerar");
  const scrollTo = useAutoScroll();
  const operationsRef = useRef<HTMLDivElement | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const clients = await window.operationsCafe.listBusinessPartners({ role: "CLIENT", status: "active" });
    setPartners(clients);
    setPartnerLegalEntities((await Promise.all(clients.map((partner) => window.operationsCafe.listPartnerLegalEntities(partner.id)))).flat());
    setClientId((current) => current || clients[0]?.id || "");
    setCharges((await window.operationsCafe.listClientCharges({ organizationId, status: "all" })).filter((charge) => charge.ownLegalEntityId === ownLegalEntityId));
    setSummary(await window.operationsCafe.getBillingSummary({ organizationId, ownLegalEntityId }));
  }, [organizationId, ownLegalEntityId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setEligible([]); setClientPeriodOperations([]); setSearchedOperations(false); }, [clientId]);

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
    const related = await window.operationsCafe.listOperations({ organizationId, ownLegalEntityId, responsiblePartnerId: clientId, periodStart, periodEnd, status: "all", billingStatus: "all" });
    await loadOperationDocuments([...found, ...related]);
    setEligible(found);
    setClientPeriodOperations(related);
    setSummary(await window.operationsCafe.getBillingSummary({ organizationId, ownLegalEntityId }));
    await loadPartnerSummary();
    setSearchedOperations(true);
    setMessage(found.length > 0 ? `${found.length} operacao(oes) elegivel(is) encontrada(s) no periodo.` : "Nenhuma operacao elegivel encontrada nesse periodo para esse cliente.");
    scrollTo(operationsRef);
  }

  async function loadOperationDocuments(operations: Operation[]): Promise<void> {
    const fiscalDocumentIds = Array.from(new Set(operations.map((operation) => operation.fiscalDocumentId).filter(Boolean)));
    const entries = await Promise.all(fiscalDocumentIds.map(async (id) => {
      const detailDoc = await window.operationsCafe.getFiscalDocument(id);
      return [id, detailDoc.document] as const;
    }));
    setOperationDocuments(Object.fromEntries(entries));
  }

  function legalEntityLabel(id: string): string {
    const entity = data.legalEntities.find((item) => item.id === id);
    return entity ? `${entity.tradeName}${entity.cnpj ? ` - ${entity.cnpj}` : ""}` : id;
  }

  function operationBillingReason(operation: Operation): string {
    if (operation.ownLegalEntityId !== ownLegalEntityId) return "Outro CNPJ proprio";
    if (operation.status !== "CONFIRMED") return "Nota ainda nao confirmada";
    if (operation.billingStatus !== "UNBILLED") return operation.billingStatus === "RESERVED" ? "Ja reservada em rascunho" : "Ja cobrada";
    if (operation.appliedRateValueCents === 0 || operation.serviceAmountCents === 0) return "Regra por saca zerada ou ausente";
    return "Elegivel";
  }

  function operationDocument(operation: Operation): FiscalDocument | null {
    return operationDocuments[operation.fiscalDocumentId] ?? null;
  }

  function operationNoteLabel(operation: Operation): string {
    const document = operationDocument(operation);
    return document?.documentNumber ? `NF ${document.documentNumber}` : "NF nao localizada";
  }

  function operationValueByNote(operation: Operation): string {
    return `${formatCurrencyFromCents(operation.serviceAmountCents)} x ${operationNoteLabel(operation)}`;
  }

  const diagnosticOperations = clientPeriodOperations.filter((operation) => !eligible.some((item) => item.id === operation.id));
  const advanceCents = parseCurrencyToCents(advanceInput);
  const discountCents = parseCurrencyToCents(discountInput);
  const surchargeCents = parseCurrencyToCents(surchargeInput);
  const eligibleSubtotalCents = eligible.reduce((total, operation) => total + operation.serviceAmountCents, 0);
  const chargeBaseCents = detail?.charge.finalAmountCents ?? eligibleSubtotalCents;
  const previewFinalCents = Math.max(0, chargeBaseCents + surchargeCents - advanceCents - discountCents);
  const visibleFinalCents = detail ? detail.charge.finalAmountCents : previewFinalCents;

  function formatMoneyState(value: string, setter: (next: string) => void): void {
    setter(formatCurrencyInput(value));
  }

  async function createDraft(): Promise<void> {
    try {
      const draft = await window.operationsCafe.createClientChargeDraft({ organizationId, ownLegalEntityId, clientPartnerId: clientId, billingProfileId: null, periodicity, periodStart, periodEnd, dueDate, notes: null, internalNotes: null, operationIds: eligible.map((item) => item.id) });
      setDetail(draft);
      setMessage("Rascunho gerado e operacoes reservadas.");
      await load();
      await loadPartnerSummary();
      scrollTo(detailRef);
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
      setChargesTab("gerar");
      setMessage(`Rascunho gerado para ${row.partnerDisplayName}.`);
      await load();
      await loadPartnerSummary();
      scrollTo(detailRef);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao gerar rascunho."}`);
    }
  }

  async function issue(): Promise<void> {
    if (!detail) return;
    const issued = await window.operationsCafe.issueClientCharge(detail.charge.id);
    if (!issued) {
      setMessage("Emissao cancelada. Nenhuma pasta foi escolhida.");
      return;
    }
    setDetail(issued);
    setMessage("Cobranca emitida e documentos salvos na pasta escolhida.");
    await load();
    scrollTo(historyRef);
  }

  async function applyAdjustments(): Promise<void> {
    if (!detail) return;
    try {
      let current = detail;
      const shouldRegenerateDocuments = !["DRAFT", "PENDING_REVIEW"].includes(detail.charge.status);
      let documentGenerationCanceled = false;
      if (advanceCents > 0) {
        current = await window.operationsCafe.addChargeAdjustment({ clientChargeId: current.charge.id, ledgerEntryId: null, adjustmentType: "ADVANCE", effect: "REDUCE_RECEIVABLE", description: "Adiantamento", amountCents: advanceCents, sortOrder: 10, reason: "Ajuste manual" });
      }
      if (discountCents > 0) {
        current = await window.operationsCafe.addChargeAdjustment({ clientChargeId: current.charge.id, ledgerEntryId: null, adjustmentType: "DISCOUNT", effect: "REDUCE_RECEIVABLE", description: "Desconto", amountCents: discountCents, sortOrder: 20, reason: "Ajuste manual" });
      }
      if (surchargeCents > 0) {
        current = await window.operationsCafe.addChargeAdjustment({ clientChargeId: current.charge.id, ledgerEntryId: null, adjustmentType: "SURCHARGE", effect: "INCREASE_RECEIVABLE", description: "Acrescimo", amountCents: surchargeCents, sortOrder: 30, reason: "Ajuste manual" });
      }
      if (shouldRegenerateDocuments && (advanceCents > 0 || discountCents > 0 || surchargeCents > 0)) {
        const regenerated = await window.operationsCafe.regenerateChargeDocuments(current.charge.id);
        if (regenerated) {
          current = regenerated;
        } else {
          documentGenerationCanceled = true;
        }
      }
      setDetail(current);
      setAdvanceInput("");
      setDiscountInput("");
      setSurchargeInput("");
      setMessage(documentGenerationCanceled ? "Ajustes aplicados. Geracao dos documentos foi cancelada." : shouldRegenerateDocuments ? "Ajustes aplicados e documentos regenerados na pasta escolhida." : "Ajustes aplicados.");
      await load();
      scrollTo(detailRef);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao aplicar ajustes."}`);
    }
  }

  async function registerPayment(): Promise<void> {
    if (!detail) return;
    const value = await requestTextInput({ title: "Registrar recebimento", label: "Valor recebido (R$)" });
    if (!value) return;
    const amountCents = parseCurrencyToCents(value);
    const payment = await window.operationsCafe.createClientPayment({ organizationId, ownLegalEntityId, clientPartnerId: detail.charge.clientPartnerId, paymentDate: new Date().toISOString().slice(0, 10), amountCents, paymentMethod: "PIX", bankAccountDescription: null, transactionReference: null, notes: null, attachmentPath: null });
    setDetail(await window.operationsCafe.allocateClientPayment({ clientPaymentId: payment.id, clientChargeId: detail.charge.id, amountCents }));
    await load();
    scrollTo(detailRef);
  }

  async function settleSingleOperation(operation: Operation): Promise<void> {
    if (operation.serviceAmountCents <= 0) {
      setMessage("Essa nota nao tem valor de servico calculado para receber.");
      return;
    }
    const confirmed = await requestDecision({
      title: "Receber nota fiscal",
      message: `Registrar pagamento de ${formatCurrencyFromCents(operation.serviceAmountCents)} referente a ${operationNoteLabel(operation)}? Essa nota ficara como paga e as outras continuam em aberto.`
    });
    if (!confirmed) return;

    try {
      const draft = await window.operationsCafe.createClientChargeDraft({
        organizationId,
        ownLegalEntityId,
        clientPartnerId: clientId,
        billingProfileId: null,
        periodicity,
        periodStart: operation.operationDate,
        periodEnd: operation.operationDate,
        dueDate,
        notes: `Baixa individual da ${operationNoteLabel(operation)}`,
        internalNotes: "Cobranca gerada automaticamente pela baixa individual de nota.",
        operationIds: [operation.id]
      });
      const issued = await window.operationsCafe.issueClientCharge(draft.charge.id);
      if (!issued) {
        setMessage("Recebimento cancelado. Nenhuma pasta foi escolhida para gerar a cobranca individual.");
        return;
      }
      const payment = await window.operationsCafe.createClientPayment({
        organizationId,
        ownLegalEntityId,
        clientPartnerId: clientId,
        paymentDate: new Date().toISOString().slice(0, 10),
        amountCents: operation.serviceAmountCents,
        paymentMethod: "PIX",
        bankAccountDescription: null,
        transactionReference: operationNoteLabel(operation),
        notes: `Pagamento individual referente a ${operationNoteLabel(operation)}`,
        attachmentPath: null
      });
      const paid = await window.operationsCafe.allocateClientPayment({ clientPaymentId: payment.id, clientChargeId: issued.charge.id, amountCents: operation.serviceAmountCents });
      setDetail(paid);
      setMessage(`${operationNoteLabel(operation)} recebida como paga. As demais notas permanecem em aberto.`);
      await load();
      await findOperations();
      scrollTo(detailRef);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao baixar a nota."}`);
    }
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

      <div className="settings-tabs">
        <button className={chargesTab === "gerar" ? "active" : ""} onClick={() => setChargesTab("gerar")}>Gerar cobranca</button>
        <button className={chargesTab === "resumo" ? "active" : ""} onClick={() => setChargesTab("resumo")}>Resumo do periodo</button>
        <button className={chargesTab === "historico" ? "active" : ""} onClick={() => setChargesTab("historico")}>Historico</button>
      </div>

      {chargesTab === "gerar" && (
      <AdminBlock title="Gerar cobranca">
        <div className="charge-context-note">
          <span>CNPJ ativo para cobranca</span>
          <strong>{activeLegalEntity ? activeLegalEntity.tradeName : "Nao selecionado"}</strong>
          <small>{activeLegalEntity?.cnpj ? activeLegalEntity.cnpj : "CNPJ pendente"} - somente operacoes desse CNPJ entram como elegiveis.</small>
        </div>
        <FormGrid>
          <PartnerQuickSearch label="Cliente" value={clientId} onChange={setClientId} partners={partners} legalEntities={partnerLegalEntities} />
          <DateInput label="Inicio" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
          <DateInput label="Fim" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
          <DateInput label="Vencimento" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </FormGrid>
        <div className="inline-actions" style={{ marginBottom: "var(--space-4)" }}>
          <span className="muted">Periodicidade:</span>
          <Tabs items={PERIODICITY_ITEMS} active={periodicity} onChange={setPeriodicity} />
        </div>
        <div className="toolbar">
          <button onClick={() => void suggestPeriod()}>Sugerir periodo</button>
          <button onClick={() => void findOperations()}>Buscar operacoes</button>
        </div>

        <div className="charges-columns" ref={operationsRef}>
          <div className="charges-column">
            <h3>Operacoes incluidas no periodo</h3>
            {eligible.length ? (
              <div className="table">
                <div className="table-head charge-operation-grid"><span>Nota</span><span>Operacao</span><span>Valor</span><span>Status</span><span>Acoes</span></div>
                {eligible.map((op) => (
                  <div key={op.id} className="table-row charge-operation-grid">
                    <span><strong>{operationNoteLabel(op)}</strong><small>{formatDateOnlyBr(op.operationDate)}</small></span>
                    <span><strong>{formatOperationScope(op.operationScope)}</strong><small>{decimalTextBr(op.quantitySacks)} sacas · {formatCurrencyFromCents(op.appliedRateValueCents)}/saca</small></span>
                    <span><strong>{formatCurrencyFromCents(op.serviceAmountCents)}</strong><small>{operationValueByNote(op)}</small></span>
                    <span>{formatStatusLabel(op.billingStatus)}</span>
                    <span className="row-actions"><button onClick={() => void settleSingleOperation(op)}>Receber NF</button></span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title={searchedOperations ? "Nenhuma operacao elegivel" : "Nenhuma operacao carregada"}
                description={searchedOperations ? "Esse cliente nao tem operacoes confirmadas e nao cobradas nesse periodo. Confira as datas ou se as notas dele ja foram confirmadas em 'Notas e operacoes'." : "Clique em 'Buscar operacoes' para listar as operacoes elegiveis do cliente no periodo."}
              />
            )}
            {searchedOperations && diagnosticOperations.length > 0 ? (
              <div className="charge-diagnostics">
                <h4>Operacoes encontradas fora da cobranca atual</h4>
                <p className="muted">Essas notas existem no periodo para o cliente, mas nao entram no total a cobrar atual. Notas ja cobradas ou pagas aparecem aqui como referencia do periodo.</p>
                <div className="table">
                  <div className="table-head charge-diagnostic-grid"><span>Nota</span><span>CNPJ proprio</span><span>Operacao</span><span>Valor</span><span>Status</span><span>Motivo</span></div>
                  {diagnosticOperations.map((op) => (
                    <div key={op.id} className="table-row charge-diagnostic-grid">
                      <span><strong>{operationNoteLabel(op)}</strong><small>{formatDateOnlyBr(op.operationDate)}</small></span>
                      <span>{legalEntityLabel(op.ownLegalEntityId)}</span>
                      <span><strong>{formatOperationScope(op.operationScope)}</strong><small>{decimalTextBr(op.quantitySacks)} sacas · {formatCurrencyFromCents(op.appliedRateValueCents)}/saca</small></span>
                      <span><strong>{formatCurrencyFromCents(op.serviceAmountCents)}</strong><small>{operationValueByNote(op)}</small></span>
                      <span>{formatCombinedStatusLabel(op.status, op.billingStatus)}</span>
                      <span>{operationBillingReason(op)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="charges-column">
            <h3>Ajustes e valores</h3>
            <div className="kv-list">
              <div><dt>Adiantamento (R$)</dt><dd><input value={advanceInput} onChange={(event) => setAdvanceInput(event.target.value)} onBlur={() => formatMoneyState(advanceInput, setAdvanceInput)} placeholder="R$ 0,00" disabled={!detail} /></dd></div>
              <div><dt>Descontos (R$)</dt><dd><input value={discountInput} onChange={(event) => setDiscountInput(event.target.value)} onBlur={() => formatMoneyState(discountInput, setDiscountInput)} placeholder="R$ 0,00" disabled={!detail} /></dd></div>
              <div><dt>Acrescimos (R$)</dt><dd><input value={surchargeInput} onChange={(event) => setSurchargeInput(event.target.value)} onBlur={() => formatMoneyState(surchargeInput, setSurchargeInput)} placeholder="R$ 0,00" disabled={!detail} /></dd></div>
            </div>
            <div className="toolbar">
              <button onClick={() => void applyAdjustments()} disabled={!detail}>Aplicar ajustes</button>
            </div>
            <div className="charges-final-card">
              <span>Valor final a cobrar</span>
              <strong>{formatCurrencyFromCents(visibleFinalCents)}</strong>
              {!detail && eligible.length > 0 ? <small>Soma das notas elegiveis encontradas.</small> : null}
              {detail && (advanceCents > 0 || discountCents > 0 || surchargeCents > 0) ? <small>Apos ajustes digitados: {formatCurrencyFromCents(previewFinalCents)}</small> : null}
              {!detail ? (
                <button className="primary" onClick={() => void createDraft()} disabled={eligible.length === 0}>Gerar rascunho</button>
              ) : ["DRAFT", "PENDING_REVIEW"].includes(detail.charge.status) ? (
                <button className="primary" onClick={() => void issue()}>Gerar cobranca</button>
              ) : (
                <div className="inline-actions">
                  <button onClick={() => void openDocument("pdf")}>PDF</button>
                  <button onClick={() => void openDocument("image")}>Imagem</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </AdminBlock>
      )}

      {chargesTab === "resumo" && (
      <AdminBlock title="Resumo do periodo por cliente">
        <p className="muted">Sacas e valor de servico por cliente, separado entre vendas na mesma UF e em outra UF. Clientes sem movimento no periodo aparecem zerados.</p>
        <label className="inline-check"><input type="checkbox" checked={includeAlreadyBilled} onChange={(event) => setIncludeAlreadyBilled(event.target.checked)} /> Incluir operacoes ja cobradas</label>
        <div className="table">
          <div className="table-head partner-summary-grid"><span>Cliente</span><span>Sacas mesma UF</span><span>Sacas outra UF</span><span>Valor mesma UF</span><span>Valor outra UF</span><span>Total</span><span>Acoes</span></div>
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
      )}

      {chargesTab === "gerar" && detail ? <div ref={detailRef}><AdminBlock title={`Detalhe ${detail.charge.chargeNumber ?? "Rascunho"}`}>
        <div className="cards">
          <article><span>Subtotal</span><strong>{formatCurrencyFromCents(detail.charge.subtotalServicesCents)}</strong></article>
          <article><span>Ajustes +</span><strong>{formatCurrencyFromCents(detail.charge.additionsCents)}</strong></article>
          <article><span>Ajustes -</span><strong>{formatCurrencyFromCents(detail.charge.deductionsCents)}</strong></article>
          <article><span>Total</span><strong>{formatCurrencyFromCents(detail.charge.finalAmountCents)}</strong></article>
          <article><span>Aberto</span><strong>{formatCurrencyFromCents(detail.charge.openAmountCents)}</strong></article>
        </div>
        <div className="table">
          <div className="table-head charge-detail-operation-grid"><span>Nota fiscal</span><span>Data</span><span>Produto</span><span>Sacas</span><span>R$/saca</span><span>Servico</span><span>Situação</span></div>
          {detail.operations.map((operation) => (
            <div key={operation.id} className="table-row charge-detail-operation-grid">
              <span>{operation.fiscalDocumentNumberSnapshot ? `NF ${operation.fiscalDocumentNumberSnapshot}` : "NF -"}</span>
              <span>{formatDateOnlyBr(operation.operationDateSnapshot)}</span>
              <span>{operation.productNameSnapshot ?? "-"}</span>
              <span>{decimalTextBr(operation.quantitySacksDecimalSnapshot)}</span>
              <span>{formatCurrencyFromCents(operation.serviceRateCentsSnapshot)}</span>
              <span>{formatCurrencyFromCents(operation.serviceAmountCentsSnapshot)} x NF {operation.fiscalDocumentNumberSnapshot ?? "-"}</span>
              <span>{detail.charge.status === "PAID" ? "Paga" : detail.charge.paidAmountCents > 0 ? "Pagamento parcial" : "Em aberto"}</span>
            </div>
          ))}
        </div>
        <div className="toolbar"><button onClick={() => void registerPayment()}>Registrar pagamento</button></div>
      </AdminBlock></div> : null}

      {chargesTab === "historico" && (
      <div ref={historyRef}><AdminBlock title="Historico de cobrancas">
        <div className="table"><div className="table-head charge-grid"><span>Numero</span><span>Cliente</span><span>Periodo</span><span>Total</span><span>Pago</span><span>Aberto</span><span>Status</span><span>Acoes</span></div>{charges.map((charge) => <div key={charge.id} className="table-row charge-grid"><span>{charge.chargeNumber ?? "Rascunho"}</span><span>{partners.find((item) => item.id === charge.clientPartnerId)?.displayName ?? charge.clientPartnerId}</span><span>{formatDateOnlyBr(charge.periodStart)} a {formatDateOnlyBr(charge.periodEnd)}</span><span>{formatCurrencyFromCents(charge.finalAmountCents)}</span><span>{formatCurrencyFromCents(charge.paidAmountCents)}</span><span>{formatCurrencyFromCents(charge.openAmountCents)}</span><span>{formatStatusLabel(charge.status)}</span><span><button onClick={() => window.operationsCafe.getClientCharge(charge.id).then((opened) => { setDetail(opened); setChargesTab("gerar"); scrollTo(detailRef, 120); })}>Abrir</button></span></div>)}</div>
      </AdminBlock>
      </div>
      )}
      <Feedback message={message} />
    </section>
  );
}
