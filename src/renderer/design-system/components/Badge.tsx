import type { ReactNode } from "react";
import type { StatusTone } from "../../types/ui";

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
  REPLACED: "neutral"
};

export function StatusBadge({ status, label }: { status: string; label?: string }): JSX.Element {
  return <Badge tone={statusToneMap[status] ?? "neutral"}>{label ?? status}</Badge>;
}
