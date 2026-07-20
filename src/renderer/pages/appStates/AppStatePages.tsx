import { useEffect, useState } from "react";
import { getBrandingConfig } from "../../../shared/branding/branding";
import type { AppVariant, BillingSummary, BootstrapData, DealConfirmationSummary, InstallationProfile, LegalEntity, Location, Organization } from "../../../shared/types/domain";
import { formatCnpj, formatCurrencyFromCents } from "../../../shared/utils/format";
import { Button, Card, CheckCircleIcon, CoinsIcon, EmptyState, PageHeader, SackIcon, Select, WalletIcon } from "../../design-system";

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
                <img src={item === "grao" ? "assets/branding/grao/logo.png" : "assets/branding/villa/logo.png"} alt="" />
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
  const [confirmationSummary, setConfirmationSummary] = useState<DealConfirmationSummary | null>(null);
  const [monthlyTotals, setMonthlyTotals] = useState<Array<{ month: number; sacksDecimal: string; amountCents: number; operationCount: number }>>([]);
  const [chartYear, setChartYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (!organizationId) return;
    void Promise.all([
      window.operationsCafe.getBillingSummary(organizationId),
      window.operationsCafe.getDealConfirmationSummary({ organizationId, ownLegalEntityId: null, dateStart: null, dateEnd: null, sellerPartnerId: null, buyerPartnerId: null, productId: null, status: null, signatureStatus: null })
    ]).then(([billing, confirmations]) => {
      setBillingSummary(billing);
      setConfirmationSummary(confirmations);
    });
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    void window.operationsCafe.getMonthlyOperationTotals({ organizationId, year: chartYear }).then(setMonthlyTotals);
  }, [organizationId, chartYear]);

  const totalReceivable = billingSummary?.openCents ?? 0;
  const totalCommercialAmount = confirmationSummary?.totalCommercialAmountCents ?? 0;
  const confirmationCount = confirmationSummary?.issued ?? 0;
  const sacks = Number(confirmationSummary?.totalSacksDecimal ?? 0);
  const maxMonthlyAmount = Math.max(1, ...monthlyTotals.map((item) => item.amountCents));
  const maxMonthlySacks = Math.max(1, ...monthlyTotals.map((item) => Number(item.sacksDecimal)));
  const monthBars = monthlyTotals.length ? monthlyTotals.map((item) => Math.round((item.amountCents / maxMonthlyAmount) * 100)) : Array.from({ length: 12 }, () => 0);
  const monthLine = monthlyTotals.length ? monthlyTotals.map((item) => Math.round((Number(item.sacksDecimal) / maxMonthlySacks) * 100)) : Array.from({ length: 12 }, () => 0);
  const linePoints = monthLine.map((value, index) => `${(index / Math.max(1, monthLine.length - 1)) * 100},${100 - value}`).join(" ");
  const hasMonthlyData = monthlyTotals.some((item) => item.operationCount > 0);
  const statusSlices = [
    { label: "Confirmadas", value: confirmationSummary?.issued ?? 0 },
    { label: "Aguardando assinatura", value: confirmationSummary?.waitingSignature ?? 0 },
    { label: "Rascunho/pendente", value: (confirmationSummary?.drafts ?? 0) + (confirmationSummary?.pendingReview ?? 0) }
  ];
  const statusTotal = statusSlices.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className="content-section">
      <PageHeader eyebrow="Visao geral" title="Dashboard operacional" description="Indicadores locais para operacao, recebimentos, financeiro interno e confirmacoes de negocio." />
      <div className="dashboard-grid dashboard-grid--hero">
        <Card><span className="kpi-icon"><SackIcon /></span><span>Sacas negociadas</span><strong>{sacks ? sacks.toLocaleString("pt-BR") : "0"}</strong><small>Volume comercial confirmado</small></Card>
        <Card><span className="kpi-icon"><CoinsIcon /></span><span>Valor total das operacoes</span><strong>{formatCurrencyFromCents(totalCommercialAmount)}</strong><small>Valor comercial das confirmacoes emitidas</small></Card>
        <Card><span className="kpi-icon"><WalletIcon /></span><span>A receber</span><strong>{formatCurrencyFromCents(totalReceivable)}</strong><small>{billingSummary?.unbilledOperations ?? 0} operacoes sem cobranca</small></Card>
        <Card><span className="kpi-icon"><CheckCircleIcon /></span><span>Confirmacoes geradas</span><strong>{confirmationCount}</strong><small>{confirmationSummary?.waitingSignature ?? 0} aguardando assinatura</small></Card>
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
            <select aria-label="Ano" value={chartYear} onChange={(event) => setChartYear(Number(event.target.value))}>
              {[chartYear - 2, chartYear - 1, chartYear].map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
          {hasMonthlyData ? (
            <>
              <div className="chart-legend">
                <span><i className="chart-legend__dot chart-legend__dot--bar" />Total operações (R$)</span>
                <span><i className="chart-legend__dot chart-legend__dot--line" />Total sacas</span>
              </div>
              <div className="mini-chart" aria-label="Grafico mensal de operacoes: barras de valor em reais e linha de sacas">
                {monthBars.map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}
                <svg className="mini-chart__line" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polyline points={linePoints} />
                </svg>
              </div>
              <div className="chart-months"><span>Jan</span><span>Mar</span><span>Mai</span><span>Jul</span><span>Set</span><span>Nov</span></div>
            </>
          ) : (
            <EmptyState title="Sem operacoes confirmadas" description={`Nenhuma operacao confirmada em ${chartYear} ainda.`} />
          )}
        </Card>

        <Card>
          <div className="ui-card__header">
            <div>
              <span className="ui-eyebrow">Resumo do periodo</span>
              <h2>Status operacional</h2>
            </div>
          </div>
          {statusTotal > 0 ? (
            <>
              <div className="status-donut" aria-label="Operacoes por status">
                <strong>{statusTotal}</strong>
                <span>Total</span>
              </div>
              <div className="status-list">
                {statusSlices.map((item) => (
                  <p key={item.label}><span />{item.label}<strong>{item.value}</strong></p>
                ))}
              </div>
            </>
          ) : (
            <EmptyState title="Sem confirmacoes ainda" description="Crie uma confirmacao de negocio para ver o resumo por status aqui." />
          )}
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
