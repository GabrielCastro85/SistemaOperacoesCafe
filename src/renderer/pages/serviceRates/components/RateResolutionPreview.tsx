import type { ServiceRateRule } from "../../../../shared/types/domain";
import { formatCurrencyFromCents } from "../../../../shared/utils/format";

export function RateResolutionPreview({ rule }: { rule: ServiceRateRule | null }): JSX.Element {
  return <div className="empty-state">{rule ? `${formatCurrencyFromCents(rule.rateValueCents)} por saca` : "Nenhuma regra selecionada."}</div>;
}
