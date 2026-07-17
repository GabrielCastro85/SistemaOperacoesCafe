import type { BusinessPartner } from "../../../../shared/types/domain";

export function PartnerOverview({ partner }: { partner: BusinessPartner | null }): JSX.Element {
  return <div className="empty-state">{partner ? partner.displayName : "Selecione um parceiro para ver o resumo."}</div>;
}
