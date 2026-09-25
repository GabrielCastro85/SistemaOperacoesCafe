import { useState } from "react";
import type { PayablePaymentMethod } from "../../../../shared/types/domain";

export interface PendingPayableAttachment {
  token: string;
  fileName: string;
  sizeBytes: number;
}

export interface PayableDraftFormState {
  payee: string;
  description: string;
  amount: string;
  dueDate: string;
  categoryId: string;
  costCenterId: string;
  plannedPaymentMethod: PayablePaymentMethod;
  pixKey: string;
  attachments: PendingPayableAttachment[];
}

export function usePayableDraftForm(): { form: PayableDraftFormState; setForm: (form: PayableDraftFormState) => void; reset: () => void } {
  const initial: PayableDraftFormState = {
    payee: "Fornecedor avulso",
    description: "Conta a pagar",
    amount: "1000,00",
    dueDate: new Date().toISOString().slice(0, 10),
    categoryId: "",
    costCenterId: "",
    plannedPaymentMethod: "BOLETO",
    pixKey: "",
    attachments: []
  };
  const [form, setForm] = useState(initial);
  return { form, setForm, reset: () => setForm(initial) };
}
