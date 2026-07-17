import { DefinitionList } from "../../../design-system";
import type { PayableDraftFormState } from "../hooks/usePayableDraftForm";

export function PayableReviewStep({ form }: { form: PayableDraftFormState }): JSX.Element {
  return <DefinitionList items={[{ label: "Favorecido", value: form.payee }, { label: "Descricao", value: form.description }, { label: "Valor", value: form.amount }, { label: "Vencimento", value: form.dueDate }]} />;
}
