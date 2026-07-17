import { Stepper } from "../../../design-system";

export function ManualFiscalDocumentWizard(): JSX.Element {
  return <Stepper activeId="document" steps={[{ id: "document", label: "Dados da nota", status: "current" }, { id: "items", label: "Itens" }, { id: "classification", label: "Classificação" }, { id: "review", label: "Revisão" }]} />;
}
