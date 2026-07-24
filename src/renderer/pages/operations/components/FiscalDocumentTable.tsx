import type { FiscalDocument } from "../../../../shared/types/domain";
import { formatCurrencyFromCents, formatDateOnlyBr } from "../../../../shared/utils/format";
import { Button, DataTable } from "../../../design-system";
import { FiscalDocumentStatusBadge } from "./FiscalDocumentStatusBadge";

export function FiscalDocumentTable({ documents, onOpen }: { documents: FiscalDocument[]; onOpen: (id: string) => void }): JSX.Element {
  return (
    <DataTable
      rows={documents}
      getRowKey={(row) => row.id}
      columns={[
        { key: "issueDate", header: "Emissão", render: (row) => formatDateOnlyBr(row.issueDate) },
        { key: "number", header: "NF", render: (row) => row.documentNumber },
        { key: "series", header: "Série", render: (row) => row.series },
        { key: "source", header: "Origem", render: (row) => row.source },
        { key: "status", header: "Status", render: (row) => <FiscalDocumentStatusBadge status={row.status} /> },
        { key: "total", header: "Valor", align: "right", render: (row) => formatCurrencyFromCents(row.totalAmountCents) },
        { key: "actions", header: "Ações", render: (row) => <Button onClick={() => onOpen(row.id)}>Abrir</Button> }
      ]}
    />
  );
}
