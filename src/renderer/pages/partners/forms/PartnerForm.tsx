import { TextField } from "../../../components/forms/LegacyFields";
import { FormGrid } from "../../../components/layout/SectionPrimitives";

export function PartnerForm({ name, onNameChange }: { name: string; onNameChange: (value: string) => void }): JSX.Element {
  return (
    <FormGrid>
      <TextField label="Nome" value={name} onChange={onNameChange} required />
    </FormGrid>
  );
}
