import type { CostCenter, ExpenseCategory } from "../../../../shared/types/domain";
import { Button, DateInput, Select } from "../../../design-system";
import { TextField } from "../../../components/forms/LegacyFields";
import { FormGrid } from "../../../components/layout/SectionPrimitives";
import type { PayableDraftFormState } from "../hooks/usePayableDraftForm";

export function QuickPayableForm({ form, categories, costCenters, onChange, onSubmit, onDraft }: { form: PayableDraftFormState; categories: ExpenseCategory[]; costCenters: CostCenter[]; onChange: (form: PayableDraftFormState) => void; onSubmit: () => void; onDraft?: () => void }): JSX.Element {
  return (
    <FormGrid>
      <TextField label="Favorecido" value={form.payee} onChange={(value) => onChange({ ...form, payee: value })} />
      <TextField label="Descricao" value={form.description} onChange={(value) => onChange({ ...form, description: value })} />
      <TextField label="Valor em centavos" value={form.amount} onChange={(value) => onChange({ ...form, amount: value })} />
      <DateInput label="Vencimento" value={form.dueDate} onChange={(event) => onChange({ ...form, dueDate: event.target.value })} />
      <Select label="Categoria" value={form.categoryId} onChange={(event) => onChange({ ...form, categoryId: event.target.value })}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
      <Select label="Centro de custo" value={form.costCenterId} onChange={(event) => onChange({ ...form, costCenterId: event.target.value })}><option value="">Sem centro</option>{costCenters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
      <Button variant="primary" onClick={onSubmit}>Lancar conta</Button>
      {onDraft ? <Button onClick={onDraft}>Salvar rascunho</Button> : null}
    </FormGrid>
  );
}
