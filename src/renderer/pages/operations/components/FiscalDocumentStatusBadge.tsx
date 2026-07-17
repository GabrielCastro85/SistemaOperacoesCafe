import { StatusBadge } from "../../../design-system";

export function FiscalDocumentStatusBadge({ status }: { status: string }): JSX.Element {
  return <StatusBadge status={status} label={status} />;
}
