import { DefinitionList, PageHeader } from "../../design-system";
import { formatCurrencyFromCents, formatDateOnlyBr } from "../../../shared/utils/format";
import { useFinanceData } from "./hooks/useFinanceData";
import type { FinancePageProps } from "./types";

export function PayablePaymentDetailsPage({ data, id }: FinancePageProps & { id: string | null }): JSX.Element {
  const { finance } = useFinanceData(data);
  const payment = finance.payments.find((item) => item.id === id) ?? null;
  return <section className="content-section"><PageHeader eyebrow="Pagamento" title={payment?.payeeNameSnapshot ?? "Detalhe do pagamento"} description="Valor, alocacao e comprovantes vinculados." /><DefinitionList items={[{ label: "Data", value: formatDateOnlyBr(payment?.paymentDate) }, { label: "Valor", value: formatCurrencyFromCents(payment?.amountCents ?? 0) }, { label: "Metodo", value: payment?.paymentMethod ?? "-" }, { label: "Status", value: payment?.status ?? "-" }]} /></section>;
}
