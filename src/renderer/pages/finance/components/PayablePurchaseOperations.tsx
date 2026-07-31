import type { AccountPayableOperation } from "../../../../shared/types/domain";
import { formatCurrencyFromCents, formatDateOnlyBr } from "../../../../shared/utils/format";
import { formatOperationScope } from "../../../../shared/utils/operationLabels";
import { DataTable, PageSection } from "../../../design-system";

export function PayablePurchaseOperations({ operations }: { operations: AccountPayableOperation[] }): JSX.Element | null {
  if (operations.length === 0) return null;
  return (
    <PageSection title="Notas do acerto" description="Detalhamento nota a nota que compoe este acerto de compras -- serve de prova em caso de cobranca indevida do fornecedor.">
      <DataTable
        rows={operations}
        getRowKey={(row) => row.id}
        columns={[
          { key: "note", header: "Nota fiscal", render: (row) => row.fiscalDocumentNumberSnapshot ? `NF ${row.fiscalDocumentNumberSnapshot}` : "NF -" },
          { key: "date", header: "Data", render: (row) => formatDateOnlyBr(row.operationDateSnapshot) },
          { key: "entity", header: "Empresa", render: (row) => row.ownLegalEntityNameSnapshot ?? "-" },
          { key: "product", header: "Produto", render: (row) => row.productNameSnapshot ?? "-" },
          { key: "scope", header: "UF", render: (row) => formatOperationScope(row.operationScopeSnapshot) },
          { key: "sacks", header: "Sacas", align: "right", render: (row) => row.quantitySacksDecimalSnapshot.replace(".", ",") },
          { key: "rate", header: "R$/saca", align: "right", render: (row) => formatCurrencyFromCents(row.purchaseRateCentsSnapshot) },
          { key: "amount", header: "Valor", align: "right", render: (row) => formatCurrencyFromCents(row.purchaseAmountCentsSnapshot) }
        ]}
      />
    </PageSection>
  );
}
