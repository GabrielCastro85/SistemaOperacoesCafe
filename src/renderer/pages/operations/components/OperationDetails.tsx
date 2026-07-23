import type { Operation } from "../../../../shared/types/domain";
import { formatOperationScope } from "../../../../shared/utils/operationLabels";

export function OperationDetails({ operation }: { operation: Operation }): JSX.Element {
  return <div className="detail-panel"><h3>Operação</h3><p>{operation.operationType} / {formatOperationScope(operation.operationScope)} - {operation.quantitySacks} sacas.</p></div>;
}
