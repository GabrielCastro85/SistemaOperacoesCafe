import type { ReactNode } from "react";
import { Button } from "./Button";

export function Drawer({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }): JSX.Element | null {
  if (!open) return null;
  return (
    <div className="ui-drawer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="ui-drawer__panel">
        <header><h2>{title}</h2><Button variant="ghost" onClick={onClose}>Fechar</Button></header>
        {children}
      </div>
    </div>
  );
}
