import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import { AppShell } from "./AppShell";
import { ChargesTab } from "./ChargesTab";
import { ConfirmationsTab } from "./ConfirmationsTab";
import { PartnersTab } from "./PartnersTab";
import { ProductsTab } from "./ProductsTab";
import { RateRulesTab } from "./RateRulesTab";
import { LedgerTab } from "./LedgerTab";
import { PurchaseSettlementsTab } from "./PurchaseSettlementsTab";
import { EmptyState } from "./renderer/design-system/components/EmptyState";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import type { PageId } from "./navigation";
import type { LegalEntityLite, OrganizationLite } from "./types";

type PlaceholderPageId = "dashboard" | "invoices" | "finance" | "reports";

const PLACEHOLDER_PAGES: Record<PlaceholderPageId, { title: string; description: string }> = {
  dashboard: {
    title: "Dashboard em construção",
    description: "Os indicadores gerais (recebimentos, sacas, confirmações do período) chegam aqui numa próxima atualização."
  },
  invoices: {
    title: "Notas e operações em construção",
    description: "A consulta das notas fiscais e operações lançadas no PC chega aqui numa próxima atualização."
  },
  finance: {
    title: "Visão financeira em construção",
    description: "O resumo financeiro geral chega aqui numa próxima atualização."
  },
  reports: {
    title: "Relatórios em construção",
    description: "Os relatórios do sistema chegam aqui numa próxima atualização."
  }
};

function isPlaceholderPage(page: PageId): page is PlaceholderPageId {
  return page === "dashboard" || page === "invoices" || page === "finance" || page === "reports";
}

function mapOrganization(row: Record<string, unknown>): OrganizationLite {
  return {
    id: row.id as string,
    slug: (row.slug as string) ?? "",
    displayName: (row.display_name as string) ?? "",
    appDisplayName: (row.app_display_name as string) ?? (row.display_name as string) ?? "",
    logoPath: (row.logo_path as string | null) ?? null,
    primaryColor: (row.primary_color as string) ?? "#263238",
    secondaryColor: (row.secondary_color as string) ?? "#F5F1E8",
    accentColor: (row.accent_color as string) ?? "#3C7D54"
  };
}

function mapLegalEntity(row: Record<string, unknown>): LegalEntityLite {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    tradeName: (row.trade_name as string) ?? "",
    cnpj: (row.cnpj as string | null) ?? null,
    state: (row.state as string | null) ?? null
  };
}

function resolveDisplayName(session: Session): string {
  const metadata = session.user.user_metadata as Record<string, unknown> | undefined;
  const fullName = (metadata?.full_name as string | undefined) ?? (metadata?.name as string | undefined);
  return fullName && fullName.trim() ? fullName : (session.user.email ?? "");
}

export function App(): JSX.Element {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [page, setPage] = useState<PageId>("charges");
  const [organizations, setOrganizations] = useState<OrganizationLite[] | null>(null);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string>("");
  const [legalEntities, setLegalEntities] = useState<LegalEntityLite[]>([]);
  const [activeLegalEntityId, setActiveLegalEntityId] = useState<string>("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    void supabase
      .from("organizations")
      .select("id, slug, display_name, app_display_name, logo_path, primary_color, secondary_color, accent_color, is_active")
      .eq("is_active", true)
      .order("display_name")
      .then(({ data }) => {
        const mapped = (data ?? []).map(mapOrganization);
        setOrganizations(mapped);
        setActiveOrganizationId((current) => current || mapped[0]?.id || "");
      });
    void supabase
      .from("legal_entities")
      .select("id, organization_id, trade_name, cnpj, state, is_active, document_prefix")
      .eq("is_active", true)
      .order("trade_name")
      .then(({ data }) => {
        const ownEntities = (data ?? []).filter((row) => row.document_prefix !== "TERC-XML");
        setLegalEntities(ownEntities.map(mapLegalEntity));
      });
  }, [session]);

  useEffect(() => {
    const entitiesInOrg = legalEntities.filter((entity) => entity.organizationId === activeOrganizationId);
    if (entitiesInOrg.length === 0) return;
    setActiveLegalEntityId((current) => (entitiesInOrg.some((entity) => entity.id === current) ? current : entitiesInOrg[0].id));
  }, [legalEntities, activeOrganizationId]);

  if (session === undefined) {
    return (
      <div className="auth-shell">
        <LoadingState label="Carregando..." />
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  if (!organizations) {
    return (
      <div className="auth-shell">
        <LoadingState label="Carregando empresas..." />
      </div>
    );
  }

  return (
    <AppShell
      organizations={organizations}
      activeOrganizationId={activeOrganizationId}
      onOrganizationChange={setActiveOrganizationId}
      legalEntities={legalEntities.filter((entity) => entity.organizationId === activeOrganizationId)}
      activeLegalEntityId={activeLegalEntityId}
      onLegalEntityChange={setActiveLegalEntityId}
      activePage={page}
      onNavigate={setPage}
      userDisplayName={resolveDisplayName(session)}
      onLogout={() => void supabase.auth.signOut()}
    >
      <div className="content-section">
        {page === "charges" ? <ChargesTab /> : null}
        {page === "confirmations" ? <ConfirmationsTab /> : null}
        {page === "partners" ? <PartnersTab /> : null}
        {page === "products" ? <ProductsTab /> : null}
        {page === "rates" ? (
          <RateRulesTab
            table="service_rate_rules"
            eyebrow="Comercial"
            title="Regras por saca"
            description="Regras de cobrança de serviço por saca, cadastradas no PC principal."
          />
        ) : null}
        {page === "purchaseRates" ? (
          <RateRulesTab
            table="purchase_rate_rules"
            eyebrow="Pagamentos"
            title="Regras de entrada"
            description="Regras de valor pago por saca na entrada, cadastradas no PC principal."
          />
        ) : null}
        {page === "ledger" ? <LedgerTab /> : null}
        {page === "purchaseSettlements" ? <PurchaseSettlementsTab /> : null}
        {isPlaceholderPage(page) ? <EmptyState title={PLACEHOLDER_PAGES[page].title} description={PLACEHOLDER_PAGES[page].description} /> : null}
      </div>
    </AppShell>
  );
}

function LoginScreen(): JSX.Element {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError("E-mail ou senha incorretos.");
    setLoading(false);
  }

  function handlePasswordKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter") void handleSubmit(event as unknown as FormEvent);
  }

  return (
    <main className="auth-shell">
      <form className="auth-panel" onSubmit={(event) => void handleSubmit(event)}>
        <div className="auth-brand-row">
          <img src="/assets/branding/villa/logo.svg" alt="Villa Coffee" />
          <img src="/assets/branding/grao/logo.svg" alt="Grão e Grão" />
        </div>
        <span className="auth-eyebrow">Sistema de Operações de Café</span>
        <h1>Consulta</h1>
        <label>
          E-mail
          <input
            autoFocus
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="username"
          />
        </label>
        <label>
          Senha
          <div className="auth-password-field">
            <input
              type={passwordVisible ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={handlePasswordKeyDown}
              required
            />
            <button type="button" className="auth-password-toggle" tabIndex={-1} onClick={() => setPasswordVisible((value) => !value)}>
              {passwordVisible ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </label>
        {error ? <div className="auth-error">{error}</div> : null}
        <button className="primary" type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
