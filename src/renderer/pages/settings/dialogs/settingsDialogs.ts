import { requestDecision, requestTextInput } from "../../../utils/dialogs";

export const DeactivateOrganizationDialog = (): Promise<boolean> => requestDecision({ title: "Desativar organizacao", message: "Deseja desativar esta organizacao?" });
export const DeactivateLegalEntityDialog = (): Promise<boolean> => requestDecision({ title: "Desativar CNPJ", message: "Deseja desativar este CNPJ?" });
export const DeactivateLocationDialog = (): Promise<boolean> => requestDecision({ title: "Desativar local", message: "Deseja desativar este local?" });
export const ResetInstallationDialog = (): Promise<string | null> => requestTextInput({ title: "Redefinir setup", label: "Digite o motivo para redefinir a configuracao inicial", required: true });
export const ChangeSequenceDialog = (): Promise<boolean> => requestDecision({ title: "Alterar numeracao", message: "Alterar sequencia pode afetar documentos futuros. Confirmar?" });
