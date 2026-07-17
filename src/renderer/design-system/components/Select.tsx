import type { SelectHTMLAttributes } from "react";
import type { SelectOption } from "../../types/ui";
import { FormField } from "./FormField";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  error?: string | null;
  hint?: string;
}

export function Select({ label, options, error, hint, required, ...props }: SelectProps): JSX.Element {
  return (
    <FormField label={label} error={error} hint={hint} required={required}>
      <select className="ui-input" required={required} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}
