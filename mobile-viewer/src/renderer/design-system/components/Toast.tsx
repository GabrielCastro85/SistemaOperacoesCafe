import type { ReactNode } from "react";

export function Toast({ children }: { children: ReactNode }): JSX.Element {
  return <div className="ui-toast" role="status" aria-live="polite">{children}</div>;
}
