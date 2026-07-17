import type { ReactNode } from "react";

export function Card({ title, eyebrow, children, actions }: { title?: string; eyebrow?: string; children: ReactNode; actions?: ReactNode }): JSX.Element {
  return (
    <section className="ui-card">
      {title || eyebrow || actions ? (
        <header className="ui-card__header">
          <div>
            {eyebrow ? <span className="ui-eyebrow">{eyebrow}</span> : null}
            {title ? <h2>{title}</h2> : null}
          </div>
          {actions ? <div className="ui-card__actions">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
