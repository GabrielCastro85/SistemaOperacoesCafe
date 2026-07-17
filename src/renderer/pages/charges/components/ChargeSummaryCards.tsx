import type { BillingSummary } from "../../../../shared/types/domain";
import { formatCurrencyFromCents } from "../../../../shared/utils/format";

export function ChargeSummaryCards({ summary }: { summary: BillingSummary | null }): JSX.Element {
  return (
    <div className="metrics-grid">
      <article><span>Operacoes nao cobradas</span><strong>{summary?.unbilledOperations ?? 0}</strong></article>
      <article><span>Em aberto</span><strong>{formatCurrencyFromCents(summary?.openCents ?? 0)}</strong></article>
      <article><span>Vencidas</span><strong>{formatCurrencyFromCents(summary?.overdueCents ?? 0)}</strong></article>
    </div>
  );
}
