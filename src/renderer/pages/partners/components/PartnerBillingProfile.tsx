import type { ClientBillingProfile } from "../../../../shared/types/domain";

export function PartnerBillingProfile({ profile }: { profile: ClientBillingProfile | null }): JSX.Element {
  return <div className="empty-state">{profile ? `${profile.periodicity} - vencimento ${profile.dueDaysAfterClosing} dias apos fechamento` : "Sem perfil de cobranca definido."}</div>;
}
