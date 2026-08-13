import type { ReactNode } from "react";

export function DropdownMenu({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <details className="ui-dropdown">
      <summary>{label}</summary>
      <div>{children}</div>
    </details>
  );
}
