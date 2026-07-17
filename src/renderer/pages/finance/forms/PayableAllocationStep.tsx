import type { CostCenter, ExpenseCategory } from "../../../../shared/types/domain";
import { Select } from "../../../design-system";
import { FormGrid } from "../../../components/layout/SectionPrimitives";
import type { PayableDraftFormState } from "../hooks/usePayableDraftForm";

export function PayableAllocationStep({ form, categories, costCenters, onChange }: { form: PayableDraftFormState; categories: ExpenseCategory[]; costCenters: CostCenter[]; onChange: (form: PayableDraftFormState) => void }): JSX.Element {
  return <FormGrid><Select label="Categoria" value={form.categoryId} onChange={(event) => onChange({ ...form, categoryId: event.target.value })}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><Select label="Centro de custo" value={form.costCenterId} onChange={(event) => onChange({ ...form, costCenterId: event.target.value })}><option value="">Sem centro</option>{costCenters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></FormGrid>;
}
