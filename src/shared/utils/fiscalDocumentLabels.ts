import type { BusinessPartnerLegalEntity, FiscalDocument } from "../types/domain.js";

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

/**
 * CNPJ da contraparte fiscal lido do snapshot do XML. Em notas de entrada,
 * devolve o emitente; em notas de saida, o destinatario. A comparacao com o
 * CNPJ proprio evita depender somente do campo direction quando a nota veio
 * de uma importacao antiga.
 */
export function fiscalDocumentCounterpartyCnpjFromSnapshot(document: FiscalDocument, ownCnpj?: string | null): string | null {
  if (!document.fiscalSnapshotJson) return null;
  try {
    const snapshot = JSON.parse(document.fiscalSnapshotJson) as Record<string, unknown>;
    const issuer = snapshot.issuer && typeof snapshot.issuer === "object" ? snapshot.issuer as FiscalSnapshotParty : null;
    const recipient = snapshot.recipient && typeof snapshot.recipient === "object" ? snapshot.recipient as FiscalSnapshotParty : null;
    const ownDigits = onlyDigits(ownCnpj);
    const issuerDigits = onlyDigits(issuer?.cnpjCpf);
    const recipientDigits = onlyDigits(recipient?.cnpjCpf);

    if (ownDigits && issuerDigits === ownDigits) return recipientDigits || null;
    if (ownDigits && recipientDigits === ownDigits) return issuerDigits || null;
    if (document.direction === "INBOUND") return issuerDigits || recipientDigits || null;
    if (document.direction === "OUTBOUND") return recipientDigits || issuerDigits || null;
    return issuerDigits || recipientDigits || null;
  } catch {
    return null;
  }
}

/**
 * Resolve a empresa fiscal da contraparte mesmo em notas antigas cujo
 * partnerLegalEntityId ficou vazio. O CNPJ do XML e a fonte de verdade; o
 * cliente/corretor continua sendo apenas o responsavel comercial.
 */
export function resolveFiscalDocumentCounterpartyLegalEntityId(
  document: FiscalDocument,
  ownCnpj: string | null | undefined,
  legalEntities: BusinessPartnerLegalEntity[]
): string | null {
  if (document.partnerLegalEntityId) return document.partnerLegalEntityId;

  const counterpartyCnpj = fiscalDocumentCounterpartyCnpjFromSnapshot(document, ownCnpj);
  if (!counterpartyCnpj) return null;

  const matches = legalEntities.filter((entity) =>
    entity.organizationId === document.organizationId
    && entity.isActive
    && onlyDigits(entity.cnpj) === counterpartyCnpj
  );
  if (matches.length === 0) return null;

  const linkedToResponsible = matches.filter((entity) => entity.businessPartnerId === document.responsiblePartnerId);
  if (linkedToResponsible.length === 1) return linkedToResponsible[0].id;
  if (matches.length === 1) return matches[0].id;

  const primaryMatches = matches.filter((entity) => entity.isPrimary);
  return primaryMatches.length === 1 ? primaryMatches[0].id : null;
}

export function fiscalDocumentIssuerNameFromSnapshot(document: FiscalDocument): string | null {
  if (!document.fiscalSnapshotJson) return null;
  try {
    const snapshot = JSON.parse(document.fiscalSnapshotJson) as Record<string, unknown>;
    const issuer = snapshot.issuer && typeof snapshot.issuer === "object" ? snapshot.issuer as FiscalSnapshotParty : null;
    return partyName(issuer);
  } catch {
    return null;
  }
}

/** Razao social do destinatario exatamente como veio no XML da NF-e. */
export function fiscalDocumentRecipientNameFromSnapshot(document: FiscalDocument): string | null {
  if (!document.fiscalSnapshotJson) return null;
  try {
    const snapshot = JSON.parse(document.fiscalSnapshotJson) as Record<string, unknown>;
    const recipient = snapshot.recipient && typeof snapshot.recipient === "object" ? snapshot.recipient as FiscalSnapshotParty : null;
    return partyName(recipient);
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
