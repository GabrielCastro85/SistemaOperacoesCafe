import type { Operation } from "../../../../shared/types/domain";
import { formatCurrencyFromCents, formatDateOnlyBr, formatSacks } from "../../../../shared/utils/format";

export function ChargeOperationsTable({ operations }: { operations: Operation[] }): JSX.Element {
  return <div className="table">{operations.map((operation) => <div key={operation.id} className="table-row"><span>{formatDateOnlyBr(operation.operationDate)}</span><span>{formatSacks(operation.quantitySacks)} sc</span><span>{formatCurrencyFromCents(operation.serviceAmountCents)}</span></div>)}</div>;
}
