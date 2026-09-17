import { useEffect, useState, type CSSProperties } from "react";
import { getBrandingConfig, resolveOrganizationLogoSrc } from "../../../shared/branding/branding";
import type { BillingSummary, BootstrapData, BusinessPartner, BusinessPartnerLegalEntity, DashboardAlerts, DealConfirmationSummary, InstallationProfile, LegalEntity, Location, Organization } from "../../../shared/types/domain";
import type { UpdateStatus } from "../../../shared/types/updater";
import { formatCnpj, formatCurrencyFromCents, isValidCnpj, onlyDigits } from "../../../shared/utils/format";
import { Alert, Badge, Button, Card, CheckCircleIcon, CoinsIcon, DateInput, EmptyState, FilterBar, Input, PageHeader, SackIcon, Select, WalletIcon } from "../../design-system";
import { PartnerQuickSearch } from "../../components/forms/PartnerQuickSearch";

const NEW_COMPANY_DEFAULT_COLORS = { primaryColor: "#1F6F4A", secondaryColor: "#0B3D26", accentColor: "#E0A94A" };

// So aparece quando NAO ha nenhum CNPJ pre-cadastrado no banco (nunca e' o
// caso da Villa/Grao, que sempre nascem com a semeadura de demonstracao) --
// e' o fluxo de "empresa unica" pra quem instala este programa do zero
// (cliente novo, instalador generico). Cria a organizacao + o primeiro CNPJ
// e ja deixa o app travado sem opcao de trocar de empresa (allowOrganizationSwitch:
// false), exatamente o pedido de "o programa cuida so de uma empresa".
function NewCompanySetupWizard({ onSaved }: { onSaved: (profile: InstallationProfile) => void }): JSX.Element {
  const [step, setStep] = useState<"empresa" | "marca">("empresa");
  const [cnpjInput, setCnpjInput] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [tradeName, setTradeName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [address, setAddress] = useState({ addressLine: "", addressNumber: "", addressComplement: "", district: "", city: "", state: "", postalCode: "" });
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [colors, setColors] = useState(NEW_COMPANY_DEFAULT_COLORS);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function lookupCnpj(): Promise<void> {
    const digits = onlyDigits(cnpjInput) ?? "";
    if (!isValidCnpj(digits)) {
      setError("Informe um CNPJ valido com 14 digitos.");
      return;
    }
    setError(null);
    setLookupLoading(true);
    try {
      const result = await window.operationsCafe.lookupCnpj(digits);
      setTradeName(result.tradeName || result.legalName);
      setLegalName(result.legalName);
      setAddress({
        addressLine: result.addressLine ?? "",
        addressNumber: result.addressNumber ?? "",
        addressComplement: result.addressComplement ?? "",
        district: result.district ?? "",
        city: result.city ?? "",
        state: result.state ?? "",
        postalCode: result.postalCode ?? ""
      });
      setMessage(`CNPJ encontrado: ${result.tradeName || result.legalName}.`);
    } catch (errorValue) {
      setMessage(null);
      setError(errorValue instanceof Error ? errorValue.message : "Falha ao consultar o CNPJ.");
    } finally {
      setLookupLoading(false);
    }
  }

  async function createCompany(): Promise<void> {
    const digits = onlyDigits(cnpjInput) ?? "";
    if (!isValidCnpj(digits)) { setError("Informe um CNPJ valido com 14 digitos."); return; }
    if (!tradeName.trim()) { setError("Informe o nome da empresa."); return; }
    if (!address.addressLine.trim() || !address.city.trim() || !address.state.trim() || !address.postalCode.trim()) {
      setError("Complete o endereco (rua, cidade, UF e CEP) -- use \"Buscar CNPJ\" pra preencher automaticamente.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const slug = tradeName.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `empresa-${Date.now()}`;
      const createdOrganization = await window.operationsCafe.createOrganization({
        name: tradeName.trim(),
        slug,
        displayName: tradeName.trim(),
        appDisplayName: tradeName.trim(),
        description: null,
        logoPath: null,
        compactLogoPath: null,
        iconPath: null,
        ...NEW_COMPANY_DEFAULT_COLORS,
        themeMode: "light",
        isActive: true
      });
      await window.operationsCafe.createLegalEntity({
        organizationId: createdOrganization.id,
        legalName: legalName.trim() || tradeName.trim(),
        tradeName: tradeName.trim(),
        cnpj: digits,
        stateRegistration: null,
        municipalRegistration: null,
        email: null,
        phone: null,
        addressLine: address.addressLine.trim(),
        addressNumber: address.addressNumber.trim() || "S/N",
        addressComplement: address.addressComplement.trim() || null,
        district: address.district.trim(),
        city: address.city.trim(),
        state: address.state.trim(),
        postalCode: onlyDigits(address.postalCode) ?? "",
        documentPrefix: null,
        isDraft: false,
        isActive: true
      });
      setOrganization(createdOrganization);
      setStep("marca");
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Nao foi possivel criar a empresa.");
    } finally {
      setSaving(false);
    }
  }

  async function selectLogo(): Promise<void> {
    if (!organization) return;
    const updated = await window.operationsCafe.selectOrganizationBrandingAsset(organization.id, "logo");
    setOrganization(updated);
  }

  async function finish(): Promise<void> {
    if (!organization) return;
    setError(null);
    setSaving(true);
    try {
      await window.operationsCafe.updateOrganizationColors(organization.id, colors);
      const entities = await window.operationsCafe.listLegalEntities({ organizationId: organization.id, status: "active" });
      const profile = await window.operationsCafe.saveInstallationProfile({
        installationName: `${organization.displayName} - Windows`,
        appVariant: "multiempresa",
        defaultOrganizationId: organization.id,
        defaultLegalEntityId: entities[0]?.id ?? null,
        allowOrganizationSwitch: false,
        allowLegalEntitySwitch: false,
        completedSetup: true
      });
      onSaved(profile);
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Nao foi possivel concluir a configuracao.");
    } finally {
      setSaving(false);
    }
  }

  if (step === "marca" && organization) {
    return (
      <main className="setup setup--branded">
        <section className="setup-panel">
          <span className="eyebrow">Configuracao inicial</span>
          <h1>Identidade visual de {organization.displayName}</h1>
          <p>Envie a logo e escolha as cores -- valem pra tela e pros PDFs gerados. Da pra ajustar depois em Configuracoes.</p>
          {error ? <Alert variant="danger">{error}</Alert> : null}
          <div className="field">
            <label>Logo</label>
            <p>{organization.logoPath ? "Logo enviada" : "Nenhuma logo enviada ainda (opcional)"}</p>
            <Button onClick={() => void selectLogo()}>Selecionar arquivo</Button>
          </div>
          <div className="color-field-grid">
            {(["primaryColor", "secondaryColor", "accentColor"] as const).map((key) => (
              <label key={key} className="color-field">
                <span>{key === "primaryColor" ? "Cor primaria" : key === "secondaryColor" ? "Cor secundaria" : "Cor de destaque"}</span>
                <div className="color-field__row">
                  <input type="color" value={colors[key]} onChange={(event) => setColors((prev) => ({ ...prev, [key]: event.target.value }))} />
                  <span className="color-field__hex">{colors[key]}</span>
                </div>
              </label>
            ))}
          </div>
          <Button variant="primary" onClick={() => void finish()} loading={saving}>Concluir configuracao</Button>
        </section>
      </main>
    );
  }

  return (
    <main className="setup setup--branded">
      <section className="setup-panel">
        <span className="eyebrow">Configuracao inicial</span>
        <h1>Cadastre sua empresa</h1>
        <p>Este programa cuida de uma empresa por instalacao. Se voce tiver mais de uma empresa, instale o programa separadamente pra cada uma.</p>
        {error ? <Alert variant="danger">{error}</Alert> : null}
        {message ? <Alert variant="success">{message}</Alert> : null}
        <div className="inline-actions">
          <Input label="CNPJ" value={cnpjInput} onChange={(event) => setCnpjInput(event.target.value)} placeholder="00.000.000/0000-00" />
          <Button onClick={() => void lookupCnpj()} loading={lookupLoading}>Buscar CNPJ</Button>
        </div>
        <Input label="Nome da empresa" value={tradeName} onChange={(event) => setTradeName(event.target.value)} />
        <Input label="Razao social" value={legalName} onChange={(event) => setLegalName(event.target.value)} />
        <Input label="Endereco" value={address.addressLine} onChange={(event) => setAddress((prev) => ({ ...prev, addressLine: event.target.value }))} />
        <div className="inline-actions">
          <Input label="Numero" value={address.addressNumber} onChange={(event) => setAddress((prev) => ({ ...prev, addressNumber: event.target.value }))} />
          <Input label="Bairro" value={address.district} onChange={(event) => setAddress((prev) => ({ ...prev, district: event.target.value }))} />
        </div>
        <div className="inline-actions">
          <Input label="Cidade" value={address.city} onChange={(event) => setAddress((prev) => ({ ...prev, city: event.target.value }))} />
          <Input label="UF" value={address.state} onChange={(event) => setAddress((prev) => ({ ...prev, state: event.target.value.toUpperCase() }))} maxLength={2} />
          <Input label="CEP" value={address.postalCode} onChange={(event) => setAddress((prev) => ({ ...prev, postalCode: event.target.value }))} />
        </div>
        <Button variant="primary" onClick={() => void createCompany()} loading={saving}>Continuar</Button>
      </section>
    </main>
  );
}

function isOperationalLegalEntity(entity: LegalEntity): boolean {
  return entity.documentPrefix !== "TERC-XML";
}

function localDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentMonthToDateRange(): { periodStart: string; periodEnd: string } {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return { periodStart: localDateInputValue(start), periodEnd: localDateInputValue(today) };
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
  // Instalacao nova, sem nenhuma empresa pre-cadastrada (nunca e' o caso da
  // Villa/Grao, que ja nascem com a semeadura de demonstracao) -- pede pra
  // cadastrar a empresa do zero em vez de listar CNPJs que nao existem.
  if (data.legalEntities.length === 0) {
    return <NewCompanySetupWizard onSaved={onSaved} />;
  }
  return <ExistingCompanySetupWizard data={data} onSaved={onSaved} />;
}

function ExistingCompanySetupWizard({ data, onSaved }: { data: BootstrapData; onSaved: (profile: InstallationProfile) => void }): JSX.Element {
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
  const [periodStart, setPeriodStart] = useState(() => currentMonthToDateRange().periodStart);
  const [periodEnd, setPeriodEnd] = useState(() => currentMonthToDateRange().periodEnd);
  const [businessPartners, setBusinessPartners] = useState<BusinessPartner[]>([]);
  const [partnerLegalEntities, setPartnerLegalEntities] = useState<BusinessPartnerLegalEntity[]>([]);
  const [partnerSearchMode, setPartnerSearchMode] = useState<"cliente" | "empresa">("cliente");
  const [partnerSearchId, setPartnerSearchId] = useState("");
  const [companySearchTerm, setCompanySearchTerm] = useState("");
  const [companySearchId, setCompanySearchId] = useState("");
  const [partnerSackSummary, setPartnerSackSummary] = useState<{ sacksDecimal: string; operationCount: number; documentCount: number; serviceAmountCents: number } | null>(null);
  const [partnerSummaryLoading, setPartnerSummaryLoading] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: "idle" });
  const [installingUpdate, setInstallingUpdate] = useState(false);

  useEffect(() => {
    void window.operationsCafe.getUpdateStatus().then(setUpdateStatus);
    return window.operationsCafe.onUpdateStatusChanged(setUpdateStatus);
  }, []);

  async function installUpdateNow(): Promise<void> {
    setInstallingUpdate(true);
    await window.operationsCafe.quitAndInstallUpdate();
  }

  useEffect(() => {
    if (!organizationId) return;
    let canceled = false;
    setBillingSummary(null);
    void Promise.all([
      window.operationsCafe.getBillingSummary({ organizationId, includeAllCompanies: true, periodStart: periodStart || null, periodEnd: periodEnd || null }),
      window.operationsCafe.getOperationalIndicators({ organizationId, ownLegalEntityId, periodStart: periodStart || null, periodEnd: periodEnd || null }),
      window.operationsCafe.getDealConfirmationSummary({ organizationId, ownLegalEntityId: ownLegalEntityId ?? null, dateStart: periodStart || null, dateEnd: periodEnd || null, sellerPartnerId: null, buyerPartnerId: null, productId: null, status: null, signatureStatus: null }),
      window.operationsCafe.getDashboardAlerts({ organizationId, ownLegalEntityId })
    ]).then(([billing, operations, confirmations, dashboardAlerts]) => {
      if (canceled) return;
      setBillingSummary(billing);
      setOperationalIndicators(operations);
      setConfirmationSummary(confirmations);
      setAlerts(dashboardAlerts);
    });
    return () => { canceled = true; };
  }, [organizationId, ownLegalEntityId, periodStart, periodEnd]);

  useEffect(() => {
    if (!organizationId) return;
    void window.operationsCafe.getMonthlyOperationTotals({ organizationId, ownLegalEntityId, year: chartYear }).then(setMonthlyTotals);
  }, [organizationId, ownLegalEntityId, chartYear]);

  useEffect(() => {
    if (!organizationId) return;
    void window.operationsCafe.listBusinessPartners({ organizationId, status: "active" }).then(async (partnerList) => {
      setBusinessPartners(partnerList);
      const [linkedGroups, unlinked] = await Promise.all([
        Promise.all(partnerList.map((partner) => window.operationsCafe.listPartnerLegalEntities(partner.id))),
        window.operationsCafe.listUnlinkedPartnerLegalEntities(organizationId)
      ]);
      setPartnerLegalEntities([...linkedGroups.flat(), ...unlinked]);
    });
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) {
      setPartnerSackSummary(null);
      return;
    }
    if (partnerSearchMode === "cliente") {
      if (!partnerSearchId) { setPartnerSackSummary(null); return; }
      setPartnerSummaryLoading(true);
      void window.operationsCafe
        .getPartnerPeriodSackSummary({ organizationId, ownLegalEntityId, businessPartnerId: partnerSearchId, periodStart: periodStart || null, periodEnd: periodEnd || null })
        .then(setPartnerSackSummary)
        .finally(() => setPartnerSummaryLoading(false));
    } else {
      if (!companySearchId) { setPartnerSackSummary(null); return; }
      setPartnerSummaryLoading(true);
      void window.operationsCafe
        .getCompanyPeriodSackSummary({ organizationId, ownLegalEntityId, partnerLegalEntityId: companySearchId, periodStart: periodStart || null, periodEnd: periodEnd || null })
        .then(setPartnerSackSummary)
        .finally(() => setPartnerSummaryLoading(false));
    }
  }, [organizationId, ownLegalEntityId, partnerSearchMode, partnerSearchId, companySearchId, periodStart, periodEnd]);

  const totalReceivable = billingSummary?.openCents ?? 0;
  const totalCommercialAmount = operationalIndicators?.fiscalAmountCents ?? 0;
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
  const hasAlerts = Boolean(alerts && (alerts.overdueCharges.length || alerts.waitingSignatureConfirmations.length || alerts.partnersNearCreditLimit.length || alerts.loansDueForCollection.length));

  return (
    <section className="content-section">
      <PageHeader eyebrow="Visao geral" title="Dashboard operacional" description="Indicadores locais para operacao, recebimentos, financeiro interno e confirmacoes de negocio." />
      {updateStatus.state === "downloading" ? (
        <div className="dashboard-update-banner">
          <Alert tone="info">
            Baixando atualizacao {updateStatus.version} ({updateStatus.percent}%)...
          </Alert>
        </div>
      ) : null}
      {updateStatus.state === "downloaded" ? (
        <div className="dashboard-update-banner">
          <Alert tone="success">Atualizacao {updateStatus.version} pronta para instalar. O programa vai fechar e reabrir na nova versao.</Alert>
          <div className="actions">
            <Button variant="primary" onClick={() => void installUpdateNow()} loading={installingUpdate}>Reiniciar e atualizar agora</Button>
          </div>
        </div>
      ) : null}
      <FilterBar activeCount={[periodStart, periodEnd].filter(Boolean).length} onClear={() => { const defaults = currentMonthToDateRange(); setPeriodStart(defaults.periodStart); setPeriodEnd(defaults.periodEnd); }}>
        <DateInput label="Periodo - inicio" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
        <DateInput label="Periodo - fim" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
      </FilterBar>
      <div className="dashboard-grid dashboard-grid--hero">
        <Card><span className="kpi-icon"><SackIcon /></span><span>Sacas negociadas</span><strong>{sacks ? sacks.toLocaleString("pt-BR") : "0"}</strong><small>Volume das notas lancadas</small></Card>
        <Card><span className="kpi-icon"><CoinsIcon /></span><span>Valor total das notas</span><strong>{formatCurrencyFromCents(totalCommercialAmount)}</strong><small>Valor comercial das NFs lancadas</small></Card>
        <Card><span className="kpi-icon"><WalletIcon /></span><span>A receber no periodo</span><strong>{formatCurrencyFromCents(totalReceivable)}</strong><small>Todas as empresas · {billingSummary?.unbilledOperations ?? 0} operacoes sem cobranca</small></Card>
        <Card><span className="kpi-icon"><CheckCircleIcon /></span><span>Recebido referente ao periodo</span><strong>{formatCurrencyFromCents(billingSummary?.receivedForOperationsPeriodCents ?? 0)}</strong><small>Total recebido nas datas selecionadas: {formatCurrencyFromCents(billingSummary?.cashReceivedCents ?? 0)} · Todas as empresas</small></Card>
      </div>

      {hasAlerts && alerts ? (
        <div className="dashboard-alerts-card">
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
            {alerts.loansDueForCollection.map((item) => (
              <button key={item.ledgerEntryId} className="alert-item" onClick={() => { window.location.hash = "#/client-ledger"; }}>
                <Badge tone="danger">Emprestimo a cobrar</Badge>
                <span>{item.partnerName} - {formatCurrencyFromCents(item.amountCents)} previsto ha {item.daysOverdue} dia(s)</span>
              </button>
            ))}
          </div>
        </Card>
        </div>
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
                {monthBars.map((height, index) => (
                  <div key={index} className="mini-chart__col">
                    <span style={{ height: `${height}%` }} />
                  </div>
                ))}
                <svg className="mini-chart__line" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polyline points={linePoints} />
                </svg>
                <div className="mini-chart__sacks-labels" aria-hidden="true">
                  {monthLine.map((value, index) => {
                    const sacksAmount = Number(monthlyTotals[index]?.sacksDecimal ?? 0);
                    if (sacksAmount <= 0) return null;
                    return (
                      <small
                        key={index}
                        className="mini-chart__sacks-label"
                        style={{
                          left: `${(index / Math.max(1, monthLine.length - 1)) * 100}%`,
                          bottom: `${value}%`
                        }}
                      >
                        {sacksAmount.toLocaleString("pt-BR")}
                      </small>
                    );
                  })}
                </div>
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
            <article><span>CNPJs</span><strong>{legalEntities.filter(isOperationalLegalEntity).length}</strong></article>
            <article><span>Locais</span><strong>{locations.length}</strong></article>
            <article><span>Créditos</span><strong>{formatCurrencyFromCents(billingSummary?.availableCreditsCents ?? 0)}</strong></article>
          </div>
        </Card>

        <Card>
          <div className="ui-card__header">
            <div>
              <span className="ui-eyebrow">Cliente/corretor ou empresa</span>
              <h2>Sacas por período</h2>
            </div>
          </div>
          <div className="inline-actions">
            <button type="button" className={partnerSearchMode === "cliente" ? "active" : ""} onClick={() => { setPartnerSearchMode("cliente"); setCompanySearchId(""); setCompanySearchTerm(""); }}>Buscar por cliente/corretor</button>
            <button type="button" className={partnerSearchMode === "empresa" ? "active" : ""} onClick={() => { setPartnerSearchMode("empresa"); setPartnerSearchId(""); }}>Buscar por empresa/CNPJ</button>
          </div>
          {partnerSearchMode === "cliente" ? (
            <PartnerQuickSearch label="Buscar cliente/corretor" value={partnerSearchId} onChange={setPartnerSearchId} partners={businessPartners} placeholder="Digite o nome do cliente/corretor" />
          ) : (
            <>
              <Input label="Buscar empresa por nome ou CNPJ" value={companySearchTerm} onChange={(event) => { setCompanySearchTerm(event.target.value); setCompanySearchId(""); }} placeholder="Digite o nome ou CNPJ da empresa" />
              {companySearchTerm.trim() && !companySearchId ? (
                <div className="table">
                  {partnerLegalEntities
                    .filter((entity) => {
                      const term = companySearchTerm.trim().toUpperCase();
                      const digits = term.replace(/\D/g, "");
                      return entity.tradeName.toUpperCase().includes(term) || entity.legalName.toUpperCase().includes(term) || (digits && entity.cnpj?.includes(digits));
                    })
                    .slice(0, 20)
                    .map((entity) => (
                      <div key={entity.id} className="table-row">
                        <button type="button" className="partner-action-button" onClick={() => { setCompanySearchId(entity.id); setCompanySearchTerm(entity.tradeName); }}>{entity.tradeName} {entity.cnpj ? `- ${formatCnpj(entity.cnpj)}` : ""}</button>
                      </div>
                    ))}
                </div>
              ) : null}
            </>
          )}
          {(partnerSearchMode === "cliente" ? partnerSearchId : companySearchId) ? (
            partnerSummaryLoading ? (
              <p className="muted">Calculando...</p>
            ) : partnerSackSummary ? (
              <div className="dashboard-grid dashboard-grid--compact">
                <article><span>Sacas no período</span><strong>{Number(partnerSackSummary.sacksDecimal).toLocaleString("pt-BR")}</strong></article>
                <article><span>Notas fiscais</span><strong>{partnerSackSummary.documentCount}</strong></article>
                <article><span>Operações</span><strong>{partnerSackSummary.operationCount}</strong></article>
                <article><span>Valor de serviço</span><strong>{formatCurrencyFromCents(partnerSackSummary.serviceAmountCents)}</strong></article>
              </div>
            ) : null
          ) : (
            <EmptyState title="Nenhum cliente ou empresa selecionado" description="Busque um cliente/corretor ou uma empresa/CNPJ para ver quantas sacas movimentou no período escolhido." />
          )}
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
