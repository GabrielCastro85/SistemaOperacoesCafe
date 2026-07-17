import { DecimalInput } from "../../../design-system";
import { TextField } from "../../../components/forms/LegacyFields";
import { FormGrid } from "../../../components/layout/SectionPrimitives";

export function ProductForm({ name, weight, onNameChange, onWeightChange }: { name: string; weight: string; onNameChange: (value: string) => void; onWeightChange: (value: string) => void }): JSX.Element {
  return (
    <FormGrid>
      <TextField label="Nome" value={name} onChange={onNameChange} required />
      <DecimalInput label="Peso padrao da saca" value={weight} onChange={(event) => onWeightChange(event.target.value)} />
    </FormGrid>
  );
}
