import { PageHeader } from "../../design-system";
import { InstallmentsTable } from "./components/InstallmentsTable";
import { useFinanceData } from "./hooks/useFinanceData";
import type { FinancePageProps } from "./types";

export function InstallmentGroupDetailsPage({ data, id }: FinancePageProps & { id: string | null }): JSX.Element {
  const { finance } = useFinanceData(data);
  return <section className="content-section"><PageHeader eyebrow="Parcelamento" title="Detalhe do parcelamento" description="Parcelas, pagamentos, saldo e status." /><InstallmentsTable payables={finance.payables.filter((item) => !id || item.installmentGroupId === id)} /></section>;
}
