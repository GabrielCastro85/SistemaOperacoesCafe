import type { PayablePaymentAllocation } from "../../../../shared/types/domain";
import { DataTable } from "../../../design-system";
import { formatCurrencyFromCents } from "../../../../shared/utils/format";

export function PayablePayments({ payments }: { payments: PayablePaymentAllocation[] }): JSX.Element {
  return <DataTable rows={payments} getRowKey={(row) => row.id} columns={[{ key: "date", header: "Data", render: (row) => row.allocatedAt }, { key: "payment", header: "Pagamento", render: (row) => row.payablePaymentId }, { key: "amount", header: "Valor", align: "right", render: (row) => formatCurrencyFromCents(row.amountCents) }]} />;
}
