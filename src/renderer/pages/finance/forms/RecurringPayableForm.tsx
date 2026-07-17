import type { CostCenter, ExpenseCategory } from "../../../../shared/types/domain";
import { DateInput, Select } from "../../../design-system";
import { TextField } from "../../../components/forms/LegacyFields";
import { FormGrid } from "../../../components/layout/SectionPrimitives";

export function RecurringPayableForm({ description, amount, dueDate, categoryId, costCenterId, categories, costCenters, onDescription, onAmount, onDueDate, onCategory, onCostCenter }: { description: string; amount: string; dueDate: string; categoryId: string; costCenterId: string; categories: ExpenseCategory[]; costCenters: CostCenter[]; onDescription: (value: string) => void; onAmount: (value: string) => void; onDueDate: (value: string) => void; onCategory: (value: string) => void; onCostCenter: (value: string) => void }): JSX.Element {
  return <FormGrid><TextField label="Descricao" value={description} onChange={onDescription} /><TextField label="Valor fixo ou estimado em centavos" value={amount} onChange={onAmount} /><DateInput label="Inicio / vencimento base" value={dueDate} onChange={(event) => onDueDate(event.target.value)} /><Select label="Categoria" value={categoryId} onChange={(event) => onCategory(event.target.value)}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><Select label="Centro de custo" value={costCenterId} onChange={(event) => onCostCenter(event.target.value)}><option value="">Sem centro</option>{costCenters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></FormGrid>;
}
