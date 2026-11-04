import type { LegalEntity } from "../types/domain.js";

// A empresa tem duas contas: a das confirmacoes (campos default*) e, se
// preenchida, uma propria das cobrancas (campos charge*). Editar uma nao
// altera a outra; sem conta de cobranca, a cobranca usa a da confirmacao.

export type BankDetails = {
  bankName: string | null;
  bankCode: string | null;
  bankAgency: string | null;
  bankAccount: string | null;
  bankAccountType: string | null;
  bankHolderName: string | null;
  bankHolderDocument: string | null;
  pixKey: string | null;
  pixKeyType: string | null;
};

export const CHARGE_BANK_FIELD_LABELS = [
  ["chargeBankName", "Banco"], ["chargeBankCode", "Codigo do banco"], ["chargeBankAgency", "Agencia"],
  ["chargeBankAccount", "Conta"], ["chargeBankAccountType", "Tipo de conta"], ["chargeBankHolderName", "Titular"],
  ["chargeBankHolderDocument", "CPF/CNPJ do titular"], ["chargePixKey", "Chave PIX"], ["chargePixKeyType", "Tipo de chave PIX"]
] as const;

export type ChargeBankField = (typeof CHARGE_BANK_FIELD_LABELS)[number][0];

type BankSource = Pick<LegalEntity,
  | "defaultBankName" | "defaultBankCode" | "defaultBankAgency" | "defaultBankAccount" | "defaultBankAccountType"
  | "defaultBankHolderName" | "defaultBankHolderDocument" | "defaultPixKey" | "defaultPixKeyType"
> & Partial<Pick<LegalEntity, ChargeBankField>>;

export function confirmationBankDetails(entity: BankSource): BankDetails {
  return {
    bankName: entity.defaultBankName ?? null,
    bankCode: entity.defaultBankCode ?? null,
    bankAgency: entity.defaultBankAgency ?? null,
    bankAccount: entity.defaultBankAccount ?? null,
    bankAccountType: entity.defaultBankAccountType ?? null,
    bankHolderName: entity.defaultBankHolderName ?? null,
    bankHolderDocument: entity.defaultBankHolderDocument ?? null,
    pixKey: entity.defaultPixKey ?? null,
    pixKeyType: entity.defaultPixKeyType ?? null
  };
}

export function hasOwnChargeBankAccount(entity: BankSource): boolean {
  return Boolean(entity.chargeBankName?.trim() || entity.chargeBankAgency?.trim() || entity.chargeBankAccount?.trim() || entity.chargePixKey?.trim());
}

/** Conta impressa na cobranca: a propria das cobrancas, ou a da confirmacao se nao houver. */
export function chargeBankDetails(entity: BankSource): BankDetails {
  if (!hasOwnChargeBankAccount(entity)) return confirmationBankDetails(entity);
  return {
    bankName: entity.chargeBankName ?? null,
    bankCode: entity.chargeBankCode ?? null,
    bankAgency: entity.chargeBankAgency ?? null,
    bankAccount: entity.chargeBankAccount ?? null,
    bankAccountType: entity.chargeBankAccountType ?? null,
    bankHolderName: entity.chargeBankHolderName ?? null,
    bankHolderDocument: entity.chargeBankHolderDocument ?? null,
    pixKey: entity.chargePixKey ?? null,
    pixKeyType: entity.chargePixKeyType ?? null
  };
}

/** Campos charge* preenchidos com a conta usada hoje na cobranca, para editar. */
export function chargeBankFormValues(entity: BankSource): Record<ChargeBankField, string | null> {
  const details = chargeBankDetails(entity);
  return {
    chargeBankName: details.bankName, chargeBankCode: details.bankCode, chargeBankAgency: details.bankAgency,
    chargeBankAccount: details.bankAccount, chargeBankAccountType: details.bankAccountType, chargeBankHolderName: details.bankHolderName,
    chargeBankHolderDocument: details.bankHolderDocument, chargePixKey: details.pixKey, chargePixKeyType: details.pixKeyType
  };
}
