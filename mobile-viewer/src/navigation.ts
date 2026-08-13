export type PageId =
  | "dashboard"
  | "invoices"
  | "partners"
  | "products"
  | "rates"
  | "confirmations"
  | "charges"
  | "ledger"
  | "purchaseSettlements"
  | "purchaseRates"
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
  { title: "Visão geral", items: [{ id: "dashboard", label: "Dashboard" }] },
  { title: "Operações", items: [{ id: "invoices", label: "Notas e operações" }] },
  {
    title: "Comercial",
    items: [
      { id: "partners", label: "Cadastros comerciais" },
      { id: "products", label: "Produtos" },
      { id: "rates", label: "Regras por saca" },
      { id: "confirmations", label: "Confirmações" }
    ]
  },
  {
    title: "Recebimentos",
    items: [
      { id: "charges", label: "Cobranças" },
      { id: "ledger", label: "Conta-corrente" }
    ]
  },
  {
    title: "Pagamentos",
    items: [
      { id: "purchaseSettlements", label: "Acertos de entrada" },
      { id: "purchaseRates", label: "Regras de entrada" }
    ]
  },
  {
    title: "Financeiro",
    items: [
      { id: "finance", label: "Visão financeira" },
      { id: "reports", label: "Relatórios" }
    ]
  }
];

export const pageTitleById: Record<PageId, string> = {
  dashboard: "Dashboard",
  invoices: "Notas e operações",
  partners: "Cadastros comerciais",
  products: "Produtos",
  rates: "Regras por saca",
  confirmations: "Confirmações",
  charges: "Cobranças",
  ledger: "Conta-corrente",
  purchaseSettlements: "Acertos de entrada",
  purchaseRates: "Regras de entrada",
  finance: "Visão financeira",
  reports: "Relatórios"
};
