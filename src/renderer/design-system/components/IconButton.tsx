import type { ButtonHTMLAttributes, ReactNode } from "react";

export function IconButton({ label, icon, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: ReactNode }): JSX.Element {
  return (
    <button className={`ui-icon-button ${className}`} type="button" aria-label={label} title={label} {...props}>
      {icon}
    </button>
  );
}
