import type { ReactNode } from "react";
import type { StatusTone } from "../../types/ui";
import { formatStatusLabel } from "../../../shared/utils/statusLabels";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: StatusTone }): JSX.Element {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>;
}

const statusToneMap: Record<string, StatusTone> = {
  DRAFT: "neutral",
  PENDING: "warning",
  PENDING_REVIEW: "warning",
  CONFIRMED: "success",
  ISSUED: "info",
  SENT_FOR_SIGNATURE: "accent",
  SIGNED: "success",
  PAID: "success",
  PARTIAL: "warning",
  OVERDUE: "danger",
  CANCELLED: "danger",
  REPLACED: "neutral",
  VALID: "success",
  WARNING: "warning",
  DUPLICATE: "warning",
  ERROR: "danger",
  IMPORTED: "success",
  SKIPPED: "neutral",
  REVERTED: "neutral"
};

export function StatusBadge({ status, label }: { status: string; label?: string }): JSX.Element {
  return <Badge tone={statusToneMap[status] ?? "neutral"}>{label ?? formatStatusLabel(status)}</Badge>;
}
