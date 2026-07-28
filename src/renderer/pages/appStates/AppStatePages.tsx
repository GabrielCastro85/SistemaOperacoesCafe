import { useEffect, useState, type CSSProperties } from "react";
import { getBrandingConfig, resolveOrganizationLogoSrc } from "../../../shared/branding/branding";
import type { BillingSummary, BootstrapData, DashboardAlerts, DealConfirmationSummary, InstallationProfile, LegalEntity, Location, Organization } from "../../../shared/types/domain";
import { formatCnpj, formatCurrencyFromCents } from "../../../shared/utils/format";
import { Badge, Button, Card, CheckCircleIcon, CoinsIcon, EmptyState, PageHeader, SackIcon, Select, WalletIcon } from "../../design-system";

function isOperationalLegalEntity(entity: LegalEntity): boolean {
  return entity.documentPrefix !== "TERC-XML";
}

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
  const variant = "multiempresa";
  const activeLegalEntities = data.legalEntities.filter((entity) => entity.isActive && isOperationalLegalEntity(entity));
  const firstLegalEntity = activeLegalEntities[0] ?? data.legalEntities[0] ?? null;
  const [legalEntityId, setLegalEntityId] = useState(data.profile?.defaultLegalEntityId ?? firstLegalEntity?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const branding = getBrandingConfig(variant);
  const selectedLegalEntity = data.legalEntities.find((item) => item.id === legalEntityId) ?? firstLegalEntity;
  const selectedOrganization = data.organizations.find((item) => item.id === selectedLegalEntity?.organizationId) ?? data.organizations[0] ?? null;
  const organizationId = selectedOrganization?.id ?? "";

  async function save(): Promise<void> {
    try {
      const selectedOrganization = data.organizations.find((item) => item.id === organizationId);
      const profile = await window.operationsCafe.saveInstallationProfile({
        installationName: `${selectedOrganization?.displayName ?? "Instalacao"} - Windows`,
        appVariant: variant,
        defaultOrganizationId: organizationId || null,
        defaultLegalEntityId: selectedLegalEntity?.id ?? null,
        allowOrganizationSwitch: true,
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
        } as CSSProperties
      }
    >
      <section className="setup-panel">
        <span className="eyebrow">Configuracao inicial</span>
        <h1>Selecione a empresa</h1>
        <p>Um unico sistema-base com identidade, dados e atalhos separados por empresa.</p>
        <div className="field">
          <label>Empresas disponiveis</label>
          <div className="company-choice-grid">
            {activeLegalEntities.map((entity) => {
              const organization = data.organizations.find((item) => item.id === entity.organizationId) ?? null;
              const logoSrc = resolveOrganizationLogoSrc(organization, variant);
              return (
              <button key={entity.id} className={legalEntityId === entity.id ? "company-choice active" : "company-choice"} onClick={() => setLegalEntityId(entity.id)}>
                {logoSrc ? <img src={logoSrc} alt="" /> : null}
                <span>{entity.tradeName}</span>
                <small>{formatCnpj(entity.cnpj)}</small>
              </button>
              );
            })}
          </div>
        </div>
        <Select label="Empresa inicial" value={legalEntityId} onChange={(event) => setLegalEntityId(event.target.value)}>{activeLegalEntities.map((item) => <option key={item.id} value={item.id}>{item.tradeName} - {formatCnpj(item.cnpj)}</option>)}</Select>
        <div className="setup-summary">
          <strong>{selectedLegalEntity?.tradeName ?? selectedOrganization?.displayName ?? branding.name}</strong>
          <span>{formatCnpj(selectedLegalEntity?.cnpj ?? null)} - branding por empresa, atualizacoes centralizadas e banco local offline.</span>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <Button variant="primary" onClick={() => void save()} disabled={!organizationId}>Entrar no sistema</Button>
      </section>
    </main>
  );
}

export function Dashboard({ organizations, legalEntities, locations, organizationId, ownLegalEntityId }: { organizations: Organization[]; legalEntities: LegalEntity[]; locations: Location[]; organizationId?: string; ownLegalEntityId?: string | null }): JSX.Element {
  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(null);
  const [confirmationSummary, setConfirmationSummary] = useState<DealConfirmationSummary | null>(null);
  const [operationalIndicators, setOperationalIndicators] = useState<{ documents: number; pending: number; confirmed: number; operations: number; sacksDecimal: string; fiscalAmountCents: number; serviceAmountCents: number } | null>(null);
  const [alerts, setAlerts] = useState<DashboardAlerts | null>(null);
  const [monthlyTotals, setMonthlyTotals] = useState<Array<{ month: number; sacksDecimal: string; amountCents: number; operationCount: number }>>([]);
  const [chartYear, setChartYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (!organizationId) return;
    void Promise.all([
      window.operationsCafe.getBillingSummary({ organizationId, ownLegalEntityId }),
      window.operationsCafe.getOperationalIndicators({ organizationId, ownLegalEntityId }),
      window.operationsCafe.getDealConfirmationSummary({ organizationId, ownLegalEntityId: ownLegalEntityId ?? null, dateStart: null, dateEnd: null, sellerPartnerId: null, buyerPartnerId: null, productId: null, status: null, signatureStatus: null }),
      window.operationsCafe.getDashboardAlerts({ organizationId, ownLegalEntityId })
    ]).then(([billing, operations, confirmations, dashboardAlerts]) => {
      setBillingSummary(billing);
      setOperationalIndicators(operations);
      setConfirmationSummary(confirmations);
      setAlerts(dashboardAlerts);
    });
  }, [organizationId, ownLegalEntityId]);

  useEffect(() => {
    if (!organizationId) return;
    void window.operationsCafe.getMonthlyOperationTotals({ organizationId, ownLegalEntityId, year: chartYear }).then(setMonthlyTotals);
  }, [organizationId, ownLegalEntityId, chartYear]);

  const totalReceivable = billingSummary?.openCents ?? 0;
  const totalCommercialAmount = operationalIndicators?.fiscalAmountCents ?? 0;
  const confirmationCount = confirmationSummary?.issued ?? 0;
  const sacks = Number(operationalIndicators?.sacksDecimal ?? 0);
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
  const hasAlerts = Boolean(alerts && (alerts.overdueCharges.length || alerts.waitingSignatureConfirmations.length || alerts.partnersNearCreditLimit.length));

  return (
    <section className="content-section">
      <PageHeader eyebrow="Visao geral" title="Dashboard operacional" description="Indicadores locais para operacao, recebimentos, financeiro interno e confirmacoes de negocio." />
      <div className="dashboard-grid dashboard-grid--hero">
        <Card><span className="kpi-icon"><SackIcon /></span><span>Sacas negociadas</span><strong>{sacks ? sacks.toLocaleString("pt-BR") : "0"}</strong><small>Volume das notas lancadas</small></Card>
        <Card><span className="kpi-icon"><CoinsIcon /></span><span>Valor total das notas</span><strong>{formatCurrencyFromCents(totalCommercialAmount)}</strong><small>Valor comercial das NFs lancadas</small></Card>
        <Card><span className="kpi-icon"><WalletIcon /></span><span>A receber</span><strong>{formatCurrencyFromCents(totalReceivable)}</strong><small>{billingSummary?.unbilledOperations ?? 0} operacoes sem cobranca</small></Card>
        <Card><span className="kpi-icon"><CheckCircleIcon /></span><span>Confirmacoes geradas</span><strong>{confirmationCount}</strong><small>{confirmationSummary?.waitingSignature ?? 0} aguardando assinatura</small></Card>
      </div>

      {hasAlerts && alerts ? (
        <Card>
          <div className="ui-card__header">
            <div>
              <span className="ui-eyebrow">Atenção</span>
              <h2>Alertas</h2>
            </div>
          </div>
          <div className="alert-list">
            {alerts.overdueCharges.map((item) => (
              <button key={item.chargeId} className="alert-item" onClick={() => { window.location.hash = "#/charges"; }}>
                <Badge tone="danger">Cobranca vencida</Badge>
                <span>{item.partnerName} - {formatCurrencyFromCents(item.openAmountCents)} em aberto ha {item.daysOverdue} dia(s)</span>
              </button>
            ))}
            {alerts.waitingSignatureConfirmations.map((item) => (
              <button key={item.confirmationId} className="alert-item" onClick={() => { window.location.hash = "#/confirmations"; }}>
                <Badge tone="warning">Aguardando assinatura</Badge>
                <span>{item.confirmationNumber} - {item.buyerName}, ha {item.daysWaiting} dia(s)</span>
              </button>
            ))}
            {alerts.partnersNearCreditLimit.map((item) => (
              <button key={item.partnerId} className="alert-item" onClick={() => { window.location.hash = "#/partners"; }}>
                <Badge tone="warning">Limite de credito</Badge>
                <span>{item.partnerName} - {item.percentUsed}% do limite ({formatCurrencyFromCents(item.outstandingCents)} de {formatCurrencyFromCents(item.creditLimitCents)})</span>
              </button>
            ))}
          </div>
        </Card>
      ) : null}

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
