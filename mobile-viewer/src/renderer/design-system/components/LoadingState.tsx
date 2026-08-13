export function LoadingState({ label = "Carregando dados..." }: { label?: string }): JSX.Element {
  return (
    <div className="ui-loading" role="status" aria-live="polite">
      <span className="ui-spinner" aria-hidden="true" />
      {label}
    </div>
  );
}
