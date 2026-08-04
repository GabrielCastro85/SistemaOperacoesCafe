import type { FinancialSummary } from "../../../../shared/types/domain";
import { formatCurrencyFromCents } from "../../../../shared/utils/format";
import { PageSection, ProgressBar } from "../../../design-system";

export function FinancialProjection({ summary }: { summary: FinancialSummary | null }): JSX.Element {
  const receivable = summary?.receivableOpenCents ?? 0;
  const payable = summary?.payableOpenCents ?? 0;
  const total = Math.max(receivable + payable, 1);

  return (
    <PageSection
      title="Entradas e saidas projetadas"
      description="Fluxo gerencial projetado, sem representar saldo bancario real."
    >
      <ProgressBar
        value={Math.round((receivable / total) * 100)}
        label={`Recebimentos previstos ${formatCurrencyFromCents(receivable)}`}
      />
      <ProgressBar
        value={Math.round((payable / total) * 100)}
        label={`Pagamentos previstos ${formatCurrencyFromCents(payable)}`}
      />
    </PageSection>
  );
}
