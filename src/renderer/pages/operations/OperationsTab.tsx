import type { Operation } from "../../../shared/types/domain";
import { OperationTable } from "./components/OperationTable";

export function OperationsTab({ operations }: { operations: Operation[] }): JSX.Element {
  return <OperationTable operations={operations} />;
}
