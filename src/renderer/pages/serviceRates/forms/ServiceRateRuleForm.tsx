import type { OperationScope } from "../../../../shared/types/domain";
import { SERVICE_RATE_SCOPE_OPTIONS } from "../../../../shared/utils/operationLabels";
import { SelectField, TextField } from "../../../components/forms/LegacyFields";
import { FormGrid } from "../../../components/layout/SectionPrimitives";

export function ServiceRateRuleForm({ scope, value, onScopeChange, onValueChange }: { scope: OperationScope; value: string; onScopeChange: (value: OperationScope) => void; onValueChange: (value: string) => void }): JSX.Element {
  return (
    <FormGrid>
      <SelectField label="UF da venda" value={scope} onChange={(next) => onScopeChange(next as OperationScope)} options={SERVICE_RATE_SCOPE_OPTIONS} />
      <TextField label="Valor por saca" value={value} onChange={onValueChange} />
    </FormGrid>
  );
}
