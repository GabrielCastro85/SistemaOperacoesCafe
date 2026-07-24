import { Button, PageHeader, Tabs } from "../../design-system";
import { requestTextInput } from "../../utils/dialogs";
import { PayableAllocations } from "./components/PayableAllocations";
import { PayableAttachments } from "./components/PayableAttachments";
import { PayablePayments } from "./components/PayablePayments";
import { PayableSummary } from "./components/PayableSummary";
import { PayableTimeline } from "./components/PayableTimeline";
import { PayableValuesCard } from "./components/PayableValuesCard";
import { useFinanceData } from "./hooks/useFinanceData";
import { usePayableDetails } from "./hooks/usePayableDetails";
import { formatDateOnlyBr } from "../../../shared/utils/format";
import type { FinancePageProps } from "./types";

export function PayableDetailsPage({ data, id }: FinancePageProps & { id: string | null }): JSX.Element {
  const { finance, reload: reloadFinance } = useFinanceData(data);
  const { detail, reload } = usePayableDetails(id);
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
      <PageHeader eyebrow="Conta a pagar" title={detail?.payable.description ?? "Detalhe da conta"} description={detail ? `${detail.payable.payeeNameSnapshot} · ${formatDateOnlyBr(detail.payable.dueDate)} · ${detail.payable.status}` : "Carregando conta."} actions={<><Button onClick={attach}>Anexar</Button>{detail?.payable.status === "DRAFT" ? <Button onClick={() => void window.operationsCafe.confirmAccountPayable(detail.payable.id).then(reload)}>Confirmar</Button> : null}{detail && detail.payable.status !== "CANCELLED" ? <Button onClick={() => void cancel()}>Cancelar</Button> : null}</>} />
      <Tabs active="resumo" onChange={() => undefined} items={[{ id: "resumo", label: "Resumo" }, { id: "valores", label: "Valores" }, { id: "rateio", label: "Rateio" }, { id: "pagamentos", label: "Pagamentos" }, { id: "documentos", label: "Documentos" }, { id: "historico", label: "Historico" }]} />
      <PayableSummary payable={detail?.payable ?? null} />
      <PayableValuesCard payable={detail?.payable ?? null} />
      <PayableAllocations allocations={detail?.allocations ?? []} costCenters={finance.costCenters} locations={data.locations} />
      <PayablePayments payments={detail?.payments ?? []} />
      <PayableAttachments attachments={detail?.attachments ?? []} onOpen={(attachmentId) => void window.operationsCafe.openPayableAttachment(attachmentId)} onRemove={(attachmentId) => void removeAttachment(attachmentId)} />
      <PayableTimeline history={detail?.history ?? []} />
    </section>
  );
}
