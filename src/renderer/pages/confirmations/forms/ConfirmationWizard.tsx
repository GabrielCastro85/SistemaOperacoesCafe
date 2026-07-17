import { Stepper } from "../../../design-system";

export function ConfirmationWizard(): JSX.Element {
  return <Stepper activeId="origin" steps={[{ id: "origin", label: "Origem", status: "current" }, { id: "parties", label: "Participantes" }, { id: "items", label: "Itens" }, { id: "terms", label: "Condições" }, { id: "review", label: "Revisão" }]} />;
}
