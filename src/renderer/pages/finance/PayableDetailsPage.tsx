import { useCallback, useEffect, useState } from "react";
import { Alert, Button, PageHeader, PageSection, Select, Tabs } from "../../design-system";
import { TextField } from "../../components/forms/LegacyFields";
import { requestTextInput } from "../../utils/dialogs";
import { PayableAllocations } from "./components/PayableAllocations";
import { PayableAttachments } from "./components/PayableAttachments";
import { PayablePayments } from "./components/PayablePayments";
import { PayablePurchaseOperations } from "./components/PayablePurchaseOperations";
import { PayableSummary } from "./components/PayableSummary";
import { PayableTimeline } from "./components/PayableTimeline";
import { PayableValuesCard } from "./components/PayableValuesCard";
import { useFinanceData } from "./hooks/useFinanceData";
import { usePayableDetails } from "./hooks/usePayableDetails";
import { formatDateOnlyBr } from "../../../shared/utils/format";
import type { FinancePageProps } from "./types";
import type { PayableDraftFormState } from "./hooks/usePayableDraftForm";
import { PayableEditForm } from "./forms/PayableEditForm";
import { parseCurrencyToCents } from "../../../shared/utils/format";
import { formatStatusLabel } from "../../../shared/utils/statusLabels";
import type { PayablePaymentMethod } from "../../../shared/types/domain";
import { PayablePaymentForm } from "./forms/PayablePaymentForm";
import { payablePaymentMethodLabels } from "./forms/PayablePaymentPlanningFields";

type PayableDetailTab = "resumo" | "valores" | "rateio" | "pagamentos" | "documentos" | "historico";

