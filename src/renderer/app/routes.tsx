export type AppRouteId =
  | "dashboard"
  | "invoices"
  | "productAliases"
  | "partners"
  | "products"
  | "rates"
  | "purchaseRates"
  | "purchaseSettlements"
  | "charges"
  | "transferReconciliations"
  | "ledger"
  | "confirmations"
  | "finance"
  | "reports"
  | "users"
  | "roles"
  | "audit"
  | "backups"
  | "integrity"
  | "retention"
  | "settings";

export const routeTitleById: Record<AppRouteId, string> = {
  dashboard: "Dashboard",
  invoices: "Notas e operações",
  productAliases: "Aliases de produto",
  partners: "Cadastros comerciais",
  products: "Produtos",
  rates: "Regras por saca",
  purchaseRates: "Regras de entrada",
  purchaseSettlements: "Acertos de entrada",
  charges: "Cobranças",
  transferReconciliations: "Conferência de repasses",
  ledger: "Conta-corrente",
  confirmations: "Confirmações de negócio",
  finance: "Financeiro",
  reports: "Relatórios",
  users: "Usuarios",
  roles: "Roles",
  audit: "Auditoria",
  backups: "Backups",
  integrity: "Integridade",
  retention: "Retencao",
  settings: "Configurações"
};
