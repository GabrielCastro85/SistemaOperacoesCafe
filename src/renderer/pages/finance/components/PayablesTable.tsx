import type { AccountPayable, CostCenter, ExpenseCategory, LegalEntity, Location } from "../../../../shared/types/domain";
import { formatCurrencyFromCents, formatDateOnlyBr } from "../../../../shared/utils/format";
import { DataTable, StatusBadge } from "../../../design-system";

export function PayablesTable({ payables, categories, legalEntities, locations, onOpen, onEdit, onConfirm, onPay, onCancel }: { payables: AccountPayable[]; categories: ExpenseCategory[]; costCenters?: CostCenter[]; legalEntities: LegalEntity[]; locations: Location[]; onOpen?: (id: string) => void; onEdit?: (id: string) => void; onConfirm?: (id: string) => void; onPay?: (id: string) => void; onCancel?: (id: string) => void }): JSX.Element {
  return (
    <div className="finance-payables-table">
      <DataTable
        rows={payables}
        getRowKey={(row) => row.id}
        emptyLabel="Nenhuma conta em aberto."
        columns={[
          { key: "due", header: "Vencimento", render: (row) => <span className="finance-date">{formatDateOnlyBr(row.dueDate)}</span> },
          { key: "account", header: "Conta", render: (row) => <div className="finance-table-detail"><strong>{row.description}</strong><small>{row.payeeNameSnapshot}</small></div> },
          { key: "entity", header: "Empresa", render: (row) => {
            const entity = legalEntities.find((item) => item.id === row.ownLegalEntityId)?.tradeName ?? "-";
            const location = locations.find((item) => item.id === row.defaultLocationId)?.name;
            return <div className="finance-table-detail"><strong>{entity}</strong>{location ? <small>{location}</small> : null}</div>;
          } },
          { key: "category", header: "Categoria", render: (row) => {
            const category = categories.find((item) => item.id === row.categoryId)?.name ?? "Sem categoria";
            const competence = row.competenceDate.slice(5, 7) + "/" + row.competenceDate.slice(0, 4);
            return <div className="finance-table-detail"><strong>{category}</strong><small>Competência {competence}</small></div>;
          } },
          { key: "final", header: "Valor final", align: "right", render: (row) => <span className="finance-money">{formatCurrencyFromCents(row.finalAmountCents ?? 0)}</span> },
          { key: "paid", header: "Pago", align: "right", render: (row) => <span className="finance-money">{formatCurrencyFromCents(row.paidAmountCents)}</span> },
          { key: "open", header: "Saldo", align: "right", render: (row) => <strong className="finance-money">{formatCurrencyFromCents(row.openAmountCents ?? 0)}</strong> },
          { key: "status", header: "Situação", render: (row) => <StatusBadge status={row.status} /> },
          { key: "actions", header: "Ações", render: (row) => <div className="row-actions finance-row-actions"><button onClick={() => onOpen?.(row.id)}>Abrir</button>{!["PAID", "CANCELLED"].includes(row.status) ? <button onClick={() => onEdit?.(row.id)}>Editar</button> : null}{row.status === "DRAFT" ? <button onClick={() => onConfirm?.(row.id)}>Confirmar</button> : null}{(row.openAmountCents ?? 0) > 0 && row.status !== "CANCELLED" ? <button onClick={() => onPay?.(row.id)}>Pagar</button> : null}{row.status !== "CANCELLED" ? <button onClick={() => onCancel?.(row.id)}>Cancelar</button> : null}</div> }
        ]}
      />
    </div>
  );
}

export function payableMetrics(payables: AccountPayable[]): Array<{ label: string; value: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const next7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const activePayables = payables.filter((item) => item.status !== "CANCELLED");
  return [
    { label: "Vencidas", value: activePayables.filter((item) => item.status !== "PAID" && item.dueDate < today).length },
    { label: "Vencem hoje", value: activePayables.filter((item) => item.status !== "PAID" && item.dueDate === today).length },
    { label: "Próximos 7 dias", value: activePayables.filter((item) => item.status !== "PAID" && item.dueDate >= today && item.dueDate <= next7).length },
    { label: "Abertas", value: activePayables.filter((item) => ["OPEN", "SCHEDULED"].includes(item.status)).length },
    { label: "Parciais", value: activePayables.filter((item) => item.status === "PARTIALLY_PAID").length },
    { label: "Pagas", value: activePayables.filter((item) => item.status === "PAID").length }
  ];
}
