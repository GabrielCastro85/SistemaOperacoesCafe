import type { ServiceRateRule } from "../../../../shared/types/domain";
import { StatusBadge } from "../../../design-system";

export function ServiceRateStatus({ rule }: { rule: ServiceRateRule }): JSX.Element {
  return <StatusBadge status={rule.isActive ? "ACTIVE" : "INACTIVE"} label={rule.isActive ? "Vigente" : "Inativa"} />;
}
