import { Input, Select } from "../../design-system";

export function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }): JSX.Element {
  return <Select label={label} value={value} onChange={(event) => onChange(event.target.value)} options={options.map(([optionValue, optionLabel]) => ({ value: optionValue, label: optionLabel }))} />;
}

export function TextField({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }): JSX.Element {
  return <Input label={label} value={value} required={required} onChange={(event) => onChange(event.target.value)} />;
}
