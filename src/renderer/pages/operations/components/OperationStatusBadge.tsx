import { StatusBadge } from "../../../design-system";

export function OperationStatusBadge({ status }: { status: string }): JSX.Element {
  return <StatusBadge status={status} label={status} />;
}
