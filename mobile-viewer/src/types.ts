export interface OrganizationLite {
  id: string;
  slug: string;
  displayName: string;
  appDisplayName: string;
  logoPath: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export interface LegalEntityLite {
  id: string;
  organizationId: string;
  tradeName: string;
  cnpj: string | null;
  state: string | null;
}

export interface UnbilledOperationRow {
  id: string;
  operation_date: string;
  service_amount_cents: number;
  quantity_sacks_decimal: string;
  applied_rate_value_cents: number;
  fiscal_document: { document_number: string; series: string | null } | null;
  responsible_partner: { display_name: string; state: string | null } | null;
  own_legal_entity: { trade_name: string; state: string | null } | null;
}

export interface PendingBillingGroup {
  key: string;
  clientName: string;
  legalEntityName: string;
  operationCount: number;
  amountCents: number;
  sacks: number;
  periodStart: string;
  periodEnd: string;
  operations: UnbilledOperationRow[];
}

export type ClientChargeStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "ISSUED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED"
  | "REPLACED";

export interface ClientCharge {
  id: string;
  charge_number: string | null;
  reference_code: string | null;
  period_start: string;
  period_end: string;
  due_date: string | null;
  status: ClientChargeStatus;
  final_amount_cents: number;
  paid_amount_cents: number;
  open_amount_cents: number;
  client: { display_name: string } | null;
  own_legal_entity: { trade_name: string } | null;
  documents: Array<{
    id: string;
    version: number;
    pdf_storage_object_path: string | null;
    excel_storage_object_path: string | null;
  }>;
}

export type DealConfirmationStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "ISSUED"
  | "SENT_FOR_SIGNATURE"
  | "SIGNED"
  | "CANCELLED"
  | "REPLACED";

export interface DealConfirmation {
  id: string;
  confirmation_number: string | null;
  temporary_reference: string;
  confirmation_date: string;
  status: DealConfirmationStatus;
  total_quantity_sacks_decimal: string;
  total_commercial_amount_cents: number;
  own_legal_entity: { trade_name: string } | null;
  documents: Array<{
    id: string;
    document_type: string;
    is_current: boolean;
    storage_object_path: string | null;
  }>;
}

export type BusinessPartnerRole = "CLIENT" | "SUPPLIER" | "SELLER" | "BUYER" | "DESTINATION" | "CARRIER" | "SERVICE_PROVIDER" | "OTHER";

export interface BusinessPartnerRow {
  id: string;
  display_name: string;
  document_number: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  is_active: boolean;
  roles: Array<{ role: BusinessPartnerRole }>;
}

export type ProductCategory = "COFFEE_ARABICA" | "COFFEE_CONILON" | "COFFEE_OTHER" | "OTHER";
export type ProductUnit = "SACK" | "KG" | "TON" | "UNIT";

export interface ProductRow {
  id: string;
  name: string;
  code: string | null;
  category: ProductCategory;
  default_unit: ProductUnit;
  default_sack_weight_kg: number | null;
  is_active: boolean;
}

export interface RateRuleRow {
  id: string;
  rate_value_cents: number;
  effective_from: string;
  effective_to: string | null;
  priority: number;
  is_active: boolean;
  business_partner: { display_name: string } | null;
  product: { name: string } | null;
}

export type LedgerEntryType =
  | "SERVICE_CHARGE"
  | "ADVANCE_RECEIVED"
  | "PAYMENT_RECEIVED"
  | "DISCOUNT"
  | "CREDIT"
  | "SURCHARGE"
  | "REIMBURSEMENT"
  | "PREVIOUS_BALANCE"
  | "MANUAL_ADJUSTMENT"
  | "REVERSAL"
  | "OTHER";
export type LedgerEffect = "INCREASE_RECEIVABLE" | "REDUCE_RECEIVABLE";
export type LedgerStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";

export interface ClientLedgerEntryRow {
  id: string;
  entry_type: LedgerEntryType;
  effect: LedgerEffect;
  amount_cents: number;
  entry_date: string;
  description: string;
  status: LedgerStatus;
  client: { display_name: string } | null;
}

export type AccountPayableStatus = "DRAFT" | "SCHEDULED" | "OPEN" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CONTESTED" | "CANCELLED";

export type FiscalDocumentStatus = "DRAFT" | "PENDING" | "CONFIRMED" | "CANCELED";
export type FiscalDocumentDirection = "INBOUND" | "OUTBOUND" | "UNKNOWN";

export interface FiscalDocumentRow {
  id: string;
  document_number: string;
  series: string | null;
  issue_date: string;
  total_amount_cents: number;
  status: FiscalDocumentStatus;
  direction: FiscalDocumentDirection;
  own_legal_entity: { trade_name: string } | null;
  responsible_partner: { display_name: string } | null;
}

export interface AccountPayableRow {
  id: string;
  payee_name_snapshot: string;
  description: string;
  document_number: string | null;
  due_date: string;
  final_amount_cents: number | null;
  paid_amount_cents: number;
  open_amount_cents: number | null;
  status: AccountPayableStatus;
  supplier: { display_name: string } | null;
}
