import type { ClientLedgerEntry } from "../../../shared/types/domain";
import { PageHeader } from "../../design-system";
import { formatCurrencyFromCents, formatDateOnlyBr } from "../../../shared/utils/format";

export function ClientLedgerDetailsPage({ entry }: { entry: ClientLedgerEntry | null }): JSX.Element {
  return <PageHeader eyebrow="Conta-corrente" title={entry?.description ?? "Movimento"} description={entry ? `${formatDateOnlyBr(entry.entryDate)} - ${formatCurrencyFromCents(entry.amountCents)}` : "Selecione um movimento para visualizar detalhes."} />;
}
