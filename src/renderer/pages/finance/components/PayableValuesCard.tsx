import type { AccountPayable } from "../../../../shared/types/domain";
import { Card } from "../../../design-system";
import { formatCurrencyFromCents } from "../../../../shared/utils/format";

export function PayableValuesCard({ payable }: { payable: AccountPayable | null }): JSX.Element {
  return <Card title="Valores"><p>Original: {formatCurrencyFromCents(payable?.originalAmountCents ?? 0)}</p><p>Descontos: {formatCurrencyFromCents(payable?.discountCents ?? 0)}</p><p>Juros/multa/acrescimos: {formatCurrencyFromCents((payable?.interestCents ?? 0) + (payable?.penaltyCents ?? 0) + (payable?.otherAdditionsCents ?? 0))}</p><p>Final: {formatCurrencyFromCents(payable?.finalAmountCents ?? 0)}</p><p>Pago: {formatCurrencyFromCents(payable?.paidAmountCents ?? 0)}</p></Card>;
}
