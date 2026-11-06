export type PageId =
  | "dashboard"
  | "comparison"
  | "assistant"
  | "invoices"
  | "warehouses"
  | "partners"
  | "products"
  | "serviceRates"
  | "purchaseRates"
  | "charges"
  | "confirmations"
  | "ledger"
  | "reconciliations"
  | "settlements"
  | "finance"
  | "reports";

export interface NavigationItem {
  id: PageId;
  label: string;
}

export interface NavigationGroup {
  title: string;
  items: NavigationItem[];
}

export const navigationGroups: NavigationGroup[] = [
  { title: "Visão geral", items: [{ id: "dashboard", label: "Dashboard" }, { id: "comparison", label: "Comparativo" }, { id: "assistant", label: "Assistente" }] },
  { title: "Operações", items: [{ id: "invoices", label: "Notas e operações" }, { id: "warehouses", label: "Cafés armazenados" }] },
  { title: "Comercial", items: [
    { id: "partners", label: "Clientes e empresas" },
    { id: "products", label: "Produtos" },
    { id: "serviceRates", label: "Regras por saca" },
    { id: "confirmations", label: "Confirmações" }
  ] },
  { title: "Recebimentos", items: [{ id: "charges", label: "Cobranças" }, { id: "reconciliations", label: "Conferência de repasses" }, { id: "ledger", label: "Conta-corrente" }] },
  { title: "Pagamentos", items: [{ id: "settlements", label: "Acertos de entrada" }, { id: "purchaseRates", label: "Regras de entrada" }] },
  { title: "Financeiro", items: [{ id: "finance", label: "Visão financeira" }, { id: "reports", label: "Relatórios" }] }
];

export const pageTitleById: Record<PageId, string> = {
  dashboard: "Dashboard",
  comparison: "Comparativo",
  assistant: "Assistente",
  invoices: "Notas e operações",
  warehouses: "Cafés armazenados",
  partners: "Clientes e empresas",
  products: "Produtos",
  serviceRates: "Regras por saca",
  purchaseRates: "Regras de entrada",
  charges: "Cobranças",
  confirmations: "Confirmações",
  ledger: "Conta-corrente",
  reconciliations: "Conferência de repasses",
  settlements: "Acertos de entrada",
  finance: "Visão financeira",
  reports: "Relatórios"
};
