import { StatusBadge } from "../../../design-system";

export function SignatureStatusBadge({ status }: { status: string }): JSX.Element {
  return <StatusBadge status={status} label={status} />;
}
