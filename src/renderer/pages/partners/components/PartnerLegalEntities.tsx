import type { BusinessPartnerLegalEntity } from "../../../../shared/types/domain";

export function PartnerLegalEntities({ entities }: { entities: BusinessPartnerLegalEntity[] }): JSX.Element {
  return <div className="table">{entities.map((entity) => <div key={entity.id} className="table-row"><span>{entity.tradeName}</span><span>{entity.cnpj}</span></div>)}</div>;
}
