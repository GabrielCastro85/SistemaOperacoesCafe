import { TextField } from "../../../components/forms/LegacyFields";
import { FormGrid } from "../../../components/layout/SectionPrimitives";

export function ChargeAdjustmentForm({ amount, reason, onAmountChange, onReasonChange }: { amount: string; reason: string; onAmountChange: (value: string) => void; onReasonChange: (value: string) => void }): JSX.Element {
  return (
    <FormGrid>
      <TextField label="Valor em centavos" value={amount} onChange={onAmountChange} />
      <TextField label="Motivo" value={reason} onChange={onReasonChange} />
    </FormGrid>
  );
}
