import { TextField } from "../../../components/forms/LegacyFields";
import { FormGrid } from "../../../components/layout/SectionPrimitives";

export function PartnerContactForm({ name, onNameChange }: { name: string; onNameChange: (value: string) => void }): JSX.Element {
  return (
    <FormGrid>
      <TextField label="Contato" value={name} onChange={onNameChange} />
    </FormGrid>
  );
}
