import { useState } from "react";
import { Button, PageHeader, PageSection } from "../../design-system";
import { createRecurringFromForm } from "./financeActions";
import { RecurringTemplatesTable } from "./components/RecurringTemplatesTable";
import { RecurringPayableForm } from "./forms/RecurringPayableForm";
import { useFinanceData } from "./hooks/useFinanceData";
import { usePayableDraftForm } from "./hooks/usePayableDraftForm";
import type { FinancePageProps } from "./types";

export function RecurringPayablesPage({ data }: FinancePageProps): JSX.Element {
  const { finance, reload } = useFinanceData(data);
  const { form, setForm } = usePayableDraftForm();
  const [message, setMessage] = useState<string | null>(null);
  async function submit(): Promise<void> {
    await createRecurringFromForm(data, { ...form, categoryId: form.categoryId || finance.categories[0]?.id || "" });
    setMessage("Recorrencia criada e proximas contas geradas.");
    await reload();
  }
  return <section className="content-section"><PageHeader eyebrow="Recorrencias" title="Contas recorrentes" description="Templates geram novas contas sem alterar historico ja confirmado." actions={<Button onClick={() => void submit()}>Gerar recorrencia</Button>} />{message ? <p className="success">{message}</p> : null}<PageSection title="Novo template" description="Configuracao visual para despesas periodicas."><RecurringPayableForm description={form.description} amount={form.amount} dueDate={form.dueDate} categoryId={form.categoryId || finance.categories[0]?.id || ""} costCenterId={form.costCenterId} categories={finance.categories} costCenters={finance.costCenters} onDescription={(value) => setForm({ ...form, description: value })} onAmount={(value) => setForm({ ...form, amount: value })} onDueDate={(value) => setForm({ ...form, dueDate: value })} onCategory={(value) => setForm({ ...form, categoryId: value })} onCostCenter={(value) => setForm({ ...form, costCenterId: value })} /></PageSection><RecurringTemplatesTable templates={finance.recurring} /></section>;
}
