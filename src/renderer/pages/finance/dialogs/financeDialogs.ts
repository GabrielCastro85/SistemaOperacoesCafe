import { requestDecision, requestTextInput } from "../../../utils/dialogs";

export const CancelPayableDialog = (description: string): Promise<string | null> => requestTextInput({ title: "Cancelar conta", label: `Motivo para cancelar ${description}`, required: true });
export const ContestPayableDialog = (description: string): Promise<string | null> => requestTextInput({ title: "Contestar conta", label: `Motivo da contestacao de ${description}`, required: true });
export const CancelPayablePaymentDialog = (): Promise<string | null> => requestTextInput({ title: "Cancelar pagamento", label: "Motivo para cancelamento do pagamento", required: true });
export const GenerateRecurringDialog = (): Promise<boolean> => requestDecision({ title: "Gerar recorrencia", message: "Deseja gerar as proximas contas desta recorrencia? As contas historicas nao serao alteradas." });
