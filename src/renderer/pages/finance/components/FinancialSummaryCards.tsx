import type { FinancialSummary } from "../../../../shared/types/domain";
import { formatCurrencyFromCents } from "../../../../shared/utils/format";
import { Card } from "../../../design-system";

function SummaryCard({
  label,
  value,
  description
}: {
  label: string;
  value: string;
  description?: string;
}): JSX.Element {
  return (
    <div className="finance-summary-card">
      <Card>
        <span>{label}</span>
        <strong title={value}>{value}</strong>
        {description ? <small>{description}</small> : null}
      </Card>
    </div>
  );
}

export function FinancialSummaryCards({ summary }: { summary: FinancialSummary | null }): JSX.Element {
  return (
    <div className="cards finance-summary-cards">
      <SummaryCard
        label="Total a pagar no mês"
        value={formatCurrencyFromCents(summary?.payableThisMonthCents ?? 0)}
      />
      <SummaryCard
        label="Pago no mês"
        value={formatCurrencyFromCents(summary?.paidThisMonthCents ?? 0)}
      />
      <SummaryCard
        label="Saldo aberto"
        value={formatCurrencyFromCents(summary?.openCents ?? 0)}
      />
      <SummaryCard
        label="Vencido"
        value={formatCurrencyFromCents(summary?.overdueCents ?? 0)}
      />
      <SummaryCard
        label="Próximos 7 dias"
        value={formatCurrencyFromCents(summary?.dueNext7DaysCents ?? 0)}
      />
      <SummaryCard
        label="Recebimentos previstos"
        value={formatCurrencyFromCents(summary?.receivableOpenCents ?? 0)}
      />
      <SummaryCard
        label="Pagamentos previstos"
        value={formatCurrencyFromCents(summary?.payableOpenCents ?? 0)}
      />
      <SummaryCard
        label="Resultado projetado"
        value={formatCurrencyFromCents(summary?.projectedResultCents ?? 0)}
        description="Fluxo gerencial projetado, não saldo bancário real."
      />
    </div>
  );
}
