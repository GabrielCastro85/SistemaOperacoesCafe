export type AppRouteId =
  | "dashboard"
  | "invoices"
  | "partners"
  | "products"
  | "rates"
  | "purchaseRates"
  | "purchaseSettlements"
  | "charges"
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
  partners: "Cadastros comerciais",
  products: "Produtos",
  rates: "Regras por saca",
  purchaseRates: "Regras de entrada",
  purchaseSettlements: "Acertos de entrada",
  charges: "Cobranças",
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
