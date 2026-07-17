export interface StepperStep {
  id: string;
  label: string;
  status?: "pending" | "current" | "complete" | "error";
}

export function Stepper({ steps, activeId, onStepClick }: { steps: StepperStep[]; activeId: string; onStepClick?: (id: string) => void }): JSX.Element {
  return (
    <ol className="ui-stepper" aria-label="Etapas">
      {steps.map((step, index) => {
        const status = step.status ?? (step.id === activeId ? "current" : "pending");
        return (
          <li key={step.id} className={`ui-stepper__item ui-stepper__item--${status}`} aria-current={step.id === activeId ? "step" : undefined}>
            <button type="button" disabled={!onStepClick} onClick={() => onStepClick?.(step.id)}>
              <span>{index + 1}</span>
              {step.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
