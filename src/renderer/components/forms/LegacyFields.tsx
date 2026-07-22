import { Input, Select } from "../../design-system";
import { formatCurrencyInput } from "../../../shared/utils/format";

export function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }): JSX.Element {
  return <Select label={label} value={value} onChange={(event) => onChange(event.target.value)} options={options.map(([optionValue, optionLabel]) => ({ value: optionValue, label: optionLabel }))} />;
}

export function TextField({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }): JSX.Element {
  const isMoney = /\(R\$\)|^valor\b|valor total|valor fixo|valor recebido/i.test(label) && !/preco|preço|unitario|unitário/i.test(label);
  return <Input label={label} value={value} required={required} onChange={(event) => onChange(event.target.value)} onBlur={() => { if (isMoney) onChange(formatCurrencyInput(value)); }} />;
}
