import { TextField } from "../../../components/forms/LegacyFields";
import { FormGrid } from "../../../components/layout/SectionPrimitives";

export function CostCenterForm({ name, onName }: { name: string; onName: (value: string) => void }): JSX.Element {
  return <FormGrid><TextField label="Nome do centro de custo" value={name} onChange={onName} /></FormGrid>;
}
