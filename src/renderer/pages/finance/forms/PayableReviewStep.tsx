import { DefinitionList } from "../../../design-system";
import { formatDateOnlyBr } from "../../../../shared/utils/format";
import type { PayableDraftFormState } from "../hooks/usePayableDraftForm";
import { payablePaymentMethodLabels } from "./PayablePaymentPlanningFields";

export function PayableReviewStep({ form }: { form: PayableDraftFormState }): JSX.Element {
  return <DefinitionList items={[{ label: "Favorecido", value: form.payee }, { label: "Descricao", value: form.description }, { label: "Valor", value: form.amount }, { label: "Vencimento", value: formatDateOnlyBr(form.dueDate) }, { label: "Meio de pagamento", value: payablePaymentMethodLabels[form.plannedPaymentMethod] }, ...(form.plannedPaymentMethod === "PIX" ? [{ label: "Chave PIX", value: form.pixKey }] : []), { label: "Anexos", value: form.attachments.length ? form.attachments.map((item) => item.fileName).join(", ") : "Nenhum" }]} />;
}
