import type { AccountPayableAllocation, CostCenter, Location } from "../../../../shared/types/domain";
import { DataTable, PercentageInput } from "../../../design-system";
import { formatCurrencyFromCents } from "../../../../shared/utils/format";

export function PayableAllocations({ allocations, costCenters, locations }: { allocations: AccountPayableAllocation[]; costCenters: CostCenter[]; locations: Location[] }): JSX.Element {
  const total = allocations.reduce((sum, item) => sum + item.allocationAmountCents, 0);
  return (
    <>
      <p className="muted">Rateio por valor, percentual, divisao igual ou manual. A validacao definitiva permanece no backend.</p>
      <PercentageInput label="Percentual auxiliar" value="" readOnly hint="Campo visual para composicao de rateios detalhados." />
      <DataTable rows={allocations} getRowKey={(row) => row.id} columns={[
        { key: "location", header: "Local", render: (row) => locations.find((item) => item.id === row.locationId)?.name ?? "-" },
        { key: "cost", header: "Centro de custo", render: (row) => costCenters.find((item) => item.id === row.costCenterId)?.name ?? "-" },
        { key: "percent", header: "Percentual", render: (row) => row.allocationBasisPoints === null ? "-" : `${(row.allocationBasisPoints / 100).toFixed(2)}%` },
        { key: "value", header: "Valor", align: "right", render: (row) => formatCurrencyFromCents(row.allocationAmountCents) }
      ]} />
      <p>Total rateado: {formatCurrencyFromCents(total)}</p>
    </>
  );
}
