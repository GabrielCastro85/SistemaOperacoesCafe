import { TextField } from "../../../components/forms/LegacyFields";
import { FormGrid } from "../../../components/layout/SectionPrimitives";

export function PartnerLegalEntityForm({ cnpj, onCnpjChange }: { cnpj: string; onCnpjChange: (value: string) => void }): JSX.Element {
  return (
    <FormGrid>
      <TextField label="CNPJ" value={cnpj} onChange={onCnpjChange} />
    </FormGrid>
  );
}
