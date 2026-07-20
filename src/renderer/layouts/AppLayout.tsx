import { useMemo, useState, type ReactNode } from "react";
import type { AppVariant, AuthSession, LegalEntity, Organization } from "../../shared/types/domain";
import { navigationGroups, routeIdFromLegacyMenu } from "../app/navigation";
import { buildUiTheme, themeToCssVariables } from "../design-system";
import { formatCnpj } from "../../shared/utils/format";
import { resolveOrganizationLogoSrc } from "../../shared/branding/branding";

export interface AppLayoutProps {
  variant: AppVariant;
  organization: Organization | null;
  organizations: Organization[];
  legalEntity: LegalEntity | null;
  legalEntities: LegalEntity[];
  activeMenu: string;
  canSwitchOrganization: boolean;
  canSwitchLegalEntity: boolean;
  version: string;
  session: AuthSession;
  onNavigate: (menu: string) => void;
  onOrganizationChange: (organizationId: string) => void;
  onLegalEntityChange: (legalEntityId: string) => void;
  onLock: () => void;
  onLogout: () => void;
  children: ReactNode;
}

export function AppLayout({
  variant,
  organization,
  organizations,
  legalEntity,
  legalEntities,
  activeMenu,
  canSwitchOrganization,
  canSwitchLegalEntity,
  version,
  session,
  onNavigate,
  onOrganizationChange,
  onLegalEntityChange,
  onLock,
  onLogout,
  children
}: AppLayoutProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const activeRoute = routeIdFromLegacyMenu(activeMenu);
  const theme = useMemo(() => buildUiTheme(variant, organization), [variant, organization]);
  const logoSrc = resolveOrganizationLogoSrc(organization, variant);
  const legalEntityLabel = legalEntity ? `${legalEntity.tradeName} - ${formatCnpj(legalEntity.cnpj)}` : "Nenhum CNPJ ativo";

  return (
    <main className={`app-shell professional-shell ${collapsed ? "is-collapsed" : ""}`} style={themeToCssVariables(theme)}>
      <aside className="sidebar app-sidebar" aria-label="Navegação principal">
        <div className="app-sidebar__brand">
          {logoSrc ? <img src={logoSrc} alt="" /> : <div className="brand-mark">{theme.organizationName.slice(0, 2).toUpperCase()}</div>}
          <div>
            <strong>{theme.appName}</strong>
            <span>{theme.organizationName}</span>
          </div>
        </div>
        <button className="sidebar-collapse" type="button" aria-label={collapsed ? "Expandir menu" : "Recolher menu"} onClick={() => setCollapsed((value) => !value)}>
          {collapsed ? "→" : "←"}
        </button>
        <nav className="app-sidebar__nav">
          {navigationGroups.map((group) => (
            <section key={group.title}>
              <span className="nav-group-title">{group.title}</span>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={activeRoute === item.id ? "active" : ""}
                  title={collapsed ? item.label : undefined}
                  aria-current={activeRoute === item.id ? "page" : undefined}
                  onClick={() => onNavigate(item.legacyMenu)}
                >
                  <span className="nav-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="nav-label">{item.label}</span>
                </button>
              ))}
            </section>
          ))}
        </nav>
        <footer className="app-sidebar__footer">
          <span>Backup automático ativo</span>
          <span>Versão</span>
          <strong>{version}</strong>
        </footer>
      </aside>
      <section className="main-area app-main">
        <header className="topbar app-topbar">
          <div className="app-topbar__brandline">
            {logoSrc ? <img src={logoSrc} alt="" /> : <div className="brand-mark">{theme.organizationName.slice(0, 2).toUpperCase()}</div>}
            <div className="page-context">
              <span>{theme.appName}</span>
              <strong>{activeMenu}</strong>
              <small>Início / {activeMenu}</small>
            </div>
          </div>
          <label className="context-select">
            <span>Empresa</span>
            <select value={organization?.id ?? ""} disabled={!canSwitchOrganization} onChange={(event) => onOrganizationChange(event.target.value)}>
              {organizations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="context-select">
            <span>CNPJ próprio</span>
            <select value={legalEntity?.id ?? ""} disabled={!canSwitchLegalEntity} onChange={(event) => onLegalEntityChange(event.target.value)}>
              {legalEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.tradeName}
                </option>
              ))}
            </select>
            <small>{legalEntityLabel}</small>
          </label>
          <div className="context-pill context-pill--user">
            <span>Usuário</span>
            <strong>{session.user.displayName}</strong>
            <small>Administrador</small>
          </div>
          <div className="topbar-actions">
            <button type="button" onClick={onLock}>Bloquear</button>
            <button type="button" onClick={onLogout}>Sair</button>
          </div>
        </header>
        {children}
        <footer className="app-statusbar">
          <span>Backup automático ativo</span>
          <strong>{theme.appName} {version}</strong>
        </footer>
      </section>
    </main>
  );
}

