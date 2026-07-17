import type { ClientLedgerEntry } from "../../../../shared/types/domain";
import { formatCurrencyFromCents } from "../../../../shared/utils/format";

export function ClientBalanceCards({ entries }: { entries: ClientLedgerEntry[] }): JSX.Element {
  const openCredits = entries.reduce((sum, entry) => sum + (entry.availableAmountCents ?? 0), 0);
  return <div className="metrics-grid"><article><span>Movimentos</span><strong>{entries.length}</strong></article><article><span>Credito disponivel</span><strong>{formatCurrencyFromCents(openCredits)}</strong></article></div>;
}
