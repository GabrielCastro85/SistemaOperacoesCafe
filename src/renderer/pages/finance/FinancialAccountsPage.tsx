import { useState } from "react";
import { Alert, Button, PageHeader } from "../../design-system";
import { FinancialAccountsTable } from "./components/FinancialAccountsTable";
import { FinancialAccountForm } from "./forms/FinancialAccountForm";
import { useFinanceData } from "./hooks/useFinanceData";
import type { FinancePageProps } from "./types";

export function FinancialAccountsPage({ data }: FinancePageProps): JSX.Element {
  const { finance, organizationId, ownLegalEntityId, reload } = useFinanceData(data);
  const [name, setName] = useState("");
  const [type, setType] = useState("BANK_ACCOUNT");
  async function create(): Promise<void> {
    await window.operationsCafe.createFinancialAccount({ organizationId, ownLegalEntityId, name: name || "Conta financeira", accountType: type, bankName: null, branch: null, accountIdentifierMasked: null, pixKeyDescription: null, notes: null, isActive: true });
    setName("");
    await reload();
  }
  return <section className="content-section"><PageHeader eyebrow="Contas financeiras" title="Contas financeiras" description="Cadastro gerencial, sem integracao bancaria." actions={<Button onClick={() => void create()}>Criar conta</Button>} /><Alert variant="warning" title="Sem credenciais">Nao cadastre senha, token, chave secreta ou credencial de internet banking.</Alert><FinancialAccountForm name={name} type={type} onName={setName} onType={setType} /><FinancialAccountsTable accounts={finance.accounts} legalEntities={data.legalEntities} /></section>;
}
