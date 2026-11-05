export type PageId =
  | "dashboard"
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
  { title: "Comercial", items: [{ id: "confirmations", label: "Confirmações" }] },
  { title: "Recebimentos", items: [{ id: "charges", label: "Cobranças" }, { id: "ledger", label: "Conta-corrente" }] }
];

export const pageTitleById: Record<PageId, string> = {
  dashboard: "Dashboard",
  charges: "Cobranças",
  confirmations: "Confirmações",
  ledger: "Conta-corrente"
};
