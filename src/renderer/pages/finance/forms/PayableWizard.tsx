import { useState } from "react";
import type { CostCenter, ExpenseCategory } from "../../../../shared/types/domain";
import { Button, Stepper } from "../../../design-system";
import type { PayableDraftFormState } from "../hooks/usePayableDraftForm";
import { PayableAllocationStep } from "./PayableAllocationStep";
import { PayableAttachmentsStep } from "./PayableAttachmentsStep";
import { PayableIdentificationStep } from "./PayableIdentificationStep";
import { PayableReviewStep } from "./PayableReviewStep";
import { PayableValuesStep } from "./PayableValuesStep";

const steps = ["identificacao", "valores", "rateio", "anexos", "revisao"];

export function PayableWizard({ form, categories, costCenters, onChange, onSubmit }: { form: PayableDraftFormState; categories: ExpenseCategory[]; costCenters: CostCenter[]; onChange: (form: PayableDraftFormState) => void; onSubmit: () => void }): JSX.Element {
  const [index, setIndex] = useState(0);
  const active = steps[index];
  return (
    <div>
      <Stepper activeId={active} steps={steps.map((id, position) => ({ id, label: id, status: position === index ? "current" : position < index ? "complete" : "pending" }))} />
      {active === "identificacao" ? <PayableIdentificationStep form={form} onChange={onChange} /> : null}
      {active === "valores" ? <PayableValuesStep form={form} onChange={onChange} /> : null}
      {active === "rateio" ? <PayableAllocationStep form={form} categories={categories} costCenters={costCenters} onChange={onChange} /> : null}
      {active === "anexos" ? <PayableAttachmentsStep /> : null}
      {active === "revisao" ? <PayableReviewStep form={form} /> : null}
      <div className="actions"><Button disabled={index === 0} onClick={() => setIndex(index - 1)}>Voltar</Button>{index < steps.length - 1 ? <Button variant="primary" onClick={() => setIndex(index + 1)}>Avancar</Button> : <Button variant="primary" onClick={onSubmit}>Confirmar conta</Button>}</div>
    </div>
  );
}
