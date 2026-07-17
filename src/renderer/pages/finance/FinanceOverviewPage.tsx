import { Button, PageHeader, PageSection } from "../../design-system";
import { FinancialProjection } from "./components/FinancialProjection";
import { FinancialSummaryCards } from "./components/FinancialSummaryCards";
import { PayablesTable } from "./components/PayablesTable";
import { useFinanceData } from "./hooks/useFinanceData";
import type { FinancePageProps } from "./types";

export function FinanceOverviewPage({ data }: FinancePageProps): JSX.Element {
  const { finance } = useFinanceData(data);
  const upcoming = finance.payables.filter((item) => (item.openAmountCents ?? 0) > 0).slice(0, 8);
  return (
    <section className="content-section">
      <PageHeader eyebrow="Financeiro" title="Financeiro" description="Visao gerencial de contas a pagar, recebimentos previstos e resultado projetado." actions={<><Button variant="primary" onClick={() => { window.location.hash = "#/finance/payables/new"; }}>Nova conta a pagar</Button><Button onClick={() => { window.location.hash = "#/finance/payments"; }}>Registrar pagamento</Button></>} />
      <FinancialSummaryCards summary={finance.summary} />
      <FinancialProjection summary={finance.summary} />
      <PageSection title="Vencimentos proximos" description="Contas abertas ordenadas para acompanhamento operacional."><PayablesTable payables={upcoming} categories={finance.categories} costCenters={finance.costCenters} legalEntities={data.legalEntities} locations={data.locations} onOpen={(id) => { window.location.hash = `#/finance/payables/${id}`; }} /></PageSection>
    </section>
  );
}
