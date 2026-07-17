import { DateInput } from "../../../design-system";
import { TextField } from "../../../components/forms/LegacyFields";
import { FormGrid } from "../../../components/layout/SectionPrimitives";

export function InstallmentGroupForm({ description, total, firstDueDate, count, onDescription, onTotal, onFirstDueDate, onCount }: { description: string; total: string; firstDueDate: string; count: string; onDescription: (value: string) => void; onTotal: (value: string) => void; onFirstDueDate: (value: string) => void; onCount: (value: string) => void }): JSX.Element {
  return <FormGrid><TextField label="Descricao" value={description} onChange={onDescription} /><TextField label="Valor total em centavos" value={total} onChange={onTotal} /><TextField label="Numero de parcelas" value={count} onChange={onCount} /><DateInput label="Primeiro vencimento" value={firstDueDate} onChange={(event) => onFirstDueDate(event.target.value)} /></FormGrid>;
}
