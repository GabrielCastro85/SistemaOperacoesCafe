import { useCallback, useEffect, useState } from "react";
import { Alert, Button, PageHeader, PageSection, Tabs } from "../../design-system";
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

export function PayableDetailsPage({ data, id, initialEditing = false }: FinancePageProps & { id: string | null; initialEditing?: boolean }): JSX.Element {
  const { finance, reload: reloadFinance } = useFinanceData(data);
  const { detail, purchaseOperations, reload } = usePayableDetails(id);
  const [editing, setEditing] = useState(initialEditing);
  const [editForm, setEditForm] = useState<PayableDraftFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  return (
    <section className="content-section">
      <PageHeader eyebrow="Conta a pagar" title={detail?.payable.description ?? "Detalhe da conta"} description={detail ? `${detail.payable.payeeNameSnapshot} · ${formatDateOnlyBr(detail.payable.dueDate)} · ${detail.payable.status}` : "Carregando conta."} actions={<>{detail && !["PAID", "CANCELLED"].includes(detail.payable.status) ? <Button variant="primary" onClick={startEditing}>Editar conta</Button> : null}<Button onClick={attach}>Anexar</Button>{detail?.payable.status === "DRAFT" ? <Button onClick={() => void window.operationsCafe.confirmAccountPayable(detail.payable.id).then(reload)}>Confirmar</Button> : null}{detail && detail.payable.status !== "CANCELLED" ? <Button onClick={() => void cancel()}>Cancelar</Button> : null}</>} />
      {message ? <Alert variant="success" title={message} /> : null}{error ? <Alert variant="danger" title="Nao foi possivel salvar">{error}</Alert> : null}
      {editing && editForm ? <PageSection title="Editar conta" description="Corrija os dados do lancamento e salve as alteracoes."><PayableEditForm form={editForm} categories={finance.categories} costCenters={finance.costCenters} saving={saving} onChange={setEditForm} onSave={() => void saveEdits()} onCancel={() => { setEditing(false); setEditForm(null); setError(null); }} /></PageSection> : null}
      <Tabs active="resumo" onChange={() => undefined} items={[{ id: "resumo", label: "Resumo" }, { id: "valores", label: "Valores" }, { id: "rateio", label: "Rateio" }, { id: "pagamentos", label: "Pagamentos" }, { id: "documentos", label: "Documentos" }, { id: "historico", label: "Historico" }]} />
      <PayableSummary payable={detail?.payable ?? null} />
      <PayablePurchaseOperations operations={purchaseOperations} />
      <PayableValuesCard payable={detail?.payable ?? null} />
      <PayableAllocations allocations={detail?.allocations ?? []} costCenters={finance.costCenters} locations={data.locations} />
      <PayablePayments payments={detail?.payments ?? []} />
      <PayableAttachments attachments={detail?.attachments ?? []} onOpen={(attachmentId) => void window.operationsCafe.openPayableAttachment(attachmentId)} onRemove={(attachmentId) => void removeAttachment(attachmentId)} />
      <PayableTimeline history={detail?.history ?? []} />
    </section>
  );
}
