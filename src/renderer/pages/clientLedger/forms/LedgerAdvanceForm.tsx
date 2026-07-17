import { TextField } from "../../../components/forms/LegacyFields";
import { FormGrid } from "../../../components/layout/SectionPrimitives";

export function LedgerAdvanceForm({ amount, onAmountChange }: { amount: string; onAmountChange: (value: string) => void }): JSX.Element {
  return (
    <FormGrid>
      <TextField label="Valor em centavos" value={amount} onChange={onAmountChange} />
    </FormGrid>
  );
}
