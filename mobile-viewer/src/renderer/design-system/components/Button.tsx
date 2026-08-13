import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = "secondary", loading = false, icon, children, disabled, className = "", type = "button", ...props }: ButtonProps): JSX.Element {
  return (
    <button type={type} className={`ui-button ui-button--${variant} ${className}`} disabled={disabled || loading} {...props}>
      {loading ? <span className="ui-spinner" aria-hidden="true" /> : icon ? <span className="ui-button__icon">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
