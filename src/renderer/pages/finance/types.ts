import type { BootstrapData, FinancialReportType } from "../../../shared/types/domain";

export interface FinancePageProps {
  data: BootstrapData;
}

export const financialReportOptions: Array<[FinancialReportType, string]> = [
  ["ACCOUNTS_PAYABLE", "Contas por periodo"],
  ["OVERDUE_PAYABLES", "Vencidas"],
  ["PAYMENTS", "Pagamentos realizados"],
  ["BY_LEGAL_ENTITY", "Por CNPJ"],
  ["BY_LOCATION", "Por local"],
  ["BY_COST_CENTER", "Por centro de custo"],
  ["BY_CATEGORY", "Por categoria"],
  ["BY_SUPPLIER", "Por fornecedor"],
  ["FIXED_VARIABLE", "Fixas e variaveis"],
  ["RECURRING", "Recorrencias"],
  ["INSTALLMENTS", "Parcelamentos"],
  ["PROJECTED_CASH_FLOW", "Fluxo projetado"]
];
