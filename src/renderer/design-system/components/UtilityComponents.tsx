import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { Button } from "./Button";
import { Input } from "./Input";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string; error?: string | null; hint?: string };

export function MonthInput(props: InputProps): JSX.Element {
  return <Input type="month" {...props} />;
}

export function PercentageInput(props: InputProps): JSX.Element {
  return <Input inputMode="decimal" placeholder="0,00%" {...props} />;
}

export interface TreeViewItem {
  id: string;
  label: ReactNode;
  meta?: ReactNode;
  parentId?: string | null;
  isActive?: boolean;
}

export function TreeView({ items, empty = "Nenhum registro encontrado." }: { items: TreeViewItem[]; empty?: string }): JSX.Element {
  if (items.length === 0) return <div className="ui-empty">{empty}</div>;
  return (
    <div className="ui-tree" role="tree">
      {items.map((item) => (
        <div key={item.id} className="ui-tree__item" role="treeitem" aria-level={item.parentId ? 2 : 1}>
          <span>{item.parentId ? "↳ " : ""}{item.label}</span>
          {item.meta ? <small>{item.meta}</small> : null}
        </div>
      ))}
    </div>
  );
}

export function Timeline({ items }: { items: Array<{ id: string; title: string; meta?: string | null }> }): JSX.Element {
  return <ol className="ui-timeline">{items.map((item) => <li key={item.id}><strong>{item.title}</strong>{item.meta ? <span>{item.meta}</span> : null}</li>)}</ol>;
}

export function CalendarGrid({ items }: { items: Array<{ id: string; date: string; title: string; status?: string }> }): JSX.Element {
  return (
    <div className="ui-calendar" role="list" aria-label="Calendario financeiro">
      {items.map((item) => (
        <article key={item.id} role="listitem">
          <span>{item.date}</span>
          <strong>{item.title}</strong>
          {item.status ? <small>{item.status}</small> : null}
        </article>
      ))}
    </div>
  );
}

export function DefinitionList({ items }: { items: Array<{ label: string; value: ReactNode }> }): JSX.Element {
  return <dl className="ui-definition-list">{items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>;
}

export function CopyButton({ value, children = "Copiar" }: ButtonHTMLAttributes<HTMLButtonElement> & { value: string }): JSX.Element {
  return <Button type="button" onClick={() => void navigator.clipboard?.writeText(value)}>{children}</Button>;
}

export function PageSection({ title, description, children, actions }: { title: string; description?: string; children: ReactNode; actions?: ReactNode }): JSX.Element {
  return (
    <section className="ui-page-section">
      <header>
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="ui-page-section__actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function SplitButton({ primaryLabel, secondaryLabel, onPrimary, onSecondary }: { primaryLabel: string; secondaryLabel: string; onPrimary: () => void; onSecondary: () => void }): JSX.Element {
  return <div className="ui-split-button"><Button variant="primary" onClick={onPrimary}>{primaryLabel}</Button><Button onClick={onSecondary}>{secondaryLabel}</Button></div>;
}
