import type { ReactNode } from "react";
import type { StatusTone } from "../../types/ui";

export function Alert({ tone = "info", title, children }: { tone?: StatusTone; title?: string; children: ReactNode }): JSX.Element {
  return (
    <div className={`ui-alert ui-alert--${tone}`} role={tone === "danger" ? "alert" : "status"}>
      {title ? <strong>{title}</strong> : null}
      <span>{children}</span>
    </div>
  );
}
