import { TextField } from "../../../components/forms/LegacyFields";
import { FormGrid } from "../../../components/layout/SectionPrimitives";

export function ChargePeriodForm({ start, end, dueDate, onStartChange, onEndChange, onDueDateChange }: { start: string; end: string; dueDate: string; onStartChange: (value: string) => void; onEndChange: (value: string) => void; onDueDateChange: (value: string) => void }): JSX.Element {
  return (
    <FormGrid>
      <TextField label="Inicio" value={start} onChange={onStartChange} />
      <TextField label="Fim" value={end} onChange={onEndChange} />
      <TextField label="Vencimento" value={dueDate} onChange={onDueDateChange} />
    </FormGrid>
  );
}
