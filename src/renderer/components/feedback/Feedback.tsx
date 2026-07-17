export function Feedback({ message }: { message: string | null }): JSX.Element | null {
  if (!message) return null;
  return <p className="feedback" role="status" aria-live="polite">{message}</p>;
}
