import { Button, PageHeader, PageSection } from "../../design-system";
import { createInstallmentsFromForm } from "./financeActions";
import { InstallmentsTable } from "./components/InstallmentsTable";
import { InstallmentGroupForm } from "./forms/InstallmentGroupForm";
import { useFinanceData } from "./hooks/useFinanceData";
import { usePayableDraftForm } from "./hooks/usePayableDraftForm";
import type { FinancePageProps } from "./types";

export function InstallmentGroupsPage({ data }: FinancePageProps): JSX.Element {
  const { finance, reload } = useFinanceData(data);
  const { form, setForm } = usePayableDraftForm();
  async function submit(): Promise<void> {
    await createInstallmentsFromForm(data, { ...form, categoryId: form.categoryId || finance.categories[0]?.id || "" }, 3);
    await reload();
  }
  return <section className="content-section"><PageHeader eyebrow="Parcelamentos" title="Parcelamentos" description="Parcelas com soma preservada em centavos pelo backend." actions={<Button onClick={() => void submit()}>Criar parcelamento</Button>} /><PageSection title="Novo parcelamento" description="Previa simples antes da confirmacao."><InstallmentGroupForm description={form.description} total={form.amount} firstDueDate={form.dueDate} count="3" onDescription={(value) => setForm({ ...form, description: value })} onTotal={(value) => setForm({ ...form, amount: value })} onFirstDueDate={(value) => setForm({ ...form, dueDate: value })} onCount={() => undefined} /></PageSection><InstallmentsTable payables={finance.payables} /></section>;
}
