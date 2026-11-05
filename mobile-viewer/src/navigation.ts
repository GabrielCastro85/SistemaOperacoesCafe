export type PageId =
  | "dashboard"
  | "invoices"
  | "warehouses"
  | "charges"
  | "confirmations"
  | "ledger";

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
  { title: "Operações", items: [{ id: "invoices", label: "Notas e operações" }, { id: "warehouses", label: "Cafés armazenados" }] },
  { title: "Comercial", items: [{ id: "confirmations", label: "Confirmações" }] },
  { title: "Recebimentos", items: [{ id: "charges", label: "Cobranças" }, { id: "ledger", label: "Conta-corrente" }] }
];

export const pageTitleById: Record<PageId, string> = {
  dashboard: "Dashboard",
  invoices: "Notas e operações",
  warehouses: "Cafés armazenados",
  charges: "Cobranças",
  confirmations: "Confirmações",
  ledger: "Conta-corrente"
};
