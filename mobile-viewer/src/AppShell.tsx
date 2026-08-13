import { useMemo, useState } from "react";
import { buildUiTheme, themeToCssVariables } from "./renderer/design-system/theme/theme";
import {
  CheckCircleIcon,
  CoinsIcon,
  DashboardIcon,
  HandshakeIcon,
  InvoiceIcon,
  LedgerIcon,
  PackageIcon,
  RateIcon,
  ReportIcon,
  WalletIcon
} from "./renderer/design-system/components/Icons";
import { navigationGroups, pageTitleById, type NavigationItem, type PageId } from "./navigation";
import type { OrganizationLite } from "./types";

function renderNavigationIcon(item: NavigationItem): JSX.Element {
  switch (item.id) {
    case "dashboard":
      return <DashboardIcon />;
    case "invoices":
      return <InvoiceIcon />;
    case "partners":
      return <HandshakeIcon />;
    case "products":
      return <PackageIcon />;
    case "rates":
    case "purchaseRates":
      return <RateIcon />;
    case "purchaseSettlements":
    case "finance":
      return <WalletIcon />;
    case "confirmations":
      return <CheckCircleIcon />;
    case "charges":
      return <CoinsIcon />;
    case "ledger":
      return <LedgerIcon />;
    case "reports":
      return <ReportIcon />;
    default:
      return <DashboardIcon />;
  }
}

export interface AppShellProps {
  organizations: OrganizationLite[];
  activeOrganizationId: string;
  onOrganizationChange: (organizationId: string) => void;
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  userEmail: string;
  onLogout: () => void;
  children: React.ReactNode;
}

export function AppShell({
  organizations,
  activeOrganizationId,
  onOrganizationChange,
  activePage,
  onNavigate,
  userEmail,
  onLogout,
  children
}: AppShellProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const activeOrganization = organizations.find((org) => org.id === activeOrganizationId) ?? null;
  const theme = useMemo(() => buildUiTheme("multiempresa", activeOrganization), [activeOrganization]);
  const logoSrc =
    activeOrganization?.slug === "villa" || activeOrganization?.displayName.toLowerCase().includes("villa")
      ? "/assets/branding/villa/logo.svg"
      : activeOrganization?.slug === "grao" || activeOrganization?.displayName.toLowerCase().includes("gr")
        ? "/assets/branding/grao/logo.svg"
        : null;

  function navigate(page: PageId): void {
    onNavigate(page);
    setMobileNavOpen(false);
  }

  return (
    <main
      className={`app-shell professional-shell ${collapsed ? "is-collapsed" : ""} ${mobileNavOpen ? "mobile-nav-open" : ""}`}
      style={themeToCssVariables(theme)}
    >
      {mobileNavOpen ? <div className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} /> : null}
      <aside className="sidebar app-sidebar" aria-label="Navegação principal">
        <div className="app-sidebar__brand">
          {logoSrc ? <img src={logoSrc} alt="" /> : <div className="brand-mark">{theme.organizationName.slice(0, 2).toUpperCase()}</div>}
          <div>
            <strong>{theme.appName}</strong>
            <span>{theme.organizationName}</span>
          </div>
        </div>
        <button
          className="sidebar-collapse"
          type="button"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? "→" : "←"}
        </button>
        <nav className="app-sidebar__nav">
          {navigationGroups.map((group) => (
            <section key={group.title}>
              <span className="nav-group-title">{group.title}</span>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={activePage === item.id ? "active" : ""}
                  title={collapsed ? item.label : undefined}
                  aria-current={activePage === item.id ? "page" : undefined}
                  onClick={() => navigate(item.id)}
                >
                  <span className="nav-icon" aria-hidden="true">
                    {renderNavigationIcon(item)}
                  </span>
                  <span className="nav-label">{item.label}</span>
                </button>
              ))}
            </section>
          ))}
        </nav>
        <footer className="app-sidebar__footer">
          <span>Consulta — somente leitura</span>
          <span>Operações Café</span>
        </footer>
      </aside>
      <section className="main-area app-main">
        <header className="topbar app-topbar">
          <div className="app-topbar__brandline">
            <button className="mobile-nav-toggle" type="button" aria-label="Abrir menu" onClick={() => setMobileNavOpen(true)}>
              ☰
            </button>
            {logoSrc ? <img src={logoSrc} alt="" /> : <div className="brand-mark">{theme.organizationName.slice(0, 2).toUpperCase()}</div>}
            <div className="page-context">
              <span>{theme.appName}</span>
              <strong>{pageTitleById[activePage]}</strong>
              <small>Início / {pageTitleById[activePage]}</small>
            </div>
          </div>
          <label className="context-select">
            <span>Grupo</span>
            <select value={activeOrganizationId} onChange={(event) => onOrganizationChange(event.target.value)}>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.displayName}
                </option>
              ))}
            </select>
          </label>
          <div className="context-pill context-pill--user">
            <span>Usuário</span>
            <strong>{userEmail}</strong>
            <small>Somente visualização</small>
          </div>
          <div className="topbar-actions">
            <button type="button" onClick={onLogout}>
              Sair
            </button>
          </div>
        </header>
        {children}
        <footer className="app-statusbar">
          <span>Dados sincronizados do PC principal</span>
          <strong>Operações Café — Consulta</strong>
        </footer>
      </section>
    </main>
  );
}
