import type { ClientChargeDetail } from "../../../shared/types/domain";
import { PageHeader } from "../../design-system";
import { formatCurrencyFromCents } from "../../../shared/utils/format";

export function ChargeDetailsPage({ detail }: { detail: ClientChargeDetail | null }): JSX.Element {
  return <PageHeader eyebrow="Cobranca" title={detail?.charge.chargeNumber ?? "Detalhe da cobranca"} description={detail ? `${detail.charge.status} - ${formatCurrencyFromCents(detail.charge.finalAmountCents)}` : "Selecione uma cobranca para abrir os detalhes."} />;
}
