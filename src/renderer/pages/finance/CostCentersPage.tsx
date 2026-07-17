import { useState } from "react";
import { Alert, Button, PageHeader } from "../../design-system";
import { CostCentersTree } from "./components/CostCentersTree";
import { CostCenterForm } from "./forms/CostCenterForm";
import { useFinanceData } from "./hooks/useFinanceData";
import type { FinancePageProps } from "./types";

export function CostCentersPage({ data }: FinancePageProps): JSX.Element {
  const { finance, organizationId, ownLegalEntityId, reload } = useFinanceData(data);
  const [name, setName] = useState("");
  async function create(): Promise<void> {
    await window.operationsCafe.createCostCenter({ organizationId, ownLegalEntityId, locationId: null, parentCostCenterId: null, name: name || "Centro de custo", code: null, description: null, isActive: true });
    setName("");
    await reload();
  }
  return <section className="content-section"><PageHeader eyebrow="Centros" title="Centros de custo" description="Centro de custo e uma atribuicao gerencial; local e o lugar fisico." actions={<Button onClick={() => void create()}>Criar centro</Button>} /><Alert variant="info" title="Local x centro">Use locais para unidades fisicas e centros para analise gerencial.</Alert><CostCenterForm name={name} onName={setName} /><CostCentersTree costCenters={finance.costCenters} legalEntities={data.legalEntities} locations={data.locations} /></section>;
}
