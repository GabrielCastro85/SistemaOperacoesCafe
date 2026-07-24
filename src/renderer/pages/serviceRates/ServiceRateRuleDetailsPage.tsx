import type { ServiceRateRule } from "../../../shared/types/domain";
import { PageHeader } from "../../design-system";
import { formatCurrencyFromCents, formatDateOnlyBr } from "../../../shared/utils/format";
import { formatOperationScope } from "../../../shared/utils/operationLabels";

export function ServiceRateRuleDetailsPage({ rule }: { rule: ServiceRateRule | null }): JSX.Element {
  return <PageHeader eyebrow="Regra por saca" title={rule ? formatCurrencyFromCents(rule.rateValueCents) : "Regra"} description={rule ? `${formatOperationScope(rule.operationScope)} desde ${formatDateOnlyBr(rule.effectiveFrom)}` : "Selecione uma regra para visualizar detalhes."} />;
}
