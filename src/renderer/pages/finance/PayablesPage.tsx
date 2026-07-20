import { useState } from "react";
import { Card, FilterBar, PageHeader, Pagination, SearchInput } from "../../design-system";
import { requestTextInput } from "../../utils/dialogs";
import { createPayableFromForm } from "./financeActions";
import { QuickPayableForm } from "./forms/QuickPayableForm";
import { useFinanceData } from "./hooks/useFinanceData";
import { usePayableDraftForm } from "./hooks/usePayableDraftForm";
import { PayablesTable, payableMetrics } from "./components/PayablesTable";
import type { FinancePageProps } from "./types";

export function PayablesPage({ data }: FinancePageProps): JSX.Element {
  const { finance, reload } = useFinanceData(data);
  const { form, setForm, reset } = usePayableDraftForm();
  const [search, setSearch] = useState("");
  const filtered = finance.payables.filter((item) => item.description.toLowerCase().includes(search.toLowerCase()) || item.payeeNameSnapshot.toLowerCase().includes(search.toLowerCase()));
  async function submit(confirm: boolean): Promise<void> {
    await createPayableFromForm(data, { ...form, categoryId: form.categoryId || finance.categories[0]?.id || "" }, confirm);
    reset();
    await reload();
  }
  async function cancel(id: string): Promise<void> {
    const reason = await requestTextInput({ title: "Cancelar conta", label: "Motivo do cancelamento", required: true });
    if (reason) await window.operationsCafe.cancelAccountPayable(id, reason);
    await reload();
  }
  return (
    <section className="content-section">
      <PageHeader eyebrow="Contas a pagar" title="Contas a pagar" description="Controle de lancamentos, filtros, anexos e acoes de status." actions={<button className="primary" onClick={() => { window.location.hash = "#/finance/payables/new"; }}>Nova conta</button>} />
      <div className="cards">{payableMetrics(finance.payables).map((metric) => <Card key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></Card>)}</div>
      <FilterBar activeCount={search ? 1 : 0} onClear={() => setSearch("")}><SearchInput label="Busca" value={search} onChange={(event) => setSearch(event.target.value)} /></FilterBar>
      <QuickPayableForm form={{ ...form, categoryId: form.categoryId || finance.categories[0]?.id || "" }} categories={finance.categories} costCenters={finance.costCenters} onChange={setForm} onSubmit={() => void submit(true)} onDraft={() => void submit(false)} />
      <PayablesTable payables={filtered} categories={finance.categories} costCenters={finance.costCenters} legalEntities={data.legalEntities} locations={data.locations} onOpen={(id) => { window.location.hash = `#/finance/payables/${id}`; }} onConfirm={(id) => void window.operationsCafe.confirmAccountPayable(id).then(reload)} onPay={() => { window.location.hash = "#/finance/payments"; }} onCancel={(id) => void cancel(id)} />
      <Pagination page={1} pageCount={1} onPageChange={() => undefined} />
    </section>
  );
}
