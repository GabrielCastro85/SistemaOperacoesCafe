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
    <main className="setup" style={{ "--brand-primary": branding.colors.primary, "--brand-accent": branding.colors.accent } as React.CSSProperties}>
      <section className="setup-panel">
        <span className="eyebrow">Configuracao inicial</span>
        <h1>{branding.appDisplayName}</h1>
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
        <Select label="Organizacao padrao" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>{data.organizations.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</Select>
        <Select label="CNPJ padrao" value={legalEntityId} onChange={(event) => setLegalEntityId(event.target.value)}>{legalEntities.map((item) => <option key={item.id} value={item.id}>{item.tradeName} - {formatCnpj(item.cnpj)}</option>)}</Select>
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

  return (
    <section className="content-section">
      <PageHeader eyebrow="Visao geral" title="Dashboard operacional" description="Indicadores locais para operacao, recebimentos, financeiro interno e confirmacoes de negocio." />
      <div className="dashboard-grid">
        <Card><span>Organizacoes</span><strong>{organizations.length}</strong><small>Cadastros administrativos</small></Card>
        <Card><span>CNPJs proprios</span><strong>{legalEntities.length}</strong><small>Contextos de lancamento</small></Card>
        <Card><span>Locais</span><strong>{locations.length}</strong><small>Unidades e pontos operacionais</small></Card>
        <Card><span>Operacoes sem cobranca</span><strong>{billingSummary?.unbilledOperations ?? 0}</strong><small>Receita de servico pendente</small></Card>
        <Card><span>Saldo a receber</span><strong>{formatCurrencyFromCents(billingSummary?.openCents ?? 0)}</strong><small>Cobrancas emitidas em aberto</small></Card>
        <Card><span>Creditos de clientes</span><strong>{formatCurrencyFromCents(billingSummary?.availableCreditsCents ?? 0)}</strong><small>Conta-corrente disponivel</small></Card>
        <Card><span>Contas a pagar abertas</span><strong>{formatCurrencyFromCents(financialSummary?.openCents ?? 0)}</strong><small>Financeiro gerencial</small></Card>
        <Card><span>Contas vencidas</span><strong>{formatCurrencyFromCents(financialSummary?.overdueCents ?? 0)}</strong><small>Exige atencao operacional</small></Card>
        <Card><span>Fluxo projetado</span><strong>{formatCurrencyFromCents(financialSummary?.projectedResultCents ?? 0)}</strong><small>Recebimentos previstos menos pagamentos</small></Card>
        <Card><span>Confirmacoes emitidas</span><strong>{confirmationSummary?.issued ?? 0}</strong><small>Documentos comerciais</small></Card>
        <Card><span>Aguardando assinatura</span><strong>{confirmationSummary?.waitingSignature ?? 0}</strong><small>Controle documental</small></Card>
        <Card><span>Sacas confirmadas</span><strong>{confirmationSummary?.totalSacksDecimal ?? "0"}</strong><small>Volume comercial, nao receita</small></Card>
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
