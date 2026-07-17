import { TextField } from "../../../components/forms/LegacyFields";
import { FormGrid } from "../../../components/layout/SectionPrimitives";
import type { PayableDraftFormState } from "../hooks/usePayableDraftForm";

export function PayableIdentificationStep({ form, onChange }: { form: PayableDraftFormState; onChange: (form: PayableDraftFormState) => void }): JSX.Element {
  return <FormGrid><TextField label="Favorecido" value={form.payee} onChange={(value) => onChange({ ...form, payee: value })} /><TextField label="Descricao" value={form.description} onChange={(value) => onChange({ ...form, description: value })} /></FormGrid>;
}
