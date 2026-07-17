import type { DealConfirmationParty } from "../../../../shared/types/domain";

export function ConfirmationPartyCard({ party }: { party: DealConfirmationParty }): JSX.Element {
  const snapshot = JSON.parse(party.snapshotJson) as { name?: string; legalName?: string };
  return <article className="ui-card"><span>{party.partyRole}</span><strong>{snapshot.name ?? snapshot.legalName ?? party.manualName ?? "Participante"}</strong></article>;
}
