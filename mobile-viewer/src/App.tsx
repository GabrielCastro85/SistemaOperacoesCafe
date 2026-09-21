import { useEffect, useState, type FormEvent } from "react";
import { apiJson, clearSession, hasStoredSession, login, logout } from "./api";
import { AppShell } from "./AppShell";
import { ChargesTab } from "./ChargesTab";
import { DashboardTab } from "./DashboardTab";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { assetUrl } from "./assetUrl";
import type { PageId } from "./navigation";
import type { LegalEntityLite, OrganizationLite } from "./types";

interface ViewerContext {
  user: { id: string; username: string; displayName: string };
  organizations: OrganizationLite[];
  legalEntities: LegalEntityLite[];
}

export function App(): JSX.Element {
  const [context, setContext] = useState<ViewerContext | null | undefined>(undefined);
  const [page, setPage] = useState<PageId>("dashboard");
  const [activeOrganizationId, setActiveOrganizationId] = useState("");
  const [activeLegalEntityId, setActiveLegalEntityId] = useState("");

  useEffect(() => {
    if (!hasStoredSession()) {
      setContext(null);
      return;
    }
    void loadContext();
  }, []);

  async function loadContext(): Promise<void> {
    try {
      const loaded = await apiJson<ViewerContext>("/v1/viewer/context");
      setContext(loaded);
      setActiveOrganizationId((current) => current || loaded.organizations[0]?.id || "");
    } catch {
      clearSession();
      setContext(null);
    }
  }

  useEffect(() => {
    if (!context) return;
    const candidates = context.legalEntities.filter((entity) => entity.organizationId === activeOrganizationId);
    setActiveLegalEntityId((current) => candidates.some((entity) => entity.id === current) ? current : candidates[0]?.id || "");
  }, [context, activeOrganizationId]);

  if (context === undefined) return <div className="auth-shell"><LoadingState label="Carregando..." /></div>;
  if (!context) return <LoginScreen onSuccess={() => void loadContext()} />;

  const legalEntities = context.legalEntities.filter((entity) => entity.organizationId === activeOrganizationId);
  return (
    <AppShell
      organizations={context.organizations}
      activeOrganizationId={activeOrganizationId}
      onOrganizationChange={setActiveOrganizationId}
      legalEntities={legalEntities}
      activeLegalEntityId={activeLegalEntityId}
      onLegalEntityChange={setActiveLegalEntityId}
      activePage={page}
      onNavigate={setPage}
      userDisplayName={context.user.displayName}
      onLogout={() => void logout().finally(() => setContext(null))}
    >
      <div className="content-section">
        {page === "dashboard" ? <DashboardTab organizationId={activeOrganizationId} legalEntityId={activeLegalEntityId || undefined} /> : null}
        {page === "charges" ? <ChargesTab organizationId={activeOrganizationId} legalEntityId={activeLegalEntityId || undefined} /> : null}
      </div>
    </AppShell>
  );
}

function LoginScreen({ onSuccess }: { onSuccess: () => void }): JSX.Element {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      onSuccess();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Usuario ou senha incorretos.");
    } finally { setLoading(false); }
  }

  return (
    <main className="auth-shell">
      <form className="auth-panel" onSubmit={(event) => void handleSubmit(event)}>
        <div className="auth-brand-row">
          <img src={assetUrl("assets/branding/villa/logo.svg")} alt="Villa Coffee" />
          <img src={assetUrl("assets/branding/grao/logo.svg")} alt="Grão e Grão" />
        </div>
        <span className="auth-eyebrow">Sistema de Operações de Café</span>
        <h1>Consulta</h1>
        <label>Usuário<input autoFocus value={username} onChange={(event) => setUsername(event.target.value)} required autoComplete="username" /></label>
        <label>
          Senha
          <div className="auth-password-field">
            <input type={passwordVisible ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
            <button type="button" className="auth-password-toggle" tabIndex={-1} onClick={() => setPasswordVisible((value) => !value)}>{passwordVisible ? "Ocultar" : "Mostrar"}</button>
          </div>
        </label>
        {error ? <div className="auth-error">{error}</div> : null}
        <button className="primary" type="submit" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
      </form>
    </main>
  );
}
