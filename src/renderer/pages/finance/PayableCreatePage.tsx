import { useState } from "react";
import { Alert, PageHeader } from "../../design-system";
import { createPayableFromForm } from "./financeActions";
import { PayableWizard } from "./forms/PayableWizard";
import { useFinanceData } from "./hooks/useFinanceData";
import { usePayableDraftForm } from "./hooks/usePayableDraftForm";
import type { FinancePageProps } from "./types";

export function PayableCreatePage({ data }: FinancePageProps): JSX.Element {
  const { finance, reload } = useFinanceData(data);
  const { form, setForm } = usePayableDraftForm();
  const [message, setMessage] = useState<string | null>(null);
  async function submit(): Promise<void> {
    await createPayableFromForm(data, { ...form, categoryId: form.categoryId || finance.categories[0]?.id || "" }, true);
    setMessage("Conta criada e confirmada.");
    await reload();
  }
  return <section className="content-section"><PageHeader eyebrow="Contas a pagar" title="Nova conta a pagar" description="Wizard em cinco etapas: identificacao, valores, rateio, anexos e revisao." />{message ? <Alert variant="success" title={message} /> : null}<PayableWizard form={{ ...form, categoryId: form.categoryId || finance.categories[0]?.id || "" }} categories={finance.categories} costCenters={finance.costCenters} onChange={setForm} onSubmit={() => void submit()} /></section>;
}
