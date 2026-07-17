import React, { useCallback, useEffect, useState } from "react";
import type { BillingSummary, BootstrapData, BusinessPartner, ClientCharge, ClientChargeDetail, Operation } from "../../../shared/types/domain";
import { formatCurrencyFromCents } from "../../../shared/utils/format";
import { PageHeader } from "../../design-system";
import { Feedback } from "../../components/feedback/Feedback";
import { SelectField, TextField } from "../../components/forms/LegacyFields";
import { AdminBlock, FormGrid } from "../../components/layout/SectionPrimitives";
import { requestTextInput } from "../../utils/dialogs";
export function ChargesPage({ data }: { data: BootstrapData }): JSX.Element {
  const organizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "";
  const ownLegalEntityId = data.profile?.defaultLegalEntityId ?? data.legalEntities.find((item) => item.organizationId === organizationId)?.id ?? "";
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [charges, setCharges] = useState<ClientCharge[]>([]);
  const [eligible, setEligible] = useState<Operation[]>([]);
  const [detail, setDetail] = useState<ClientChargeDetail | null>(null);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [clientId, setClientId] = useState("");
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().slice(0, 8) + "01");
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const clients = await window.operationsCafe.listBusinessPartners({ organizationId, role: "CLIENT", status: "active" });
    setPartners(clients);
    setClientId((current) => current || clients[0]?.id || "");
    setCharges(await window.operationsCafe.listClientCharges({ organizationId, status: "all" }));
    setSummary(await window.operationsCafe.getBillingSummary(organizationId));
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  async function suggestPeriod(): Promise<void> {
    if (!clientId || !ownLegalEntityId) return;
    const [period] = await window.operationsCafe.suggestChargePeriods({ organizationId, ownLegalEntityId, clientPartnerId: clientId, referenceDate: periodEnd });
    if (period) { setPeriodStart(period.periodStart); setPeriodEnd(period.periodEnd); setMessage(period.label); }
  }

  async function findOperations(): Promise<void> {
    setEligible(await window.operationsCafe.findEligibleChargeOperations({ organizationId, ownLegalEntityId, clientPartnerId: clientId, periodStart, periodEnd }));
  }

  async function createDraft(): Promise<void> {
    try {
      const draft = await window.operationsCafe.createClientChargeDraft({ organizationId, ownLegalEntityId, clientPartnerId: clientId, billingProfileId: null, periodicity: "CUSTOM", periodStart, periodEnd, dueDate, notes: null, internalNotes: null, operationIds: eligible.map((item) => item.id) });
      setDetail(draft);
      setMessage("Rascunho gerado e operacoes reservadas.");
      await load();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao gerar cobranca."}`);
    }
  }

  async function issue(): Promise<void> {
    if (!detail) return;
    const issued = await window.operationsCafe.issueClientCharge(detail.charge.id);
    setDetail(issued);
    setMessage("Cobranca emitida com documentos.");
    await load();
  }

  async function addDiscount(): Promise<void> {
    if (!detail) return;
    const value = await requestTextInput({ title: "Desconto manual", label: "Valor do desconto em centavos" });
    if (!value) return;
    setDetail(await window.operationsCafe.addChargeAdjustment({ clientChargeId: detail.charge.id, ledgerEntryId: null, adjustmentType: "DISCOUNT", effect: "REDUCE_RECEIVABLE", description: "Desconto manual", amountCents: Number(value), sortOrder: 10, reason: "Ajuste manual" }));
  }

  async function registerPayment(): Promise<void> {
    if (!detail) return;
    const value = await requestTextInput({ title: "Registrar recebimento", label: "Valor recebido em centavos" });
    if (!value) return;
    const payment = await window.operationsCafe.createClientPayment({ organizationId, ownLegalEntityId, clientPartnerId: detail.charge.clientPartnerId, paymentDate: new Date().toISOString().slice(0, 10), amountCents: Number(value), paymentMethod: "PIX", bankAccountDescription: null, transactionReference: null, notes: null, attachmentPath: null });
    setDetail(await window.operationsCafe.allocateClientPayment({ clientPaymentId: payment.id, clientChargeId: detail.charge.id, amountCents: Number(value) }));
    await load();
  }

  return (
    <section className="content-section settings">
      <PageHeader eyebrow="Cobrancas" title="Fechamentos de clientes" description="Gere cobrancas, revise operacoes elegiveis, emita documentos e registre recebimentos vinculados." />
      <AdminBlock title="Gerar cobranca">
        <div className="cards">
          <article><span>Total a receber</span><strong>{formatCurrencyFromCents(summary?.openCents ?? 0)}</strong></article>
          <article><span>Recebido</span><strong>{formatCurrencyFromCents(summary?.receivedCents ?? 0)}</strong></article>
          <article><span>Creditos</span><strong>{formatCurrencyFromCents(summary?.availableCreditsCents ?? 0)}</strong></article>
          <article><span>Operacoes nao cobradas</span><strong>{summary?.unbilledOperations ?? 0}</strong></article>
        </div>
        <FormGrid>
          <SelectField label="Cliente" value={clientId} onChange={setClientId} options={partners.map((item) => [item.id, item.displayName])} />
          <TextField label="Inicio" value={periodStart} onChange={setPeriodStart} />
          <TextField label="Fim" value={periodEnd} onChange={setPeriodEnd} />
          <TextField label="Vencimento" value={dueDate} onChange={setDueDate} />
          <button onClick={() => void suggestPeriod()}>Sugerir periodo</button>
          <button onClick={() => void findOperations()}>Buscar operacoes</button>
          <button className="primary" onClick={() => void createDraft()} disabled={eligible.length === 0}>Gerar rascunho</button>
        </FormGrid>
        <div className="table"><div className="table-head charge-operation-grid"><span>Data</span><span>Tipo</span><span>Sacas</span><span>R$/saca</span><span>Servico</span><span>Status</span></div>{eligible.map((op) => <div key={op.id} className="table-row charge-operation-grid"><span>{op.operationDate}</span><span>{op.operationScope}</span><span>{op.quantitySacks}</span><span>{formatCurrencyFromCents(op.appliedRateValueCents)}</span><span>{formatCurrencyFromCents(op.serviceAmountCents)}</span><span>{op.billingStatus}</span></div>)}</div>
      </AdminBlock>
      {detail ? <AdminBlock title={`Detalhe ${detail.charge.chargeNumber ?? "Rascunho"}`}>
        <div className="cards">
          <article><span>Subtotal</span><strong>{formatCurrencyFromCents(detail.charge.subtotalServicesCents)}</strong></article>
          <article><span>Ajustes +</span><strong>{formatCurrencyFromCents(detail.charge.additionsCents)}</strong></article>
          <article><span>Ajustes -</span><strong>{formatCurrencyFromCents(detail.charge.deductionsCents)}</strong></article>
          <article><span>Total</span><strong>{formatCurrencyFromCents(detail.charge.finalAmountCents)}</strong></article>
          <article><span>Aberto</span><strong>{formatCurrencyFromCents(detail.charge.openAmountCents)}</strong></article>
        </div>
        <div className="toolbar"><button onClick={() => void addDiscount()}>Adicionar desconto</button><button className="primary" onClick={() => void issue()} disabled={!["DRAFT", "PENDING_REVIEW"].includes(detail.charge.status)}>Emitir e gerar documentos</button><button onClick={() => void registerPayment()}>Registrar pagamento</button></div>
      </AdminBlock> : null}
      <AdminBlock title="Historico de cobrancas">
        <div className="table"><div className="table-head charge-grid"><span>Numero</span><span>Cliente</span><span>Periodo</span><span>Total</span><span>Pago</span><span>Aberto</span><span>Status</span><span>Acoes</span></div>{charges.map((charge) => <div key={charge.id} className="table-row charge-grid"><span>{charge.chargeNumber ?? "Rascunho"}</span><span>{partners.find((item) => item.id === charge.clientPartnerId)?.displayName ?? charge.clientPartnerId}</span><span>{charge.periodStart} a {charge.periodEnd}</span><span>{formatCurrencyFromCents(charge.finalAmountCents)}</span><span>{formatCurrencyFromCents(charge.paidAmountCents)}</span><span>{formatCurrencyFromCents(charge.openAmountCents)}</span><span>{charge.status}</span><span><button onClick={() => window.operationsCafe.getClientCharge(charge.id).then(setDetail)}>Abrir</button></span></div>)}</div>
      </AdminBlock>
      <Feedback message={message} />
    </section>
  );
}


