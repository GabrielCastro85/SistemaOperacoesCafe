import type { AppRouteId } from "./routes";

export interface NavigationItem {
  id: AppRouteId;
  label: string;
  legacyMenu: string;
  path: string;
  icon: string;
}

export interface NavigationGroup {
  title: string;
  items: NavigationItem[];
}

export const navigationGroups: NavigationGroup[] = [
  { title: "Visão geral", items: [{ id: "dashboard", label: "Dashboard", legacyMenu: "Dashboard", path: "/dashboard", icon: "⌂" }] },
  {
    title: "Operações",
    items: [{ id: "invoices", label: "Notas e operações", legacyMenu: "Notas e operacoes", path: "/operations", icon: "▦" }]
  },
  {
    title: "Comercial",
    items: [
      { id: "partners", label: "Clientes e parceiros", legacyMenu: "Clientes", path: "/partners", icon: "◉" },
      { id: "products", label: "Produtos", legacyMenu: "Produtos", path: "/products", icon: "□" },
      { id: "rates", label: "Regras por saca", legacyMenu: "Regras por saca", path: "/billing/rates", icon: "◇" },
      { id: "confirmations", label: "Confirmações", legacyMenu: "Confirmacoes", path: "/confirmations", icon: "✓" }
    ]
  },
  {
    title: "Recebimentos",
    items: [
      { id: "charges", label: "Cobranças", legacyMenu: "Cobrancas", path: "/charges", icon: "$" },
      { id: "ledger", label: "Conta-corrente", legacyMenu: "Conta-corrente", path: "/client-ledger", icon: "↔" }
    ]
  },
  {
    title: "Financeiro",
    items: [
      { id: "finance", label: "Visão financeira", legacyMenu: "Financeiro", path: "/finance", icon: "▣" },
      { id: "reports", label: "Relatórios", legacyMenu: "Relatorios", path: "/reports", icon: "▤" }
    ]
  },
  {
    title: "Administração",
    items: [{ id: "settings", label: "Configurações", legacyMenu: "Configuracoes", path: "/settings", icon: "⚙" }]
  }
];

export function routeIdFromLegacyMenu(menu: string): AppRouteId {
  return navigationGroups.flatMap((group) => group.items).find((item) => item.legacyMenu === menu)?.id ?? "dashboard";
}

export function pathFromLegacyMenu(menu: string): string {
  return navigationGroups.flatMap((group) => group.items).find((item) => item.legacyMenu === menu)?.path ?? "/dashboard";
}

export function legacyMenuFromPath(path: string): string {
  const normalized = path.replace(/^#/, "").split("?")[0] || "/dashboard";
  if (normalized.startsWith("/operations")) return "Notas e operacoes";
  if (normalized.startsWith("/products")) return "Produtos";
  if (normalized.startsWith("/billing/rates")) return "Regras por saca";
  if (normalized.startsWith("/imports/spreadsheets")) return "Notas e operacoes";
  if (normalized.startsWith("/imports/xml")) return "Notas e operacoes";
  if (normalized.startsWith("/confirmations")) return "Confirmacoes";
  if (normalized.startsWith("/charges")) return "Cobrancas";
  if (normalized.startsWith("/client-ledger")) return "Conta-corrente";
  return navigationGroups.flatMap((group) => group.items).find((item) => item.path === normalized)?.legacyMenu ?? "Dashboard";
}
