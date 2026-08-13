export interface TabItem<T extends string> {
  id: T;
  label: string;
}

export function Tabs<T extends string>({ items, active, onChange }: { items: Array<TabItem<T>>; active: T; onChange: (id: T) => void }): JSX.Element {
  return (
    <div className="ui-tabs" role="tablist">
      {items.map((item) => (
        <button key={item.id} role="tab" aria-selected={item.id === active} className={item.id === active ? "active" : ""} onClick={() => onChange(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}
