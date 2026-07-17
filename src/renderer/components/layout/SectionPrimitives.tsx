import type { ReactNode } from "react";

export function AdminBlock({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section className="admin-block">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function FormGrid({ children }: { children: ReactNode }): JSX.Element {
  return <div className="form-grid">{children}</div>;
}

export function Toolbar({ children }: { children: ReactNode }): JSX.Element {
  return <div className="toolbar">{children}</div>;
}
