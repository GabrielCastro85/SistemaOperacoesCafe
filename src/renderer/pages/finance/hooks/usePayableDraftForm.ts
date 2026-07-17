import { useState } from "react";

export interface PayableDraftFormState {
  payee: string;
  description: string;
  amount: string;
  dueDate: string;
  categoryId: string;
  costCenterId: string;
}

export function usePayableDraftForm(): { form: PayableDraftFormState; setForm: (form: PayableDraftFormState) => void; reset: () => void } {
  const initial: PayableDraftFormState = {
    payee: "Fornecedor avulso",
    description: "Conta a pagar",
    amount: "100000",
    dueDate: new Date().toISOString().slice(0, 10),
    categoryId: "",
    costCenterId: ""
  };
  const [form, setForm] = useState(initial);
  return { form, setForm, reset: () => setForm(initial) };
}
