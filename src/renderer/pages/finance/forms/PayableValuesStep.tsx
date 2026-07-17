import { DateInput } from "../../../design-system";
import { TextField } from "../../../components/forms/LegacyFields";
import { FormGrid } from "../../../components/layout/SectionPrimitives";
import type { PayableDraftFormState } from "../hooks/usePayableDraftForm";

export function PayableValuesStep({ form, onChange }: { form: PayableDraftFormState; onChange: (form: PayableDraftFormState) => void }): JSX.Element {
  return <FormGrid><TextField label="Valor em centavos" value={form.amount} onChange={(value) => onChange({ ...form, amount: value })} /><DateInput label="Vencimento" value={form.dueDate} onChange={(event) => onChange({ ...form, dueDate: event.target.value })} /></FormGrid>;
}
