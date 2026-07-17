import { useState } from "react";
import { Button, DataTable, PageHeader } from "../../design-system";
import { formatCurrencyFromCents } from "../../../shared/utils/format";
import { PayablePaymentForm } from "./forms/PayablePaymentForm";
import { useFinanceData } from "./hooks/useFinanceData";
import type { FinancePageProps } from "./types";

export function PayablePaymentsPage({ data }: FinancePageProps): JSX.Element {
  const { finance, organizationId, ownLegalEntityId, reload } = useFinanceData(data);
  const firstOpen = finance.payables.find((item) => (item.openAmountCents ?? 0) > 0);
  const [amount, setAmount] = useState("0");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState("");
  async function pay(): Promise<void> {
    if (!firstOpen) return;
    const cents = Number(amount || firstOpen.openAmountCents || 0);
    const payment = await window.operationsCafe.createPayablePayment({ organizationId, ownLegalEntityId, financialAccountId: accountId || null, paymentDate: date, amountCents: cents, paymentMethod: "PIX", transactionReference: null, payeeNameSnapshot: firstOpen.payeeNameSnapshot, notes: null, attachmentPath: null, attachmentHash: null });
    await window.operationsCafe.allocatePayablePayment({ payablePaymentId: payment.id, accountPayableId: firstOpen.id, amountCents: cents });
    await reload();
  }
  return <section className="content-section"><PageHeader eyebrow="Pagamentos" title="Pagamentos de contas" description="Registre pagamentos totais ou parciais; o backend recalcula saldos oficiais." actions={<Button variant="primary" onClick={() => void pay()} disabled={!firstOpen}>Registrar pagamento</Button>} /><PayablePaymentForm amount={amount} date={date} accountId={accountId} accounts={finance.accounts} onAmount={setAmount} onDate={setDate} onAccount={setAccountId} /><DataTable rows={finance.payments} getRowKey={(row) => row.id} columns={[{ key: "date", header: "Data", render: (row) => row.paymentDate }, { key: "payee", header: "Favorecido", render: (row) => row.payeeNameSnapshot }, { key: "amount", header: "Valor", align: "right", render: (row) => formatCurrencyFromCents(row.amountCents) }, { key: "method", header: "Metodo", render: (row) => row.paymentMethod }, { key: "status", header: "Status", render: (row) => row.status }]} /></section>;
}
