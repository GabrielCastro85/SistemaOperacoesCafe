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
