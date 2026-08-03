import type { FiscalDocument } from "../types/domain.js";

interface FiscalSnapshotParty {
  legalName?: unknown;
  tradeName?: unknown;
  cnpjCpf?: unknown;
}

/**
 * Nome da contraparte da nota (pra quem/de quem foi emitida) lido direto do
 * XML importado. Serve de fallback quando a nota ainda nao tem partnerLegalEntityId
 * vinculado a um cadastro -- o que hoje e' a maioria das notas do sistema, ja que
 * o import de XML nao resolve esse vinculo automaticamente.
 */
export function fiscalDocumentCounterpartyNameFromSnapshot(document: FiscalDocument, ownCnpj?: string | null): string | null {
  if (!document.fiscalSnapshotJson) return null;
  try {
    const snapshot = JSON.parse(document.fiscalSnapshotJson) as Record<string, unknown>;
    const issuer = snapshot.issuer && typeof snapshot.issuer === "object" ? snapshot.issuer as FiscalSnapshotParty : null;
    const recipient = snapshot.recipient && typeof snapshot.recipient === "object" ? snapshot.recipient as FiscalSnapshotParty : null;
    const issuerName = partyName(issuer);
    const recipientName = partyName(recipient);
    const ownDigits = onlyDigits(ownCnpj);
    const issuerDigits = onlyDigits(issuer?.cnpjCpf);
    const recipientDigits = onlyDigits(recipient?.cnpjCpf);

    if (ownDigits && issuerDigits === ownDigits) return recipientName ?? issuerName;
    if (ownDigits && recipientDigits === ownDigits) return issuerName ?? recipientName;
    if (document.direction === "INBOUND") return issuerName ?? recipientName;
    if (document.direction === "OUTBOUND") return recipientName ?? issuerName;
    return issuerName ?? recipientName;
  } catch {
    return null;
  }
}

function partyName(party: FiscalSnapshotParty | null): string | null {
  const name = (party?.legalName || party?.tradeName) as string | undefined;
  return name?.trim() || null;
}

function onlyDigits(value: unknown): string {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}
