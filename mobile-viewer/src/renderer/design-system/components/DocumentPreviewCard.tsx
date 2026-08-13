import { Button } from "./Button";

export function DocumentPreviewCard({ title, type, hash, isCurrent, onOpen, onReveal }: { title: string; type: string; hash?: string | null; isCurrent?: boolean; onOpen?: () => void; onReveal?: () => void }): JSX.Element {
  return (
    <article className="ui-document-card">
      <span>{type}</span>
      <strong>{title}</strong>
      {hash ? <code>{hash.slice(0, 16)}...</code> : null}
      {isCurrent ? <small>Versão atual</small> : <small>Histórica</small>}
      <div className="inline-actions">
        {onOpen ? <Button onClick={onOpen}>Abrir</Button> : null}
        {onReveal ? <Button variant="ghost" onClick={onReveal}>Pasta</Button> : null}
      </div>
    </article>
  );
}
