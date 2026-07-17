import type { DealConfirmationSummary } from "../../../../shared/types/domain";
import { formatCurrencyFromCents } from "../../../../shared/utils/format";

export function ConfirmationSummary({ summary }: { summary: DealConfirmationSummary | null }): JSX.Element {
  return (
    <div className="cards">
      <article><span>Confirmações</span><strong>{summary?.confirmations ?? 0}</strong></article>
      <article><span>Sacas</span><strong>{summary?.totalSacksDecimal ?? "0"}</strong></article>
      <article><span>Valor comercial</span><strong>{formatCurrencyFromCents(summary?.totalCommercialAmountCents ?? 0)}</strong></article>
      <article><span>Aguardando assinatura</span><strong>{summary?.waitingSignature ?? 0}</strong></article>
    </div>
  );
}
