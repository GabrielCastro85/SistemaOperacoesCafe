import type { PayablePaymentMethod } from "../../../../shared/types/domain";
import { Select } from "../../../design-system";
import { TextField } from "../../../components/forms/LegacyFields";
import type { PayableDraftFormState } from "../hooks/usePayableDraftForm";

export const payablePaymentMethodLabels: Record<PayablePaymentMethod, string> = {
  PIX: "PIX",
  BANK_TRANSFER: "Transferencia bancaria",
  BOLETO: "Boleto",
  CASH: "Dinheiro",
  CHECK: "Cheque",
  CARD: "Cartao",
  DIRECT_DEBIT: "Debito automatico",
  OFFSET: "Compensacao",
  OTHER: "Outro"
};

export function PayablePaymentPlanningFields({ form, onChange }: { form: PayableDraftFormState; onChange: (form: PayableDraftFormState) => void }): JSX.Element {
  return <>
    <Select label="Meio de pagamento previsto" value={form.plannedPaymentMethod} onChange={(event) => onChange({ ...form, plannedPaymentMethod: event.target.value as PayablePaymentMethod, pixKey: event.target.value === "PIX" ? form.pixKey : "" })}>
      {Object.entries(payablePaymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </Select>
    {form.plannedPaymentMethod === "PIX" ? <TextField required label="Chave PIX" value={form.pixKey} onChange={(value) => onChange({ ...form, pixKey: value })} /> : null}
  </>;
}
