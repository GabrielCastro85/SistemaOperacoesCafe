import type { OperationScope } from "../../../../shared/types/domain";
import { SelectField, TextField } from "../../../components/forms/LegacyFields";
import { FormGrid } from "../../../components/layout/SectionPrimitives";

export function ServiceRateRuleForm({ scope, value, onScopeChange, onValueChange }: { scope: OperationScope; value: string; onScopeChange: (value: OperationScope) => void; onValueChange: (value: string) => void }): JSX.Element {
  return (
    <FormGrid>
      <SelectField label="Tipo" value={scope} onChange={(next) => onScopeChange(next as OperationScope)} options={[["INTERNAL", "Interna"], ["EXTERNAL", "Externa"], ["ALL", "Todas"]]} />
      <TextField label="Valor por saca" value={value} onChange={onValueChange} />
    </FormGrid>
  );
}
