import type { Operation } from "../../../../shared/types/domain";
import { formatCurrencyFromCents } from "../../../../shared/utils/format";

export function ChargeOperationsTable({ operations }: { operations: Operation[] }): JSX.Element {
  return <div className="table">{operations.map((operation) => <div key={operation.id} className="table-row"><span>{operation.operationDate}</span><span>{operation.quantitySacks} sc</span><span>{formatCurrencyFromCents(operation.serviceAmountCents)}</span></div>)}</div>;
}
