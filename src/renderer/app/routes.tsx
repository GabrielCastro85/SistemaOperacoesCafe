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
  | "settings";

export const routeTitleById: Record<AppRouteId, string> = {
  dashboard: "Dashboard",
  invoices: "Notas e operações",
  partners: "Clientes e parceiros",
  products: "Produtos",
  rates: "Regras por saca",
  charges: "Cobranças",
  ledger: "Conta-corrente",
  confirmations: "Confirmações de negócio",
  finance: "Financeiro",
  reports: "Relatórios",
  settings: "Configurações"
};
