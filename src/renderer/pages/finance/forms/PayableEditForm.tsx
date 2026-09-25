import type { CostCenter, ExpenseCategory } from "../../../../shared/types/domain";
import { Button, DateInput, Select } from "../../../design-system";
import { TextField } from "../../../components/forms/LegacyFields";
import { FormGrid } from "../../../components/layout/SectionPrimitives";
import type { PayableDraftFormState } from "../hooks/usePayableDraftForm";
import { PayablePaymentPlanningFields } from "./PayablePaymentPlanningFields";

export function PayableEditForm({ form, categories, costCenters, saving, onChange, onSave, onCancel }: { form: PayableDraftFormState; categories: ExpenseCategory[]; costCenters: CostCenter[]; saving: boolean; onChange: (form: PayableDraftFormState) => void; onSave: () => void; onCancel: () => void }): JSX.Element {
  return <div className="payable-edit-form">
    <FormGrid>
      <TextField required label="Favorecido" value={form.payee} onChange={(value) => onChange({ ...form, payee: value })} />
      <TextField required label="Descricao" value={form.description} onChange={(value) => onChange({ ...form, description: value })} />
      <TextField required label="Valor (R$)" value={form.amount} onChange={(value) => onChange({ ...form, amount: value })} />
      <DateInput required label="Vencimento" value={form.dueDate} onChange={(event) => onChange({ ...form, dueDate: event.target.value })} />
      <Select required label="Categoria" value={form.categoryId} onChange={(event) => onChange({ ...form, categoryId: event.target.value })}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
      <Select label="Centro de custo" value={form.costCenterId} onChange={(event) => onChange({ ...form, costCenterId: event.target.value })}><option value="">Sem centro</option>{costCenters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
      <PayablePaymentPlanningFields form={form} onChange={onChange} />
    </FormGrid>
    <div className="actions"><Button onClick={onCancel}>Cancelar edicao</Button><Button variant="primary" loading={saving} disabled={!form.payee.trim() || !form.description.trim() || !form.categoryId || (form.plannedPaymentMethod === "PIX" && !form.pixKey.trim())} onClick={onSave}>Salvar alteracoes</Button></div>
  </div>;
}
