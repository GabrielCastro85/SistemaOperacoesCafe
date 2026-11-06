import type pg from "pg";
import { deterministicUuid } from "../../electron/main/services/deterministicId.js";
import { centralRecords, type DomainChange } from "./domainMutations.js";

// Nota terceirizada: nem emitente nem destinatario e' empresa propria. Como no
// aplicativo (getOrCreateThirdPartyLegalEntityFromXml e
// resolveIssuerLegalEntityFromPartner), a emissora vira uma linha em
// legal_entities com prefixo TERC-XML e id derivado do CNPJ, para que site e
// computadores gerem o mesmo registro sem coordenacao.

type Row = Record<string, unknown>;

export const THIRD_PARTY_NOTE = "Nota terceirizada: entra apenas em cobrancas, nao em fechamento de negocio.";

const text = (value: unknown): string => String(value ?? "").trim();
const digits = (value: unknown): string => String(value ?? "").replace(/\D/g, "");
const normalized = (value: unknown): string => String(value ?? "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

export function isThirdPartyEntity(row: Row | null | undefined): boolean {
  if (!row) return false;
  return text(row.document_prefix) === "TERC-XML" || normalized(`${text(row.trade_name)} ${text(row.legal_name)}`).includes("TERCEIRIZAD");
}

export type ThirdPartyParty = {
  cnpj: string; legalName?: string | null; tradeName?: string | null; stateRegistration?: string | null;
  municipalRegistration?: string | null; email?: string | null; phone?: string | null;
  addressLine?: string | null; addressNumber?: string | null; addressComplement?: string | null;
  district?: string | null; city?: string | null; state?: string | null; postalCode?: string | null;
};

// Devolve a empresa existente com o CNPJ ou a linha nova a gravar na mesma
// revisao da nota.
export async function resolveThirdPartyEntity(
  pool: pg.Pool, organizationId: string, party: ThirdPartyParty
): Promise<{ entity: Row; change: DomainChange | null }> {
  const cnpj = digits(party.cnpj);
  if (cnpj.length !== 14) {
    throw Object.assign(new Error("Nota terceirizada sem CNPJ de emitente valido."), { statusCode: 409, code: "THIRD_PARTY_CNPJ" });
  }
  const entities = await centralRecords(pool, "legal_entities");
  const existing = entities.find((row) => digits(row.cnpj) === cnpj);
  if (existing) return { entity: existing, change: null };
  const fallbackOwn = entities.find((row) => row.organization_id === organizationId && !isThirdPartyEntity(row) && row.is_active !== 0 && row.is_active !== false)
    ?? entities.find((row) => !isThirdPartyEntity(row));
  if (!fallbackOwn) {
    throw Object.assign(new Error("Nenhum CNPJ proprio cadastrado para usar como referencia de endereco."), { statusCode: 409, code: "NO_OWN_ENTITY" });
  }
  const legalName = text(party.legalName) || text(party.tradeName) || `Terceirizada ${cnpj}`;
  const state = text(party.state).toUpperCase();
  const postalCode = digits(party.postalCode);
  const now = new Date().toISOString();
  const id = deterministicUuid("thirdPartyLegalEntity", cnpj);
  const entity: Row = {
    id, organization_id: organizationId, legal_name: legalName, trade_name: text(party.tradeName) || legalName, cnpj,
    state_registration: text(party.stateRegistration) || null, municipal_registration: text(party.municipalRegistration) || null,
    email: text(party.email) || null, phone: text(party.phone) || null,
    address_line: text(party.addressLine) || "Endereco nao informado", address_number: text(party.addressNumber) || "S/N",
    address_complement: text(party.addressComplement) || null, district: text(party.district) || "Nao informado",
    city: text(party.city) || text(fallbackOwn.city), state: /^[A-Z]{2}$/.test(state) ? state : text(fallbackOwn.state),
    postal_code: postalCode.length === 8 ? postalCode : text(fallbackOwn.postal_code) || "00000000",
    document_prefix: "TERC-XML", is_active: 1, is_draft: 1, created_at: now, updated_at: now,
    default_bank_name: null, default_bank_code: null, default_bank_agency: null, default_bank_account: null, default_pix_key: null,
    default_bank_account_type: null, default_bank_holder_name: null, default_bank_holder_document: null, default_pix_key_type: null,
    default_payment_terms: null, default_delivery_terms: null, default_confirmation_notes: null,
    charge_bank_name: null, charge_bank_code: null, charge_bank_agency: null, charge_bank_account: null, charge_bank_account_type: null,
    charge_bank_holder_name: null, charge_bank_holder_document: null, charge_pix_key: null, charge_pix_key_type: null
  };
  return { entity, change: { table: "legal_entities", key: id, operation: "UPSERT", data: entity } };
}
