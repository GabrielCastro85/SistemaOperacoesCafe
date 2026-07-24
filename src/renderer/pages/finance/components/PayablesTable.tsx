import type { AccountPayable, CostCenter, ExpenseCategory, LegalEntity, Location } from "../../../../shared/types/domain";
import { formatCurrencyFromCents, formatDateOnlyBr } from "../../../../shared/utils/format";
import { DataTable, StatusBadge } from "../../../design-system";

export function PayablesTable({ payables, categories, legalEntities, locations, onOpen, onConfirm, onPay, onCancel }: { payables: AccountPayable[]; categories: ExpenseCategory[]; costCenters?: CostCenter[]; legalEntities: LegalEntity[]; locations: Location[]; onOpen?: (id: string) => void; onConfirm?: (id: string) => void; onPay?: (id: string) => void; onCancel?: (id: string) => void }): JSX.Element {
  return (
    <DataTable
      rows={payables}
      getRowKey={(row) => row.id}
      columns={[
        { key: "due", header: "Vencimento", render: (row) => formatDateOnlyBr(row.dueDate) },
        { key: "description", header: "Descricao", render: (row) => row.description },
        { key: "supplier", header: "Fornecedor", render: (row) => row.payeeNameSnapshot },
        { key: "entity", header: "CNPJ proprio", render: (row) => legalEntities.find((item) => item.id === row.ownLegalEntityId)?.tradeName ?? "-" },
        { key: "location", header: "Local", render: (row) => locations.find((item) => item.id === row.defaultLocationId)?.name ?? "-" },
        { key: "category", header: "Categoria", render: (row) => categories.find((item) => item.id === row.categoryId)?.name ?? "-" },
        { key: "competence", header: "Competencia", render: (row) => row.competenceDate.slice(5, 7) + "-" + row.competenceDate.slice(0, 4) },
        { key: "final", header: "Valor final", align: "right", render: (row) => formatCurrencyFromCents(row.finalAmountCents ?? 0) },
        { key: "paid", header: "Pago", align: "right", render: (row) => formatCurrencyFromCents(row.paidAmountCents) },
        { key: "open", header: "Saldo", align: "right", render: (row) => formatCurrencyFromCents(row.openAmountCents ?? 0) },
        { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} label={row.status} /> },
        { key: "actions", header: "Acoes", render: (row) => <div className="row-actions"><button onClick={() => onOpen?.(row.id)}>Abrir</button>{row.status === "DRAFT" ? <button onClick={() => onConfirm?.(row.id)}>Confirmar</button> : null}{(row.openAmountCents ?? 0) > 0 ? <button onClick={() => onPay?.(row.id)}>Registrar pagamento</button> : null}{row.status !== "CANCELLED" ? <button onClick={() => onCancel?.(row.id)}>Cancelar</button> : null}</div> }
      ]}
    />
  );
}

export function payableMetrics(payables: AccountPayable[]): Array<{ label: string; value: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const next7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return [
    { label: "Vencidas", value: payables.filter((item) => item.status !== "PAID" && item.dueDate < today).length },
    { label: "Vencem hoje", value: payables.filter((item) => item.dueDate === today).length },
    { label: "Proximos 7 dias", value: payables.filter((item) => item.dueDate >= today && item.dueDate <= next7).length },
    { label: "Abertas", value: payables.filter((item) => ["OPEN", "SCHEDULED"].includes(item.status)).length },
    { label: "Parciais", value: payables.filter((item) => item.status === "PARTIALLY_PAID").length },
    { label: "Pagas", value: payables.filter((item) => item.status === "PAID").length }
  ];
}
