import type { ReactNode } from "react";
import { Button } from "./Button";

export function ConfirmationDialog({ open, title, children, confirmLabel = "Confirmar", onConfirm, onCancel }: { open: boolean; title: string; children?: ReactNode; confirmLabel?: string; onConfirm: () => void; onCancel: () => void }): JSX.Element | null {
  if (!open) return null;
  return (
    <div className="ui-dialog" role="dialog" aria-modal="true" aria-label={title}>
      <section>
        <h2>{title}</h2>
        <div>{children}</div>
        <footer><Button onClick={onCancel}>Cancelar</Button><Button variant="primary" onClick={onConfirm}>{confirmLabel}</Button></footer>
      </section>
    </div>
  );
}
