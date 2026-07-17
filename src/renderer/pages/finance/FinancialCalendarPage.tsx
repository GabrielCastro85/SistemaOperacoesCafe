import { CalendarGrid, PageHeader } from "../../design-system";
import { useFinanceData } from "./hooks/useFinanceData";
import type { FinancePageProps } from "./types";

export function FinancialCalendarPage({ data }: FinancePageProps): JSX.Element {
  const { finance } = useFinanceData(data);
  return <section className="content-section"><PageHeader eyebrow="Calendario" title="Calendario financeiro" description="Lista temporal de vencimentos, recorrencias e pagamentos parciais." /><CalendarGrid items={finance.payables.map((item) => ({ id: item.id, date: item.dueDate, title: item.description, status: item.status }))} /></section>;
}
