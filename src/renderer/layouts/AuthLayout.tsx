import type { ReactNode } from "react";

export function AuthLayout({ children }: { children: ReactNode }): JSX.Element {
  return <main className="auth-layout">{children}</main>;
}
