import { Select } from "../../../design-system";
import { TextField } from "../../../components/forms/LegacyFields";
import { FormGrid } from "../../../components/layout/SectionPrimitives";

export function FinancialAccountForm({ name, type, onName, onType }: { name: string; type: string; onName: (value: string) => void; onType: (value: string) => void }): JSX.Element {
  return <FormGrid><TextField label="Nome" value={name} onChange={onName} /><Select label="Tipo" value={type} onChange={(event) => onType(event.target.value)}><option value="BANK_ACCOUNT">Conta bancaria gerencial</option><option value="CASH">Caixa</option><option value="DIGITAL_WALLET">Carteira digital</option><option value="OTHER">Outra</option></Select></FormGrid>;
}
