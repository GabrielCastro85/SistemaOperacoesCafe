import { PageHeader } from "../../design-system";
import { RecurringTemplatesTable } from "./components/RecurringTemplatesTable";
import { useFinanceData } from "./hooks/useFinanceData";
import type { FinancePageProps } from "./types";

export function RecurringPayableDetailsPage({ data, id }: FinancePageProps & { id: string | null }): JSX.Element {
  const { finance } = useFinanceData(data);
  const selected = finance.recurring.filter((item) => !id || item.id === id);
  return <section className="content-section"><PageHeader eyebrow="Recorrencia" title={selected[0]?.description ?? "Detalhe da recorrencia"} description="Alterar o template nao altera contas historicas ja geradas." /><RecurringTemplatesTable templates={selected} /></section>;
}
