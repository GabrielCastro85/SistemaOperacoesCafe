alter table public.legal_entities
  add column if not exists default_bank_account_type text,
  add column if not exists default_bank_holder_name text,
  add column if not exists default_bank_holder_document text,
  add column if not exists default_pix_key_type text,
  add column if not exists default_payment_terms text,
  add column if not exists default_delivery_terms text,
  add column if not exists default_confirmation_notes text;

alter table public.deal_confirmations
  add column if not exists bank_account_type text,
  add column if not exists bank_holder_name text,
  add column if not exists bank_holder_document text,
  add column if not exists pix_key_type text;
