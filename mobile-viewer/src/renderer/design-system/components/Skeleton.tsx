export function Skeleton({ lines = 3 }: { lines?: number }): JSX.Element {
  return (
    <div className="ui-skeleton" aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => <span key={index} />)}
    </div>
  );
}
