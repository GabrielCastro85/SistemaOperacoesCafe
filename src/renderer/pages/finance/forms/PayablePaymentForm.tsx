import type { FinancialAccount } from "../../../../shared/types/domain";
import { DateInput, Select } from "../../../design-system";
import { TextField } from "../../../components/forms/LegacyFields";
import { FormGrid } from "../../../components/layout/SectionPrimitives";

export function PayablePaymentForm({ amount, date, accountId, accounts, onAmount, onDate, onAccount }: { amount: string; date: string; accountId: string; accounts: FinancialAccount[]; onAmount: (value: string) => void; onDate: (value: string) => void; onAccount: (value: string) => void }): JSX.Element {
  return <FormGrid><TextField label="Valor (R$)" value={amount} onChange={onAmount} /><DateInput label="Data" value={date} onChange={(event) => onDate(event.target.value)} /><Select label="Conta financeira" value={accountId} onChange={(event) => onAccount(event.target.value)}><option value="">Sem conta</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></FormGrid>;
}
