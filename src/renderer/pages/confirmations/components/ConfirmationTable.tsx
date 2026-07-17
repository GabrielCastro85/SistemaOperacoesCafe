import type { DealConfirmation } from "../../../../shared/types/domain";
import { formatCurrencyFromCents } from "../../../../shared/utils/format";
import { Button, DataTable, StatusBadge } from "../../../design-system";
import { SignatureStatusBadge } from "./SignatureStatusBadge";

export function ConfirmationTable({ confirmations, onOpen }: { confirmations: DealConfirmation[]; onOpen: (id: string) => void }): JSX.Element {
  return (
    <DataTable
      rows={confirmations}
      getRowKey={(row) => row.id}
      columns={[
        { key: "number", header: "Número", render: (row) => row.confirmationNumber ?? row.temporaryReference },
        { key: "date", header: "Data", render: (row) => row.confirmationDate },
        { key: "sacks", header: "Sacas", align: "right", render: (row) => row.totalQuantitySacksDecimal },
        { key: "value", header: "Valor", align: "right", render: (row) => formatCurrencyFromCents(row.totalCommercialAmountCents) },
        { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} label={row.status} /> },
        { key: "signature", header: "Assinatura", render: (row) => <SignatureStatusBadge status={row.signatureStatus} /> },
        { key: "actions", header: "Ações", render: (row) => <Button onClick={() => onOpen(row.id)}>Abrir</Button> }
      ]}
    />
  );
}
