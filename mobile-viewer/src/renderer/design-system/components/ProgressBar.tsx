export function ProgressBar({ value, label }: { value: number; label?: string }): JSX.Element {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="ui-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped} aria-label={label}>
      <span style={{ width: `${clamped}%` }} />
    </div>
  );
}
