import type { DealConfirmationItem } from "../../../../shared/types/domain";
import { formatCurrencyFromCents } from "../../../../shared/utils/format";
import { DataTable } from "../../../design-system";

export function ConfirmationItemsTable({ items }: { items: DealConfirmationItem[] }): JSX.Element {
  return <DataTable rows={items} getRowKey={(row) => row.id} columns={[{ key: "product", header: "Produto", render: (row) => row.productNameSnapshot }, { key: "sacks", header: "Sacas", align: "right", render: (row) => row.quantitySacksDecimal }, { key: "price", header: "Preço", align: "right", render: (row) => row.unitPriceDecimal }, { key: "total", header: "Total", align: "right", render: (row) => formatCurrencyFromCents(row.totalAmountCents) }]} />;
}
