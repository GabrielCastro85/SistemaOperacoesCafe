import type { BusinessPartnerRole } from "../../../../shared/types/domain";

export function PartnerRoles({ roles }: { roles: BusinessPartnerRole[] }): JSX.Element {
  return <div className="tag-row">{roles.map((role) => <span key={role} className="tag">{role}</span>)}</div>;
}
