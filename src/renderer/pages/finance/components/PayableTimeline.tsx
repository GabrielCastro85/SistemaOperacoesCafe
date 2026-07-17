import type { PayableStatusHistory } from "../../../../shared/types/domain";
import { Timeline } from "../../../design-system";

export function PayableTimeline({ history }: { history: PayableStatusHistory[] }): JSX.Element {
  return <Timeline items={history.map((item) => ({ id: item.id, title: `${item.previousStatus ?? "Inicio"} -> ${item.newStatus}`, meta: item.reason ?? item.changedAt }))} />;
}
