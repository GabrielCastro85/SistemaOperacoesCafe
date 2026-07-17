import { useEffect, useState } from "react";
import { getBrandingConfig } from "../../../shared/branding/branding";
import type { AppVariant, BillingSummary, BootstrapData, DealConfirmationSummary, FinancialSummary, InstallationProfile, LegalEntity, Location, Organization } from "../../../shared/types/domain";
import { formatCnpj, formatCurrencyFromCents } from "../../../shared/utils/format";
import { Button, Card, EmptyState, PageHeader, Select } from "../../design-system";

export function Splash(): JSX.Element {
  return (
    <main className="splash">
      <div className="splash-mark">OC</div>
      <h1>Operacoes Cafe</h1>
      <p>Carregando banco local e configuracoes da instalacao...</p>
    </main>
  );
}

export function SetupWizard({ data, onSaved }: { data: BootstrapData; onSaved: (profile: InstallationProfile) => void }): JSX.Element {
  const [variant, setVariant] = useState<AppVariant>(data.profile?.appVariant ?? "multiempresa");
  const [organizationId, setOrganizationId] = useState(data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "");
  const legalEntities = data.legalEntities.filter((entity) => entity.organizationId === organizationId);
  const [legalEntityId, setLegalEntityId] = useState(data.profile?.defaultLegalEntityId ?? legalEntities[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const branding = getBrandingConfig(variant);
  const selectedOrganization = data.organizations.find((item) => item.id === organizationId);

  useEffect(() => {
    setLegalEntityId(data.legalEntities.find((entity) => entity.organizationId === organizationId)?.id ?? "");
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
        completedSetup: true
      });
      onSaved(profile);
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Nao foi possivel salvar a configuracao inicial.");
    }
  }

  return (
    <main
      className="setup setup--branded"
      style={
        {
          "--brand-primary": branding.colors.primary,
          "--brand-accent": branding.colors.accent,
          "--brand-secondary": branding.colors.secondary
        } as React.CSSProperties
      }
    >
      <section className="setup-panel">
        <span className="eyebrow">Configuracao inicial</span>
        <h1>Selecione a empresa</h1>
        <p>Um unico sistema-base com identidade, dados e atalhos separados por empresa.</p>
        <div className="field">
          <label>Variante</label>
          <div className="company-choice-grid">
            {(["villa", "grao", "multiempresa"] as AppVariant[]).map((item) => (
              <button key={item} className={variant === item ? "company-choice active" : "company-choice"} onClick={() => setVariant(item)}>
                <img src={item === "grao" ? "/assets/branding/grao/logo.png" : "/assets/branding/villa/logo.png"} alt="" />
                <span>{getBrandingConfig(item).name}</span>
                <small>{item === "multiempresa" ? "Gestao centralizada" : getBrandingConfig(item).appDisplayName}</small>
              </button>
            ))}
          </div>
        </div>
        <Select label="Organizacao padrao" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>{data.organizations.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</Select>
        <Select label="CNPJ padrao" value={legalEntityId} onChange={(event) => setLegalEntityId(event.target.value)}>{legalEntities.map((item) => <option key={item.id} value={item.id}>{item.tradeName} - {formatCnpj(item.cnpj)}</option>)}</Select>
        <div className="setup-summary">
          <strong>{selectedOrganization?.displayName ?? branding.name}</strong>
          <span>Branding por empresa, atualizacoes centralizadas e banco local offline.</span>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <Button variant="primary" onClick={() => void save()} disabled={!organizationId}>Entrar no sistema</Button>
      </section>
    </main>
  );
}

export function Dashboard({ organizations, legalEntities, locations, organizationId }: { organizations: Organization[]; legalEntities: LegalEntity[]; locations: Location[]; organizationId?: string }): JSX.Element {
  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(null);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [confirmationSummary, setConfirmationSummary] = useState<DealConfirmationSummary | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    void Promise.all([
      window.operationsCafe.getBillingSummary(organizationId),
      window.operationsCafe.getFinancialSummary(organizationId),
      window.operationsCafe.getDealConfirmationSummary({ organizationId })
    ]).then(([billing, financial, confirmations]) => {
      setBillingSummary(billing);
      setFinancialSummary(financial);
      setConfirmationSummary(confirmations);
    });
  }, [organizationId]);

  const totalReceivable = billingSummary?.openCents ?? 0;
  const totalPayables = financialSummary?.openCents ?? 0;
  const confirmationCount = confirmationSummary?.issued ?? 0;
  const sacks = Number(confirmationSummary?.totalSacksDecimal ?? 0);
  const monthBars = [38, 52, 64, 92, 86, 61, 57, 72, 68, 75, 70, 78];
  const statusSlices = [
    { label: "Confirmadas", value: confirmationCount || 62 },
    { label: "Pendentes", value: confirmationSummary?.waitingSignature ?? 10 },
    { label: "Financeiro", value: billingSummary?.unbilledOperations ?? 8 }
  ];

  return (
    <section className="content-section">
      <PageHeader eyebrow="Visao geral" title="Dashboard operacional" description="Indicadores locais para operacao, recebimentos, financeiro interno e confirmacoes de negocio." />
      <div className="dashboard-grid dashboard-grid--hero">
        <Card><span>Sacas negociadas</span><strong>{sacks ? sacks.toLocaleString("pt-BR") : "0"}</strong><small>Volume comercial confirmado</small></Card>
        <Card><span>Valor total das operacoes</span><strong>{formatCurrencyFromCents(totalReceivable + Math.max(totalPayables, 0))}</strong><small>Operacao e financeiro local</small></Card>
        <Card><span>A receber</span><strong>{formatCurrencyFromCents(totalReceivable)}</strong><small>{billingSummary?.unbilledOperations ?? 0} operacoes sem cobranca</small></Card>
        <Card><span>Confirmacoes geradas</span><strong>{confirmationCount}</strong><small>{confirmationSummary?.waitingSignature ?? 0} aguardando assinatura</small></Card>
      </div>

      <div className="dashboard-workspace">
        <Card>
          <div className="ui-card__header">
            <div>
              <span className="ui-eyebrow">Notas e operações</span>
              <h2>Fluxo operacional</h2>
            </div>
            <Button onClick={() => { window.location.hash = "#/operations"; }}>Abrir notas</Button>
          </div>
          <div className="workflow-grid">
            {[
              ["01", "Importar NF-e", "XML/PDF e cadastro manual"],
              ["02", "Aplicar regra", "Cliente, tipo e valor por saca"],
              ["03", "Gerar cobranca", "Periodo semanal, mensal ou trimestral"],
              ["04", "Confirmar negocio", "PDF numerado para assinatura"]
            ].map(([step, title, text]) => (
              <article key={step}>
                <strong>{step}</strong>
                <span>{title}</span>
                <small>{text}</small>
              </article>
            ))}
          </div>
        </Card>

        <Card>
          <div className="ui-card__header">
            <div>
              <span className="ui-eyebrow">Totais por mês</span>
              <h2>Operações e sacas</h2>
            </div>
            <select aria-label="Ano"><option>2026</option></select>
          </div>
          <div className="mini-chart" aria-label="Grafico mensal de operacoes">
            {monthBars.map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}
          </div>
          <div className="chart-months"><span>Jan</span><span>Mar</span><span>Mai</span><span>Jul</span><span>Set</span><span>Nov</span></div>
        </Card>

        <Card>
          <div className="ui-card__header">
            <div>
              <span className="ui-eyebrow">Resumo do periodo</span>
              <h2>Status operacional</h2>
            </div>
          </div>
          <div className="status-donut" aria-label="Operacoes por status">
            <strong>{statusSlices.reduce((sum, item) => sum + item.value, 0)}</strong>
            <span>Total</span>
          </div>
          <div className="status-list">
            {statusSlices.map((item) => (
              <p key={item.label}><span />{item.label}<strong>{item.value}</strong></p>
            ))}
          </div>
        </Card>

        <Card>
          <div className="ui-card__header">
            <div>
              <span className="ui-eyebrow">Multiempresa</span>
              <h2>Estrutura ativa</h2>
            </div>
          </div>
          <div className="dashboard-grid dashboard-grid--compact">
            <article><span>Organizações</span><strong>{organizations.length}</strong></article>
            <article><span>CNPJs</span><strong>{legalEntities.length}</strong></article>
            <article><span>Locais</span><strong>{locations.length}</strong></article>
            <article><span>Créditos</span><strong>{formatCurrencyFromCents(billingSummary?.availableCreditsCents ?? 0)}</strong></article>
          </div>
        </Card>
      </div>
    </section>
  );
}

export function NotFoundPage(): JSX.Element {
  return (
    <section className="content-section">
      <EmptyState title="Pagina nao encontrada" description="A rota informada nao corresponde a uma tela disponivel." action={<Button variant="primary" onClick={() => { window.location.hash = "#/dashboard"; }}>Voltar ao Dashboard</Button>} />
    </section>
  );
}
