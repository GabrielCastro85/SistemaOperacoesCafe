import { Button, DataTable, PageHeader } from "../../design-system";
import { formatCurrencyFromCents, formatDateOnlyBr } from "../../../shared/utils/format";
import { useFinanceData } from "./hooks/useFinanceData";
import type { FinancePageProps } from "./types";

// Historico de pagamentos. Pagar uma conta e feito na lista de contas a pagar
// (botao "Pagar" na linha); antes esta tela pagava sempre a primeira conta aberta.
export function PayablePaymentsPage({ data }: FinancePageProps): JSX.Element {
  const { finance } = useFinanceData(data);
  return <section className="content-section"><PageHeader eyebrow="Pagamentos" title="Pagamentos feitos" description="Historico dos pagamentos registrados nas contas a pagar." actions={<Button variant="primary" onClick={() => { window.location.hash = "#/finance/payables"; }}>Pagar uma conta</Button>} /><DataTable rows={finance.payments} getRowKey={(row) => row.id} columns={[{ key: "date", header: "Data", render: (row) => formatDateOnlyBr(row.paymentDate) }, { key: "payee", header: "Favorecido", render: (row) => row.payeeNameSnapshot }, { key: "amount", header: "Valor", align: "right", render: (row) => formatCurrencyFromCents(row.amountCents) }, { key: "method", header: "Metodo", render: (row) => row.paymentMethod }, { key: "status", header: "Status", render: (row) => row.status }]} /></section>;
}
