import { Button } from "./Button";
import type { ReactNode } from "react";

export function EmptyState({ title, description, actionLabel, onAction, action }: { title: string; description: string; actionLabel?: string; onAction?: () => void; action?: ReactNode }): JSX.Element {
  return (
    <div className="ui-empty">
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
      {actionLabel && onAction ? <Button onClick={onAction}>{actionLabel}</Button> : null}
    </div>
  );
}
