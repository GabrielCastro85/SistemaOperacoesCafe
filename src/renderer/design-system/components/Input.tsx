import type { InputHTMLAttributes } from "react";
import { FormField } from "./FormField";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  hint?: string;
}

export function Input({ label, error, hint, required, autoComplete = "off", ...props }: InputProps): JSX.Element {
  return (
    <FormField label={label} error={error} hint={hint} required={required}>
      <input className="ui-input" required={required} autoComplete={autoComplete} {...props} />
    </FormField>
  );
}
