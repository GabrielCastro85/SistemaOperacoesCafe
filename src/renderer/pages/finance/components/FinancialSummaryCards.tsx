import type { FinancialSummary } from "../../../../shared/types/domain";
import { formatCurrencyFromCents } from "../../../../shared/utils/format";
import { Card } from "../../../design-system";

export function FinancialSummaryCards({ summary }: { summary: FinancialSummary | null }): JSX.Element {
  return (
    <div className="cards">
      <Card><span>Total a pagar no mes</span><strong>{formatCurrencyFromCents(summary?.payableThisMonthCents ?? 0)}</strong></Card>
      <Card><span>Pago no mes</span><strong>{formatCurrencyFromCents(summary?.paidThisMonthCents ?? 0)}</strong></Card>
      <Card><span>Saldo aberto</span><strong>{formatCurrencyFromCents(summary?.openCents ?? 0)}</strong></Card>
      <Card><span>Vencido</span><strong>{formatCurrencyFromCents(summary?.overdueCents ?? 0)}</strong></Card>
      <Card><span>Proximos 7 dias</span><strong>{formatCurrencyFromCents(summary?.dueNext7DaysCents ?? 0)}</strong></Card>
      <Card><span>Recebimentos previstos</span><strong>{formatCurrencyFromCents(summary?.receivableOpenCents ?? 0)}</strong></Card>
      <Card><span>Pagamentos previstos</span><strong>{formatCurrencyFromCents(summary?.payableOpenCents ?? 0)}</strong></Card>
      <Card><span>Resultado projetado</span><strong>{formatCurrencyFromCents(summary?.projectedResultCents ?? 0)}</strong><small>Fluxo gerencial projetado, nao saldo bancario real.</small></Card>
    </div>
  );
}
