import { Button, PageHeader, PageSection } from "../../design-system";
import { requestTextInput } from "../../utils/dialogs";
import { FinancialProjection } from "./components/FinancialProjection";
import { FinancialSummaryCards } from "./components/FinancialSummaryCards";
import { PayablesTable } from "./components/PayablesTable";
import { useFinanceData } from "./hooks/useFinanceData";
import type { FinancePageProps } from "./types";

export function FinanceOverviewPage({ data }: FinancePageProps): JSX.Element {
  const { finance, reload } = useFinanceData(data);
  const upcoming = finance.payables.filter((item) => (item.openAmountCents ?? 0) > 0).slice(0, 8);
  async function cancel(id: string): Promise<void> {
    const reason = await requestTextInput({ title: "Cancelar conta", label: "Motivo do cancelamento", required: true });
    if (reason) await window.operationsCafe.cancelAccountPayable(id, reason);
    await reload();
  }
  return (
    <section className="content-section">
      <PageHeader eyebrow="Financeiro" title="Financeiro" description="Visao gerencial de contas a pagar, recebimentos previstos e resultado projetado." actions={<><Button variant="primary" onClick={() => { window.location.hash = "#/finance/payables/new"; }}>Nova conta a pagar</Button><Button onClick={() => { window.location.hash = "#/finance/payments"; }}>Registrar pagamento</Button></>} />
      <FinancialSummaryCards summary={finance.summary} />
      <FinancialProjection summary={finance.summary} />
      <PageSection title="Vencimentos proximos" description="Contas abertas ordenadas para acompanhamento operacional."><PayablesTable payables={upcoming} categories={finance.categories} costCenters={finance.costCenters} legalEntities={data.legalEntities} locations={data.locations} onOpen={(id) => { window.location.hash = `#/finance/payables/${id}`; }} onConfirm={(id) => void window.operationsCafe.confirmAccountPayable(id).then(reload)} onPay={() => { window.location.hash = "#/finance/payments"; }} onCancel={(id) => void cancel(id)} /></PageSection>
    </section>
  );
}
