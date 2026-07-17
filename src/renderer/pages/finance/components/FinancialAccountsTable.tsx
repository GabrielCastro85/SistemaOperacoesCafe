import type { FinancialAccount, LegalEntity } from "../../../../shared/types/domain";
import { DataTable, StatusBadge } from "../../../design-system";

export function FinancialAccountsTable({ accounts, legalEntities }: { accounts: FinancialAccount[]; legalEntities: LegalEntity[] }): JSX.Element {
  return <DataTable rows={accounts} getRowKey={(row) => row.id} columns={[
    { key: "name", header: "Nome", render: (row) => row.name },
    { key: "type", header: "Tipo", render: (row) => row.accountType },
    { key: "bank", header: "Banco", render: (row) => row.bankName ?? "-" },
    { key: "identifier", header: "Identificador", render: (row) => row.accountIdentifierMasked ?? row.pixKeyDescription ?? "-" },
    { key: "entity", header: "CNPJ proprio", render: (row) => legalEntities.find((item) => item.id === row.ownLegalEntityId)?.tradeName ?? "-" },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.isActive ? "ACTIVE" : "INACTIVE"} label={row.isActive ? "Ativa" : "Inativa"} /> }
  ]} />;
}
