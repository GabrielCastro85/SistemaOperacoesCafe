import type { ReactNode } from "react";
import type { StatusTone } from "../../types/ui";

export function Alert({ tone, variant, title, children }: { tone?: StatusTone; variant?: StatusTone; title?: string; children?: ReactNode }): JSX.Element {
  const resolvedTone = tone ?? variant ?? "info";
  return (
    <div className={`ui-alert ui-alert--${resolvedTone}`} role={resolvedTone === "danger" ? "alert" : "status"}>
      {title ? <strong>{title}</strong> : null}
      {children ? <span>{children}</span> : null}
    </div>
  );
}
