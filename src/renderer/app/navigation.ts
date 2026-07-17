import type { AppRouteId } from "./routes";

export interface NavigationItem {
  id: AppRouteId;
  label: string;
  legacyMenu: string;
  icon: string;
}

export interface NavigationGroup {
  title: string;
  items: NavigationItem[];
}

export const navigationGroups: NavigationGroup[] = [
  { title: "Visão geral", items: [{ id: "dashboard", label: "Dashboard", legacyMenu: "Dashboard", icon: "⌂" }] },
  {
    title: "Operações",
    items: [{ id: "invoices", label: "Notas e operações", legacyMenu: "Notas e operacoes", icon: "▦" }]
  },
  {
    title: "Comercial",
    items: [
      { id: "partners", label: "Clientes e parceiros", legacyMenu: "Clientes", icon: "◉" },
      { id: "rates", label: "Regras por saca", legacyMenu: "Regras por saca", icon: "◇" },
      { id: "confirmations", label: "Confirmações", legacyMenu: "Confirmacoes", icon: "✓" }
    ]
  },
  {
    title: "Recebimentos",
    items: [
      { id: "charges", label: "Cobranças", legacyMenu: "Cobrancas", icon: "$" },
      { id: "ledger", label: "Conta-corrente", legacyMenu: "Conta-corrente", icon: "↔" }
    ]
  },
  {
    title: "Financeiro",
    items: [
      { id: "finance", label: "Visão financeira", legacyMenu: "Financeiro", icon: "▣" },
      { id: "reports", label: "Relatórios", legacyMenu: "Relatorios", icon: "▤" }
    ]
  },
  {
    title: "Administração",
    items: [{ id: "settings", label: "Configurações", legacyMenu: "Configuracoes", icon: "⚙" }]
  }
];

export function routeIdFromLegacyMenu(menu: string): AppRouteId {
  return navigationGroups.flatMap((group) => group.items).find((item) => item.legacyMenu === menu)?.id ?? "dashboard";
}
