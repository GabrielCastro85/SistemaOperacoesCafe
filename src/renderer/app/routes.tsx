export type AppRouteId =
  | "dashboard"
  | "invoices"
  | "partners"
  | "products"
  | "rates"
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
