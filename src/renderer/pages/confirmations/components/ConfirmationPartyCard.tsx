import type { DealConfirmationParty, DealPartySnapshot } from "../../../../shared/types/domain";

const PARTY_ROLE_LABELS: Record<string, string> = {
  ISSUER: "Emitente",
  BROKER: "Corretora",
  SELLER: "Vendedor",
  BUYER: "Comprador",
  DELIVERY_RECIPIENT: "Local de descarga",
  OTHER: "Outro"
};

export function ConfirmationPartyCard({ party }: { party: DealConfirmationParty }): JSX.Element {
  let snapshot: Partial<DealPartySnapshot> = {};
  try {
    snapshot = JSON.parse(party.snapshotJson) as Partial<DealPartySnapshot>;
  } catch {
    snapshot = {};
  }
  const name = snapshot.name ?? party.manualName ?? "Participante";
  return (
    <article className="ui-card confirmation-party-card">
      <span className="ui-eyebrow">{PARTY_ROLE_LABELS[party.partyRole] ?? party.partyRole}</span>
      <strong>{name}</strong>
      {snapshot.legalName && snapshot.legalName !== name ? <span className="muted">{snapshot.legalName}</span> : null}
      {snapshot.addressLine ? <span className="muted">{snapshot.addressLine}{snapshot.addressNumber ? `, ${snapshot.addressNumber}` : ""}</span> : null}
      {snapshot.city ? <span className="muted">{snapshot.city}{snapshot.state ? ` - ${snapshot.state}` : ""}</span> : null}
      {snapshot.taxId ? <span className="muted">CNPJ/CPF: {snapshot.taxId}</span> : null}
      {snapshot.stateRegistration ? <span className="muted">I.E.: {snapshot.stateRegistration}</span> : null}
      {party.representativeName ? <span className="muted">Representante: {party.representativeName}</span> : null}
    </article>
  );
}
