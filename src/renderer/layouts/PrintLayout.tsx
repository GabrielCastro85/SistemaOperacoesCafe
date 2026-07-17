import type { ReactNode } from "react";

export function PrintLayout({ children }: { children: ReactNode }): JSX.Element {
  return <main className="print-layout">{children}</main>;
}
