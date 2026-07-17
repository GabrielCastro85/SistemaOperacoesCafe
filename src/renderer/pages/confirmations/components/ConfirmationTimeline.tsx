import type { DealConfirmationStatusHistory } from "../../../../shared/types/domain";

export function ConfirmationTimeline({ history }: { history: DealConfirmationStatusHistory[] }): JSX.Element {
  return <ol className="timeline">{history.map((item) => <li key={item.id}><strong>{item.newStatus}</strong><span>{item.changedAt}</span></li>)}</ol>;
}
