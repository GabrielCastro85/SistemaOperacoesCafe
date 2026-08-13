export function Breadcrumb({ items }: { items: Array<{ label: string; onClick?: () => void }> }): JSX.Element {
  return (
    <nav className="ui-breadcrumb" aria-label="Caminho">
      {items.map((item, index) => (
        <button key={`${item.label}-${index}`} type="button" disabled={!item.onClick} onClick={item.onClick}>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
