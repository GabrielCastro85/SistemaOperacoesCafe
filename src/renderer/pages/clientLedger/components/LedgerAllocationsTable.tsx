import type { ClientCreditAllocation } from "../../../../shared/types/domain";
import { formatCurrencyFromCents } from "../../../../shared/utils/format";

export function LedgerAllocationsTable({ allocations }: { allocations: ClientCreditAllocation[] }): JSX.Element {
  return <div className="table">{allocations.map((allocation) => <div key={allocation.id} className="table-row"><span>{allocation.allocatedAt}</span><span>{allocation.clientChargeId}</span><span>{formatCurrencyFromCents(allocation.amountCents)}</span></div>)}</div>;
}
