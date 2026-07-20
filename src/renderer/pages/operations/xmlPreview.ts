import type { LegalEntity } from "../../../shared/types/domain";
import { onlyDigits } from "../../../shared/utils/format";

interface NfePartySnapshot {
  legalName: string | null;
  tradeName: string | null;
  cnpjCpf: string | null;
}

interface NfeItemPreview {
  description: string | null;
  commercialQuantity: string | null;
  commercialUnitValue: string | null;
  totalAmountCents: number | null;
}

export interface NfeExtractedPreview {
  accessKey: string | null;
  model: string | null;
  series: string | null;
  number: string | null;
  nature: string | null;
  issuedAt: string | null;
  issuer: NfePartySnapshot | null;
  recipient: NfePartySnapshot | null;
  transportCarrierName: string | null;
  items: NfeItemPreview[];
  productsAmountCents: number | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function party(value: unknown): NfePartySnapshot | null {
  const record = asRecord(value);
  if (!record) return null;
  return { legalName: str(record.legalName), tradeName: str(record.tradeName), cnpjCpf: str(record.cnpjCpf) };
}

export function parseNfeExtractedPreview(data: Record<string, unknown> | null | undefined): NfeExtractedPreview | null {
  if (!data) return null;
  const totals = asRecord(data.totals);
  const transport = asRecord(data.transport);
  const items = Array.isArray(data.items)
    ? data.items.map((raw): NfeItemPreview => {
        const item = asRecord(raw) ?? {};
        return {
          description: str(item.description),
          commercialQuantity: str(item.commercialQuantity),
          commercialUnitValue: str(item.commercialUnitValue),
          totalAmountCents: num(item.totalAmountCents)
        };
      })
    : [];
  return {
    accessKey: str(data.accessKey),
    model: str(data.model),
    series: str(data.series),
    number: str(data.number),
    nature: str(data.nature),
    issuedAt: str(data.issuedAt),
    issuer: party(data.issuer),
    recipient: party(data.recipient),
    transportCarrierName: transport ? str(transport.carrierName) : null,
    items,
    productsAmountCents: totals ? num(totals.productsAmountCents) : null
  };
}

export interface OwnAndCounterparty {
  ownEntityLabel: string | null;
  counterpartyLabel: string | null;
  counterpartyCnpj: string | null;
}

/** Best-effort local preview only — the backend re-resolves the own CNPJ and counterparty independently when the file is actually imported. */
export function resolveOwnAndCounterparty(preview: NfeExtractedPreview | null, legalEntities: LegalEntity[]): OwnAndCounterparty {
  if (!preview) return { ownEntityLabel: null, counterpartyLabel: null, counterpartyCnpj: null };
  const issuerCnpj = preview.issuer?.cnpjCpf ? onlyDigits(preview.issuer.cnpjCpf) : null;
  const recipientCnpj = preview.recipient?.cnpjCpf ? onlyDigits(preview.recipient.cnpjCpf) : null;
  const ownByIssuer = issuerCnpj ? legalEntities.find((entity) => onlyDigits(entity.cnpj) === issuerCnpj) : undefined;
  const ownByRecipient = recipientCnpj ? legalEntities.find((entity) => onlyDigits(entity.cnpj) === recipientCnpj) : undefined;
  if (ownByIssuer) {
    return { ownEntityLabel: ownByIssuer.tradeName, counterpartyLabel: preview.recipient?.tradeName ?? preview.recipient?.legalName ?? null, counterpartyCnpj: recipientCnpj };
  }
  if (ownByRecipient) {
    return { ownEntityLabel: ownByRecipient.tradeName, counterpartyLabel: preview.issuer?.tradeName ?? preview.issuer?.legalName ?? null, counterpartyCnpj: issuerCnpj };
  }
  return { ownEntityLabel: null, counterpartyLabel: preview.recipient?.tradeName ?? preview.recipient?.legalName ?? null, counterpartyCnpj: recipientCnpj };
}
