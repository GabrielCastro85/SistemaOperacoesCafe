import type { ReactNode } from "react";

export function FormField({ label, hint, error, required, children }: { label: string; hint?: string; error?: string | null; required?: boolean; children: ReactNode }): JSX.Element {
  return (
    <label className="ui-field">
      <span className="ui-field__label">
        {label}
        {required ? <strong aria-label="obrigatório">*</strong> : null}
      </span>
      {children}
      {hint ? <span className="ui-field__hint">{hint}</span> : null}
      {error ? <span className="ui-field__error">{error}</span> : null}
    </label>
  );
}
