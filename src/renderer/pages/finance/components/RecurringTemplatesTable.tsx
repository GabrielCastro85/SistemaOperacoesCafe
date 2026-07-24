import type { PayableRecurringTemplate } from "../../../../shared/types/domain";
import { DataTable, StatusBadge } from "../../../design-system";
import { formatCurrencyFromCents, formatDateOnlyBr } from "../../../../shared/utils/format";

export function RecurringTemplatesTable({ templates }: { templates: PayableRecurringTemplate[] }): JSX.Element {
  return <DataTable rows={templates} getRowKey={(row) => row.id} columns={[
    { key: "description", header: "Descricao", render: (row) => row.description },
    { key: "payee", header: "Favorecido", render: (row) => row.payeeNameSnapshot },
    { key: "frequency", header: "Frequencia", render: (row) => row.frequency },
    { key: "amount", header: "Valor", align: "right", render: (row) => row.amountMode === "FIXED" ? formatCurrencyFromCents(row.fixedAmountCents ?? 0) : "Variavel" },
    { key: "due", header: "Dia", render: (row) => row.dueDay },
    { key: "last", header: "Ultima competencia", render: (row) => formatDateOnlyBr(row.lastGeneratedCompetence) },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.isActive ? "ACTIVE" : "INACTIVE"} label={row.isActive ? "Ativa" : "Inativa"} /> }
  ]} />;
}
