import { DateInput } from "../../../design-system";
import { FormGrid } from "../../../components/layout/SectionPrimitives";

export function ChargePeriodForm({ start, end, dueDate, onStartChange, onEndChange, onDueDateChange }: { start: string; end: string; dueDate: string; onStartChange: (value: string) => void; onEndChange: (value: string) => void; onDueDateChange: (value: string) => void }): JSX.Element {
  return (
    <FormGrid>
      <DateInput label="Inicio" value={start} onChange={(event) => onStartChange(event.target.value)} />
      <DateInput label="Fim" value={end} onChange={(event) => onEndChange(event.target.value)} />
      <DateInput label="Vencimento" value={dueDate} onChange={(event) => onDueDateChange(event.target.value)} />
    </FormGrid>
  );
}
