import { TextField } from "../../../components/forms/LegacyFields";
import { FormGrid } from "../../../components/layout/SectionPrimitives";

export function ExpenseCategoryForm({ name, onName }: { name: string; onName: (value: string) => void }): JSX.Element {
  return <FormGrid><TextField label="Nome da categoria" value={name} onChange={onName} /></FormGrid>;
}
