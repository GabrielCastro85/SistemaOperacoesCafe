import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { getBrandingConfig } from "../shared/branding/branding";
import type { AppVariant, BootstrapData, Diagnostics, InstallationProfile, LegalEntity, Organization } from "../shared/types/domain";
import "./styles.css";

const menuItems = [
  "Dashboard",
  "Notas e operacoes",
  "Clientes",
  "Cobrancas",
  "Conta-corrente",
  "Confirmacoes",
  "Financeiro",
  "Relatorios",
  "Configuracoes",
  "Diagnostico"
];

function formatCnpj(cnpj: string | null): string {
  if (!cnpj) {
    return "CNPJ pendente";
  }
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function Splash(): JSX.Element {
  return (
    <main className="splash">
      <div className="splash-mark">OC</div>
      <h1>Operacoes Cafe</h1>
      <p>Carregando banco local e configuracoes da instalacao...</p>
    </main>
  );
}

function SetupWizard({
  data,
  onSaved
}: {
  data: BootstrapData;
  onSaved: (profile: InstallationProfile) => void;
}): JSX.Element {
  const [variant, setVariant] = useState<AppVariant>(data.profile?.appVariant ?? "multiempresa");
  const [organizationId, setOrganizationId] = useState<string>(data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "");
  const legalEntities = data.legalEntities.filter((entity) => entity.organizationId === organizationId);
  const [legalEntityId, setLegalEntityId] = useState<string>(data.profile?.defaultLegalEntityId ?? legalEntities[0]?.id ?? "");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const branding = getBrandingConfig(variant);

  useEffect(() => {
    const first = data.legalEntities.find((entity) => entity.organizationId === organizationId);
    setLegalEntityId(first?.id ?? "");
  }, [organizationId, data.legalEntities]);

  async function save(): Promise<void> {
    try {
      const selectedOrganization = data.organizations.find((item) => item.id === organizationId);
      const profile = await window.operationsCafe.saveInstallationProfile({
        installationName: `${selectedOrganization?.displayName ?? "Instalacao"} - Windows`,
        appVariant: variant,
        defaultOrganizationId: organizationId || null,
        defaultLegalEntityId: legalEntityId || null,
        allowOrganizationSwitch: variant === "multiempresa",
        allowLegalEntitySwitch: true,
        completedSetup: remember
      });
      onSaved(profile);
    } catch {
      setError("Nao foi possivel salvar a configuracao inicial.");
    }
  }

  return (
    <main className="setup" style={{ "--brand-primary": branding.colors.primary, "--brand-accent": branding.colors.accent } as React.CSSProperties}>
      <section className="setup-panel">
        <div>
          <span className="eyebrow">Configuracao inicial</span>
          <h1>{branding.appDisplayName}</h1>
          <p>Escolha como esta instalacao deve se comportar neste computador.</p>
        </div>

        <div className="field">
          <label>Variante</label>
          <div className="segmented">
            {(["villa", "grao", "multiempresa"] as AppVariant[]).map((item) => (
              <button key={item} className={variant === item ? "active" : ""} onClick={() => setVariant(item)}>
                {getBrandingConfig(item).name}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Organizacao padrao</label>
          <select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>
            {data.organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.displayName}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>CNPJ padrao</label>
          <select value={legalEntityId} onChange={(event) => setLegalEntityId(event.target.value)}>
            {legalEntities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.tradeName} - {formatCnpj(entity.cnpj)}
              </option>
            ))}
          </select>
        </div>

        <label className="checkbox">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          Lembrar esta instalacao
        </label>

        {error ? <p className="error">{error}</p> : null}
        <button className="primary" onClick={() => void save()} disabled={!organizationId}>
          Entrar no sistema
        </button>
      </section>
    </main>
  );
}

function DiagnosticsPage({ diagnostics }: { diagnostics: Diagnostics | null }): JSX.Element {
  if (!diagnostics) {
    return <ModulePlaceholder title="Diagnostico" />;
  }
  return (
    <section className="content-section">
      <h2>Diagnostico</h2>
      <div className="diagnostics-grid">
        {Object.entries({
          "Versao do aplicativo": diagnostics.appVersion,
          "Caminho do banco": diagnostics.databasePath,
          "Caminho dos documentos": diagnostics.documentsPath,
          "Variante ativa": diagnostics.activeVariant ?? "Nao definida",
          "Organizacao ativa": diagnostics.activeOrganization ?? "Nao definida",
          "CNPJ ativo": diagnostics.activeLegalEntity ?? "Nao definido",
          "Migration atual": diagnostics.currentMigration,
          "Status do banco": diagnostics.databaseStatus
        }).map(([label, value]) => (
          <div key={label} className="diagnostic-row">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function ModulePlaceholder({ title }: { title: string }): JSX.Element {
  return (
    <section className="content-section">
      <h2>{title}</h2>
      <p>Modulo em desenvolvimento. A fundacao tecnica ja esta preparada para evoluir esta area nas proximas etapas.</p>
    </section>
  );
}

function Dashboard({ organizations, legalEntities }: { organizations: Organization[]; legalEntities: LegalEntity[] }): JSX.Element {
  return (
    <section className="content-section">
      <h2>Inicio</h2>
      <p>Ambiente offline-first configurado para operacoes de cafe, com dados locais preservados entre atualizacoes.</p>
      <div className="cards">
        <article>
          <span>Organizacoes</span>
          <strong>{organizations.length}</strong>
        </article>
        <article>
          <span>CNPJs demonstrativos</span>
          <strong>{legalEntities.length}</strong>
        </article>
        <article>
          <span>Proximo modulo</span>
          <strong>Cadastros</strong>
        </article>
      </div>
    </section>
  );
}

function Shell({ data }: { data: BootstrapData }): JSX.Element {
  const [profile, setProfile] = useState(data.profile);
  const [activeMenu, setActiveMenu] = useState("Dashboard");
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const organization = data.organizations.find((item) => item.id === profile?.defaultOrganizationId) ?? data.organizations[0];
  const legalEntity = data.legalEntities.find((item) => item.id === profile?.defaultLegalEntityId);
  const branding = getBrandingConfig(profile?.appVariant ?? "multiempresa");
  const orgEntities = data.legalEntities.filter((item) => item.organizationId === organization?.id);

  useEffect(() => {
    document.documentElement.style.setProperty("--brand-primary", organization?.primaryColor ?? branding.colors.primary);
    document.documentElement.style.setProperty("--brand-secondary", organization?.secondaryColor ?? branding.colors.secondary);
    document.documentElement.style.setProperty("--brand-accent", organization?.accentColor ?? branding.colors.accent);
  }, [organization, branding]);

  useEffect(() => {
    if (activeMenu === "Diagnostico") {
      window.operationsCafe.getDiagnostics().then(setDiagnostics).catch(() => setDiagnostics(null));
    }
  }, [activeMenu, profile]);

  async function changeLegalEntity(id: string): Promise<void> {
    const updated = await window.operationsCafe.setActiveLegalEntity(id);
    setProfile(updated);
  }

  const page = useMemo(() => {
    if (activeMenu === "Dashboard") {
      return <Dashboard organizations={data.organizations} legalEntities={data.legalEntities} />;
    }
    if (activeMenu === "Diagnostico") {
      return <DiagnosticsPage diagnostics={diagnostics} />;
    }
    return <ModulePlaceholder title={activeMenu} />;
  }, [activeMenu, data.organizations, data.legalEntities, diagnostics]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">{organization?.displayName.slice(0, 2).toUpperCase() ?? "OC"}</div>
          <strong>{organization?.appDisplayName ?? branding.appDisplayName}</strong>
        </div>
        <nav>
          {menuItems.map((item) => (
            <button key={item} className={activeMenu === item ? "active" : ""} onClick={() => setActiveMenu(item)}>
              {item}
            </button>
          ))}
        </nav>
      </aside>
      <section className="main-area">
        <header className="topbar">
          <div>
            <span>Organizacao ativa</span>
            <strong>{organization?.displayName ?? "Nao definida"}</strong>
          </div>
          <div>
            <span>CNPJ ativo</span>
            <select value={legalEntity?.id ?? ""} onChange={(event) => void changeLegalEntity(event.target.value)}>
              {orgEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.tradeName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span>Usuario</span>
            <strong>Usuario provisorio</strong>
          </div>
          <div>
            <span>Versao</span>
            <strong>{data.version}</strong>
          </div>
        </header>
        {page}
      </section>
    </main>
  );
}

function App(): JSX.Element {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [profile, setProfile] = useState<InstallationProfile | null>(null);

  useEffect(() => {
    window.operationsCafe.getBootstrapData().then((bootstrap) => {
      setData(bootstrap);
      setProfile(bootstrap.profile);
    });
  }, []);

  if (!data) {
    return <Splash />;
  }
  if (!profile?.completedSetup) {
    return <SetupWizard data={data} onSaved={setProfile} />;
  }
  return <Shell data={{ ...data, profile }} />;
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
