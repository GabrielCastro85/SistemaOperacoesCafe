import type { ReactNode } from "react";

export function SetupLayout({ children }: { children: ReactNode }): JSX.Element {
  return <main className="setup-layout">{children}</main>;
}
