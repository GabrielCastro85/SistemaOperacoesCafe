import type { CostCenter, LegalEntity, Location } from "../../../../shared/types/domain";
import { TreeView } from "../../../design-system";

export function CostCentersTree({ costCenters, legalEntities, locations }: { costCenters: CostCenter[]; legalEntities: LegalEntity[]; locations: Location[] }): JSX.Element {
  return <TreeView items={costCenters.map((item) => ({ id: item.id, label: `${item.code ? `${item.code} - ` : ""}${item.name}`, parentId: item.parentCostCenterId, meta: `${legalEntities.find((entity) => entity.id === item.ownLegalEntityId)?.tradeName ?? "Todos CNPJs"} · ${locations.find((location) => location.id === item.locationId)?.name ?? "Sem local"} · ${item.isActive ? "Ativo" : "Inativo"}` }))} />;
}
