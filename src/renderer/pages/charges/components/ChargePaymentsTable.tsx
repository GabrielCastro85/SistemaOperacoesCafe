import type { ClientPaymentAllocation } from "../../../../shared/types/domain";
import { formatCurrencyFromCents } from "../../../../shared/utils/format";

export function ChargePaymentsTable({ payments }: { payments: ClientPaymentAllocation[] }): JSX.Element {
  return <div className="table">{payments.map((payment) => <div key={payment.id} className="table-row"><span>{payment.allocatedAt}</span><span>{payment.clientPaymentId}</span><span>{formatCurrencyFromCents(payment.amountCents)}</span></div>)}</div>;
}
