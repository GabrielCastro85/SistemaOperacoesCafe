import type { Operation } from "../../../../shared/types/domain";

export function OperationDetails({ operation }: { operation: Operation }): JSX.Element {
  return <div className="detail-panel"><h3>Operação</h3><p>{operation.operationType} / {operation.operationScope} - {operation.quantitySacks} sacas.</p></div>;
}
