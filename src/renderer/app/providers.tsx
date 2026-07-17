import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }): JSX.Element {
  return <>{children}</>;
}
