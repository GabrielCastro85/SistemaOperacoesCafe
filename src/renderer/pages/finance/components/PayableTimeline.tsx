import type { PayableStatusHistory } from "../../../../shared/types/domain";
import { formatStatusLabel } from "../../../../shared/utils/statusLabels";
import { Timeline } from "../../../design-system";

export function PayableTimeline({ history }: { history: PayableStatusHistory[] }): JSX.Element {
  return <Timeline items={history.map((item) => ({
    id: item.id,
    title: `${item.previousStatus ? formatStatusLabel(item.previousStatus) : "Início"} → ${formatStatusLabel(item.newStatus)}`,
    meta: item.reason ?? item.changedAt
  }))} />;
}
