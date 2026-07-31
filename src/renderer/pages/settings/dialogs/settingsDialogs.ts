import { requestDecision, requestTextInput } from "../../../utils/dialogs";

export const DeactivateOrganizationDialog = (): Promise<boolean> => requestDecision({ title: "Desativar organizacao", message: "Deseja desativar esta organizacao?" });
export const DeleteOrganizationDialog = (): Promise<boolean> => requestDecision({ title: "Excluir organizacao", message: "Excluir de forma definitiva e irreversivel. So' funciona se a organizacao estiver totalmente vazia (sem CNPJs, locais, parceiros, produtos ou notas). Confirmar exclusao?" });
export const DeactivateLegalEntityDialog = (): Promise<boolean> => requestDecision({ title: "Desativar CNPJ", message: "Deseja desativar este CNPJ?" });
export const DeleteLegalEntityDialog = (): Promise<boolean> => requestDecision({ title: "Excluir CNPJ", message: "Excluir de forma definitiva e irreversivel. So' funciona se este CNPJ nunca teve nenhuma nota, operacao ou cobranca. Confirmar exclusao?" });
export const DeactivateLocationDialog = (): Promise<boolean> => requestDecision({ title: "Desativar local", message: "Deseja desativar este local?" });
export const PermanentlyDeleteBusinessPartnerDialog = (): Promise<boolean> => requestDecision({ title: "Excluir parceiro definitivamente", message: "Excluir de forma definitiva e irreversivel (diferente de arquivar). So' funciona se este parceiro nunca teve nenhuma nota, operacao ou cobranca. Confirmar exclusao?" });
export const ResetInstallationDialog = (): Promise<string | null> => requestTextInput({ title: "Redefinir setup", label: "Digite o motivo para redefinir a configuracao inicial", required: true });
export const ChangeSequenceDialog = (): Promise<boolean> => requestDecision({ title: "Alterar numeracao", message: "Alterar sequencia pode afetar documentos futuros. Confirmar?" });
