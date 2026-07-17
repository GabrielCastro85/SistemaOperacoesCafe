import type { ReactNode } from "react";
import { Button } from "./Button";

export function FilterBar({ children, activeCount = 0, onClear }: { children: ReactNode; activeCount?: number; onClear?: () => void }): JSX.Element {
  return (
    <div className="ui-filter-bar">
      <div>{children}</div>
      <span>{activeCount} filtro(s) ativo(s)</span>
      {onClear ? <Button variant="ghost" onClick={onClear}>Limpar</Button> : null}
    </div>
  );
}