export function PayableDetailsPage({ data, id, initialEditing = false }: FinancePageProps & { id: string | null; initialEditing?: boolean }): JSX.Element {
  const { finance, reload: reloadFinance } = useFinanceData(data);
  const { detail, purchaseOperations, reload } = usePayableDetails(id);
  const [editing, setEditing] = useState(initialEditing);
  const [editForm, setEditForm] = useState<PayableDraftFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PayableDetailTab>("resumo");
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PayablePaymentMethod>("PIX");
  const [paymentReference, setPaymentReference] = useState("");
  const [paying, setPaying] = useState(false);
  const buildEditForm = useCallback((): PayableDraftFormState | null => {
    if (!detail) return null;
    return { payee: detail.payable.payeeNameSnapshot, description: detail.payable.description, amount: ((detail.payable.originalAmountCents ?? 0) / 100).toFixed(2).replace(".", ","), dueDate: detail.payable.dueDate, categoryId: detail.payable.categoryId, costCenterId: detail.payable.defaultCostCenterId ?? "", plannedPaymentMethod: detail.payable.plannedPaymentMethod ?? "BOLETO", pixKey: detail.payable.pixKey ?? "", attachments: [] };
  }, [detail]);
  useEffect(() => {
    if (editing && detail && !editForm) setEditForm(buildEditForm());
  }, [editing, detail, editForm, buildEditForm]);
  function startEditing(): void {
    setMessage(null); setError(null); setEditForm(buildEditForm()); setEditing(true);
  }
  async function saveEdits(): Promise<void> {
    if (!detail || !editForm) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      const payable = detail.payable;
      await window.operationsCafe.updateAccountPayable(payable.id, {
        organizationId: payable.organizationId, ownLegalEntityId: payable.ownLegalEntityId,
        supplierPartnerId: payable.supplierPartnerId, supplierLegalEntityId: payable.supplierLegalEntityId,
        payeeNameSnapshot: editForm.payee, payeeTaxIdSnapshot: payable.payeeTaxIdSnapshot,
        categoryId: editForm.categoryId, defaultCostCenterId: editForm.costCenterId || null, defaultLocationId: payable.defaultLocationId,
        source: payable.source, description: editForm.description, documentType: payable.documentType, documentNumber: payable.documentNumber,
        competenceDate: payable.competenceDate, issueDate: payable.issueDate, dueDate: editForm.dueDate,
        originalAmountCents: parseCurrencyToCents(editForm.amount), discountCents: payable.discountCents, interestCents: payable.interestCents,
        penaltyCents: payable.penaltyCents, otherAdditionsCents: payable.otherAdditionsCents, amountStatus: payable.amountStatus,
        plannedPaymentMethod: editForm.plannedPaymentMethod, pixKey: editForm.plannedPaymentMethod === "PIX" ? editForm.pixKey : null,
        notes: payable.notes, internalNotes: payable.internalNotes
      });
      setEditing(false); setEditForm(null); setMessage("Conta atualizada com sucesso.");
      await Promise.all([reload(), reloadFinance()]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nao foi possivel atualizar a conta.");
    } finally { setSaving(false); }
  }
  async function attach(): Promise<void> {
    if (!id) return;
    const selected = await window.operationsCafe.selectPayableAttachment();
    if (!selected) return;
    await window.operationsCafe.addPayableAttachment({ token: selected.token, accountPayableId: id, attachmentType: "BILL", description: "Documento anexado pela tela de detalhe" });
    await reload();
  }
  async function removeAttachment(attachmentId: string): Promise<void> {
    const reason = await requestTextInput({ title: "Remover anexo", label: "Motivo da remocao", required: true });
    if (reason) await window.operationsCafe.removePayableAttachment(attachmentId, reason);
    await reload();
  }
  async function cancel(): Promise<void> {
    if (!detail) return;
    const reason = await requestTextInput({ title: "Cancelar conta", label: "Motivo do cancelamento", required: true });
    if (reason) await window.operationsCafe.cancelAccountPayable(detail.payable.id, reason);
    await Promise.all([reload(), reloadFinance()]);
  }
  function openTab(tab: PayableDetailTab): void {
    setActiveTab(tab);
    window.requestAnimationFrame(() => document.getElementById(`payable-section-${tab}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  function startPayment(): void {
    if (!detail) return;
    setPaymentAmount(((detail.payable.openAmountCents ?? 0) / 100).toFixed(2).replace(".", ","));
    setPaymentMethod(detail.payable.plannedPaymentMethod ?? "PIX");
    setPaymentReference("");
    setPaymentFormOpen(true);
    setMessage(null);
    setError(null);
    openTab("pagamentos");
  }
  async function registerPayment(): Promise<void> {
    if (!detail) return;
    const cents = parseCurrencyToCents(paymentAmount);
    const openCents = detail.payable.openAmountCents ?? 0;
    if (cents <= 0) { setError("Informe um valor de pagamento maior que zero."); return; }
    if (cents > openCents) { setError("O valor do pagamento nao pode ser maior que o saldo em aberto."); return; }
    setPaying(true); setError(null); setMessage(null);
    try {
      const payment = await window.operationsCafe.createPayablePayment({
        organizationId: detail.payable.organizationId,
        ownLegalEntityId: detail.payable.ownLegalEntityId,
        financialAccountId: paymentAccountId || null,
        paymentDate,
        amountCents: cents,
        paymentMethod,
        transactionReference: paymentReference.trim() || null,
        payeeNameSnapshot: detail.payable.payeeNameSnapshot,
        notes: null,
        attachmentPath: null,
        attachmentHash: null
      });
      await window.operationsCafe.allocatePayablePayment({ payablePaymentId: payment.id, accountPayableId: detail.payable.id, amountCents: cents });
      setPaymentFormOpen(false);
      setMessage(cents === openCents ? "Conta baixada como paga." : "Pagamento parcial registrado com sucesso.");
      await Promise.all([reload(), reloadFinance()]);
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Nao foi possivel registrar o pagamento.");
    } finally { setPaying(false); }
  }
  const canRegisterPayment = Boolean(detail && ["SCHEDULED", "OPEN", "PARTIALLY_PAID", "OVERDUE"].includes(detail.payable.status) && (detail.payable.openAmountCents ?? 0) > 0);
  return (
    <section className="content-section">
      <PageHeader eyebrow="Conta a pagar" title={detail?.payable.description ?? "Detalhe da conta"} description={detail ? `${detail.payable.payeeNameSnapshot} · ${formatDateOnlyBr(detail.payable.dueDate)} · ${formatStatusLabel(detail.payable.status)}` : "Carregando conta."} actions={<>{canRegisterPayment ? <Button variant="primary" onClick={startPayment}>Registrar pagamento</Button> : null}{detail && !["PAID", "CANCELLED"].includes(detail.payable.status) ? <Button onClick={startEditing}>Editar conta</Button> : null}<Button onClick={attach}>Anexar</Button>{detail?.payable.status === "DRAFT" ? <Button onClick={() => void window.operationsCafe.confirmAccountPayable(detail.payable.id).then(reload)}>Confirmar</Button> : null}{detail && detail.payable.status !== "CANCELLED" ? <Button onClick={() => void cancel()}>Cancelar</Button> : null}</>} />
      {message ? <Alert variant="success" title={message} /> : null}{error ? <Alert variant="danger" title="Nao foi possivel salvar">{error}</Alert> : null}
      {editing && editForm ? <PageSection title="Editar conta" description="Corrija os dados do lancamento e salve as alteracoes."><PayableEditForm form={editForm} categories={finance.categories} costCenters={finance.costCenters} saving={saving} onChange={setEditForm} onSave={() => void saveEdits()} onCancel={() => { setEditing(false); setEditForm(null); setError(null); }} /></PageSection> : null}
      <Tabs active={activeTab} onChange={openTab} items={[{ id: "resumo", label: "Resumo" }, { id: "valores", label: "Valores" }, { id: "rateio", label: "Rateio" }, { id: "pagamentos", label: "Pagamentos" }, { id: "documentos", label: "Documentos" }, { id: "historico", label: "Historico" }]} />
      <div id="payable-section-resumo" className="payable-detail-section"><PayableSummary payable={detail?.payable ?? null} /><PayablePurchaseOperations operations={purchaseOperations} /></div>
      <div id="payable-section-valores" className="payable-detail-section"><PayableValuesCard payable={detail?.payable ?? null} /></div>
      <div id="payable-section-rateio" className="payable-detail-section"><PageSection title="Rateio" description="Distribuicao da despesa por local e centro de custo."><PayableAllocations allocations={detail?.allocations ?? []} costCenters={finance.costCenters} locations={data.locations} /></PageSection></div>
      <div id="payable-section-pagamentos" className="payable-detail-section">
        <PageSection title="Pagamentos" description="Baixas totais ou parciais registradas nesta conta." actions={canRegisterPayment && !paymentFormOpen ? <Button variant="primary" onClick={startPayment}>Registrar pagamento</Button> : undefined}>
          {paymentFormOpen ? <div className="payable-payment-entry">
            <PayablePaymentForm amount={paymentAmount} date={paymentDate} accountId={paymentAccountId} accounts={finance.accounts} onAmount={setPaymentAmount} onDate={setPaymentDate} onAccount={setPaymentAccountId} />
            <div className="form-grid">
              <Select label="Meio de pagamento" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PayablePaymentMethod)}>{Object.entries(payablePaymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
              <TextField label="Referencia (opcional)" value={paymentReference} onChange={setPaymentReference} />
            </div>
            <div className="actions"><Button variant="primary" loading={paying} onClick={() => void registerPayment()}>Confirmar pagamento</Button><Button disabled={paying} onClick={() => setPaymentFormOpen(false)}>Cancelar</Button></div>
          </div> : null}
          <PayablePayments payments={detail?.payments ?? []} />
        </PageSection>
      </div>
      <div id="payable-section-documentos" className="payable-detail-section"><PageSection title="Documentos" description="Boletos, notas e comprovantes anexados a esta conta." actions={<Button onClick={attach}>Selecionar arquivo</Button>}><PayableAttachments attachments={detail?.attachments ?? []} onOpen={(attachmentId) => void window.operationsCafe.openPayableAttachment(attachmentId)} onRemove={(attachmentId) => void removeAttachment(attachmentId)} /></PageSection></div>
      <div id="payable-section-historico" className="payable-detail-section"><PageSection title="Historico" description="Alteracoes de situacao registradas para esta conta."><PayableTimeline history={detail?.history ?? []} /></PageSection></div>
    </section>
  );
}
