import type { ClientChargeAdjustment } from "../../../../shared/types/domain";
import { formatCurrencyFromCents } from "../../../../shared/utils/format";

export function ChargeAdjustmentsTable({ adjustments }: { adjustments: ClientChargeAdjustment[] }): JSX.Element {
  return <div className="table">{adjustments.map((adjustment) => <div key={adjustment.id} className="table-row"><span>{adjustment.description}</span><span>{adjustment.effect}</span><span>{formatCurrencyFromCents(adjustment.amountCents)}</span></div>)}</div>;
}
