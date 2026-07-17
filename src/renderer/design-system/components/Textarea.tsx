import type { TextareaHTMLAttributes } from "react";
import { FormField } from "./FormField";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string | null;
  hint?: string;
}

export function Textarea({ label, error, hint, required, ...props }: TextareaProps): JSX.Element {
  return (
    <FormField label={label} error={error} hint={hint} required={required}>
      <textarea className="ui-input" required={required} {...props} />
    </FormField>
  );
}
