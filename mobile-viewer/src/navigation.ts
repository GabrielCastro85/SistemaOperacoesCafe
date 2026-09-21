export type PageId =
  | "dashboard"
  | "charges";

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
  { title: "Recebimentos", items: [{ id: "charges", label: "Cobranças" }] }
];

export const pageTitleById: Record<PageId, string> = {
  dashboard: "Dashboard",
  charges: "Cobranças"
};
