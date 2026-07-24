import type { DealConfirmationStatusHistory } from "../../../../shared/types/domain";
import { formatDateBr } from "../../../../shared/utils/format";

export function ConfirmationTimeline({ history }: { history: DealConfirmationStatusHistory[] }): JSX.Element {
  return <ol className="timeline">{history.map((item) => <li key={item.id}><strong>{item.newStatus}</strong><span>{formatDateBr(item.changedAt)}</span></li>)}</ol>;
}
