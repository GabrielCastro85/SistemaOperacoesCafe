import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getBrandingConfig } from "../../../shared/branding/branding";
import type {
  AppVariant,
  BootstrapData,
  BusinessPartner,
  BusinessPartnerLegalEntity,
  BusinessPartnerRole,
  Diagnostics,
  InstallationProfile,
  LegalEntity,
  Location,
  Operation,
  OperationScope,
  Organization,
  OrganizationListItem,
  PartnerContact,
  Product,
  ServiceRateRule,
  ClientCharge,
  ClientChargeDetail,
  ClientLedgerEntry,
  BillingSummary,
  ExpenseCategory,
  CostCenter,
  FinancialAccount,
  AccountPayable,
  PayableDocumentAttachment,
  FinancialReportGeneration,
  FinancialReportPreview,
  FinancialSummary,
  DealConfirmationSummary
} from "../../../shared/types/domain";
import { formatCep, formatCnpj, formatCurrencyFromCents, formatDateBr, onlyDigits } from "../../../shared/utils/format";
import { ConfirmationsPage } from "../confirmations/ConfirmationsPage";
import { OperationsPage } from "../operations/OperationsPage";
import { legacyMenuFromPath, pathFromLegacyMenu } from "../../app/navigation";
import { AppLayout } from "../../layouts/AppLayout";
import "../../styles/index.css";

type StatusFilter = "active" | "inactive" | "all";
type SettingsTab = "Organizacoes" | "Empresas e CNPJs" | "Locais" | "Identidade visual" | "Perfil da instalacao" | "Diagnostico";

const settingsTabs: SettingsTab[] = ["Organizacoes", "Empresas e CNPJs", "Locais", "Identidade visual", "Perfil da instalacao", "Diagnostico"];
const locationLabels: Record<Location["type"], string> = {
  OFFICE: "Escritorio",
  BRANCH: "Filial",
  WAREHOUSE: "Armazem",
  PROPERTY: "Imovel",
  STORAGE: "Deposito",
  OTHER: "Outro"
};
const roleLabels: Record<BusinessPartnerRole, string> = {
  CLIENT: "Cliente",
  SUPPLIER: "Fornecedor",
  SELLER: "Vendedor",
  BUYER: "Comprador",
  DESTINATION: "Destino",
  CARRIER: "Transportadora",
  SERVICE_PROVIDER: "Prestador de servico",
  OTHER: "Outro"
};
const scopeLabels: Record<OperationScope, string> = { INTERNAL: "Interna", EXTERNAL: "Externa", ALL: "Todas" };
const productLabels: Record<Product["category"], string> = { COFFEE_ARABICA: "Cafe Arabica", COFFEE_CONILON: "Cafe Conilon", COFFEE_OTHER: "Outro cafe", OTHER: "Outro produto" };

const blankOrg = (variant: AppVariant): Omit<Organization, "id" | "createdAt" | "updatedAt"> => {
  const branding = getBrandingConfig(variant);
  return {
    name: "",
    slug: "",
    displayName: "",
    appDisplayName: "",
    logoPath: null,
    compactLogoPath: null,
    iconPath: null,
    primaryColor: branding.colors.primary,
    secondaryColor: branding.colors.secondary,
    accentColor: branding.colors.accent,
    themeMode: "light",
    isActive: true
  };
};

const blankEntity = (organizationId: string): Omit<LegalEntity, "id" | "createdAt" | "updatedAt"> => ({
  organizationId,
  legalName: "",
  tradeName: "",
  cnpj: null,
  stateRegistration: null,
  municipalRegistration: null,
  email: null,
  phone: null,
  addressLine: "Endereco pendente",
  addressNumber: "S/N",
  addressComplement: null,
  district: "Pendente",
  city: "Pendente",
  state: "MG",
  postalCode: "00000000",
  documentPrefix: null,
  isDraft: false,
  isActive: true
});

const blankLocation = (organizationId: string): Omit<Location, "id" | "createdAt" | "updatedAt"> => ({
  organizationId,
  legalEntityId: null,
  name: "",
  type: "OFFICE",
  description: null,
  addressLine: null,
  addressNumber: null,
  addressComplement: null,
  district: null,
  city: null,
  state: null,
  postalCode: null,
  isActive: true
});

function Splash(): JSX.Element {
  return (
    <main className="splash">
      <div className="splash-mark">OC</div>
      <h1>Operacoes Cafe</h1>
      <p>Carregando banco local e configuracoes da instalacao...</p>
    </main>
  );
}

function SetupWizard({ data, onSaved }: { data: BootstrapData; onSaved: (profile: InstallationProfile) => void }): JSX.Element {
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
        <SelectField label="Organizacao padrao" value={organizationId} onChange={setOrganizationId} options={data.organizations.map((item) => [item.id, item.displayName])} />
        <SelectField label="CNPJ padrao" value={legalEntityId} onChange={setLegalEntityId} options={legalEntities.map((item) => [item.id, `${item.tradeName} - ${formatCnpj(item.cnpj)}`])} />
        {error ? <p className="error">{error}</p> : null}
        <button className="primary" onClick={() => void save()} disabled={!organizationId}>
          Entrar no sistema
        </button>
      </section>
    </main>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }): JSX.Element {
  return (
    <div className="field">
      <label>{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextField({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }): JSX.Element {
  return (
    <div className="field">
      <label>{label}</label>
      <input value={value} required={required} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Feedback({ message }: { message: string | null }): JSX.Element | null {
  return message ? <p className={message.startsWith("Erro") ? "error" : "success"}>{message}</p> : null;
}

function SettingsPage({ profile, refresh, onProfile }: { profile: InstallationProfile; refresh: () => Promise<BootstrapData>; onProfile: (profile: InstallationProfile) => void }): JSX.Element {
  const [tab, setTab] = useState<SettingsTab>("Organizacoes");
  return (
    <section className="content-section settings">
      <div className="settings-tabs">
        {settingsTabs.map((item) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </div>
      {tab === "Organizacoes" ? <OrganizationsAdmin profile={profile} refresh={refresh} /> : null}
      {tab === "Empresas e CNPJs" ? <LegalEntitiesAdmin refresh={refresh} /> : null}
      {tab === "Locais" ? <LocationsAdmin refresh={refresh} /> : null}
      {tab === "Identidade visual" ? <BrandingAdmin refresh={refresh} /> : null}
      {tab === "Perfil da instalacao" ? <ProfileAdmin profile={profile} refresh={refresh} onProfile={onProfile} /> : null}
      {tab === "Diagnostico" ? <DiagnosticsLoader /> : null}
    </section>
  );
}

function PartnersPage({ data, refresh }: { data: BootstrapData; refresh: () => Promise<BootstrapData> }): JSX.Element {
  const [items, setItems] = useState<BusinessPartner[]>([]);
  const [selected, setSelected] = useState<BusinessPartner | null>(null);
  const [legalEntities, setLegalEntities] = useState<BusinessPartnerLegalEntity[]>([]);
  const [contacts, setContacts] = useState<PartnerContact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const organizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "";
  const [partnerName, setPartnerName] = useState("");
  const [roles, setRoles] = useState<BusinessPartnerRole[]>(["CLIENT"]);
  const [cnpj, setCnpj] = useState("");
  const [contactName, setContactName] = useState("");
  const [productName, setProductName] = useState("");

  const load = useCallback(async () => {
    setItems(await window.operationsCafe.listBusinessPartners({ organizationId, search, status: "all" }));
    setProducts(await window.operationsCafe.listProducts({ organizationId, status: "all" }));
  }, [organizationId, search]);
  useEffect(() => { void load(); }, [load]);

  async function loadDetail(partner: BusinessPartner): Promise<void> {
    setSelected(partner);
    setLegalEntities(await window.operationsCafe.listPartnerLegalEntities(partner.id));
    setContacts(await window.operationsCafe.listPartnerContacts(partner.id));
  }

  async function savePartner(): Promise<void> {
    try {
      const partner = await window.operationsCafe.createBusinessPartner({ organizationId, displayName: partnerName, notes: null, roles, isActive: true });
      setPartnerName("");
      setMessage("Parceiro salvo.");
      await load();
      await loadDetail(partner);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao salvar parceiro."}`);
    }
  }

  async function savePartnerLegalEntity(): Promise<void> {
    if (!selected) return;
    try {
      await window.operationsCafe.createPartnerLegalEntity({
        businessPartnerId: selected.id,
        legalName: selected.displayName,
        tradeName: selected.displayName,
        cnpj: onlyDigits(cnpj),
        stateRegistration: null,
        municipalRegistration: null,
        email: null,
        phone: null,
        addressLine: null,
        addressNumber: null,
        addressComplement: null,
        district: null,
        city: null,
        state: null,
        postalCode: null,
        isPrimary: legalEntities.length === 0,
        isActive: true,
        isDraft: false
      });
      setCnpj("");
      setMessage("Estabelecimento salvo.");
      await loadDetail(selected);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao salvar estabelecimento."}`);
    }
  }

  async function saveContact(): Promise<void> {
    if (!selected) return;
    try {
      await window.operationsCafe.createPartnerContact({
        businessPartnerId: selected.id,
        partnerLegalEntityId: null,
        name: contactName,
        department: null,
        email: null,
        phone: null,
        mobile: null,
        preferredContactMethod: "PHONE",
        isPrimary: contacts.length === 0,
        notes: null,
        isActive: true
      });
      setContactName("");
      setMessage("Contato salvo.");
      await loadDetail(selected);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao salvar contato."}`);
    }
  }

  async function saveProduct(): Promise<void> {
    try {
      await window.operationsCafe.createProduct({ organizationId, name: productName, code: productName.toUpperCase().replace(/\s+/g, "-"), category: "COFFEE_OTHER", defaultUnit: "SACK", defaultSackWeightKg: 60, description: null, isActive: true });
      setProductName("");
      setMessage("Produto salvo.");
      await load();
      await refresh();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao salvar produto."}`);
    }
  }

  return (
    <section className="content-section settings">
      <AdminBlock title="Clientes e parceiros">
        <Toolbar search={search} status="all" onSearch={setSearch} onStatus={() => undefined} />
        <FormGrid>
          <TextField label="Nome do parceiro" value={partnerName} onChange={setPartnerName} required />
          <label className="checkbox"><input type="checkbox" checked={roles.includes("CLIENT")} onChange={(event) => setRoles(event.target.checked ? Array.from(new Set([...roles, "CLIENT"])) : roles.filter((role) => role !== "CLIENT"))} /> Cliente</label>
          <label className="checkbox"><input type="checkbox" checked={roles.includes("BUYER")} onChange={(event) => setRoles(event.target.checked ? Array.from(new Set([...roles, "BUYER"])) : roles.filter((role) => role !== "BUYER"))} /> Comprador</label>
          <button className="primary" onClick={() => void savePartner()}>Cadastrar parceiro</button>
        </FormGrid>
        <div className="table">
          <div className="table-head partner-grid"><span>Parceiro</span><span>Papeis</span><span>Status</span><span>Atualizado</span><span>Acoes</span></div>
          {items.map((item) => <div key={item.id} className="table-row partner-grid"><span>{item.displayName}</span><span>{item.roles.map((role) => roleLabels[role]).join(", ")}</span><span>{item.isActive ? "Ativo" : "Inativo"}</span><span>{formatDateBr(item.updatedAt)}</span><span className="actions"><button onClick={() => void loadDetail(item)}>Detalhar</button></span></div>)}
        </div>
      </AdminBlock>
      {selected ? <AdminBlock title={`Detalhe: ${selected.displayName}`}>
        <FormGrid>
          <TextField label="CNPJ do estabelecimento" value={cnpj} onChange={setCnpj} />
          <button onClick={() => void savePartnerLegalEntity()}>Cadastrar CNPJ</button>
          <TextField label="Nome do contato" value={contactName} onChange={setContactName} />
          <button onClick={() => void saveContact()}>Cadastrar contato</button>
        </FormGrid>
        <div className="cards"><article><span>Estabelecimentos</span><strong>{legalEntities.map((item) => `${item.tradeName} ${formatCnpj(item.cnpj)}`).join(" | ") || "Nenhum"}</strong></article><article><span>Contatos</span><strong>{contacts.map((item) => item.name).join(" | ") || "Nenhum"}</strong></article></div>
      </AdminBlock> : null}
      <AdminBlock title="Produtos">
        <FormGrid><TextField label="Produto" value={productName} onChange={setProductName} /><button onClick={() => void saveProduct()}>Cadastrar produto</button></FormGrid>
        <div className="table"><div className="table-head product-grid"><span>Nome</span><span>Codigo</span><span>Categoria</span><span>Peso saca</span><span>Status</span></div>{products.map((item) => <div key={item.id} className="table-row product-grid"><span>{item.name}</span><span>{item.code ?? "-"}</span><span>{productLabels[item.category]}</span><span>{item.defaultSackWeightKg ?? "-"} kg</span><span>{item.isActive ? "Ativo" : "Inativo"}</span></div>)}</div>
      </AdminBlock>
      <Feedback message={message} />
    </section>
  );
}

function ServiceRatesPage({ data }: { data: BootstrapData }): JSX.Element {
  const organizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "";
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rules, setRules] = useState<ServiceRateRule[]>([]);
  const [partnerId, setPartnerId] = useState("");
  const [productId, setProductId] = useState("");
  const [scope, setScope] = useState<OperationScope>("EXTERNAL");
  const [value, setValue] = useState("5,00");
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(async () => {
    const clientPartners = await window.operationsCafe.listBusinessPartners({ organizationId, role: "CLIENT", status: "active" });
    setPartners(clientPartners);
    setPartnerId((current) => current || clientPartners[0]?.id || "");
    setProducts(await window.operationsCafe.listProducts({ organizationId, status: "active" }));
    setRules(await window.operationsCafe.listServiceRateRules({ organizationId, status: "all" }));
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);
  async function saveRule(): Promise<void> {
    try {
      await window.operationsCafe.createServiceRateRule({
        organizationId,
        businessPartnerId: partnerId,
        ownLegalEntityId: null,
        productId: productId || null,
        operationScope: scope,
        rateType: "PER_SACK",
        rateValueCents: Math.round(Number(value.replace(".", "").replace(",", ".")) * 100),
        effectiveFrom: new Date().toISOString().slice(0, 10),
        effectiveTo: null,
        priority: productId ? 10 : 1,
        notes: null,
        isActive: true
      });
      setMessage("Regra por saca salva.");
      await load();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao salvar regra."}`);
    }
  }
  return (
    <section className="content-section settings">
      <AdminBlock title="Cobrancas - Regras por cliente">
        <FormGrid>
          <SelectField label="Cliente" value={partnerId} onChange={setPartnerId} options={partners.map((item) => [item.id, item.displayName])} />
          <SelectField label="Tipo" value={scope} onChange={(next) => setScope(next as OperationScope)} options={[["INTERNAL", "Interna"], ["EXTERNAL", "Externa"], ["ALL", "Todas"]]} />
          <SelectField label="Produto" value={productId} onChange={setProductId} options={[["", "Todos"], ...products.map((item) => [item.id, item.name] as [string, string])]} />
          <TextField label="Valor por saca" value={value} onChange={setValue} />
          <button className="primary" onClick={() => void saveRule()}>Cadastrar regra</button>
        </FormGrid>
        <div className="table"><div className="table-head rate-grid"><span>Cliente</span><span>Tipo</span><span>Produto</span><span>Valor</span><span>Vigencia</span><span>Status</span></div>{rules.map((item) => <div key={item.id} className="table-row rate-grid"><span>{partners.find((partner) => partner.id === item.businessPartnerId)?.displayName ?? item.businessPartnerId}</span><span>{scopeLabels[item.operationScope]}</span><span>{products.find((product) => product.id === item.productId)?.name ?? "Todos"}</span><span>{formatCurrencyFromCents(item.rateValueCents)} por saca</span><span>{item.effectiveFrom} ate {item.effectiveTo ?? "sem data final"}</span><span>{item.isActive ? "Vigente" : "Inativa"}</span></div>)}</div>
      </AdminBlock>
      <Feedback message={message} />
    </section>
  );
}

function OrganizationsAdmin({ profile, refresh }: { profile: InstallationProfile; refresh: () => Promise<BootstrapData> }): JSX.Element {
  const [items, setItems] = useState<OrganizationListItem[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<Organization | null>(null);
  const [form, setForm] = useState(blankOrg(profile.appVariant));
  const [message, setMessage] = useState<string | null>(null);
  const canCreate = profile.appVariant === "multiempresa";
  const load = useCallback(async (): Promise<void> => setItems(await window.operationsCafe.listOrganizations({ search, status })), [search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(): Promise<void> {
    try {
      if (editing) {
        await window.operationsCafe.updateOrganization(editing.id, form);
      } else {
        await window.operationsCafe.createOrganization(form);
      }
      setMessage("Cadastro salvo.");
      setEditing(null);
      setForm(blankOrg(profile.appVariant));
      await load();
      await refresh();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao salvar organizacao."}`);
    }
  }

  return (
    <AdminBlock title="Organizacoes">
      <Toolbar search={search} status={status} onSearch={setSearch} onStatus={setStatus} />
      <div className="table">
        <div className="table-head org-grid"><span>Logo</span><span>Nome</span><span>App</span><span>Slug</span><span>CNPJs</span><span>Locais</span><span>Status</span><span>Atualizado</span><span>Acoes</span></div>
        {items.map((item) => (
          <div key={item.id} className="table-row org-grid">
            <span className="logo-cell">{item.logoPath ? "Logo" : item.displayName.slice(0, 2).toUpperCase()}</span>
            <span>{item.displayName}</span><span>{item.appDisplayName}</span><span>{item.slug}</span><span>{item.legalEntityCount}</span><span>{item.locationCount}</span><span>{item.isActive ? "Ativa" : "Inativa"}</span><span>{formatDateBr(item.updatedAt)}</span>
            <span className="actions"><button onClick={() => { setEditing(item); setForm(item); }}>Editar</button><button onClick={() => void (item.isActive ? window.confirm("Desativar organizacao?") && window.operationsCafe.deactivateOrganization(item.id).then(load) : window.operationsCafe.activateOrganization(item.id).then(load))}>{item.isActive ? "Desativar" : "Ativar"}</button></span>
          </div>
        ))}
        {items.length === 0 ? <p className="empty">Nenhuma organizacao encontrada.</p> : null}
      </div>
      {(canCreate || editing) ? (
        <FormGrid>
          <TextField label="Nome" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
          <TextField label="Slug" value={form.slug} onChange={(value) => setForm({ ...form, slug: value })} required />
          <TextField label="Nome exibido" value={form.displayName} onChange={(value) => setForm({ ...form, displayName: value })} required />
          <TextField label="Nome do aplicativo" value={form.appDisplayName} onChange={(value) => setForm({ ...form, appDisplayName: value })} required />
          <TextField label="Cor primaria" value={form.primaryColor} onChange={(value) => setForm({ ...form, primaryColor: value })} required />
          <TextField label="Cor secundaria" value={form.secondaryColor} onChange={(value) => setForm({ ...form, secondaryColor: value })} required />
          <TextField label="Cor de destaque" value={form.accentColor} onChange={(value) => setForm({ ...form, accentColor: value })} required />
          <SelectField label="Tema" value={form.themeMode} onChange={(value) => setForm({ ...form, themeMode: value === "dark" ? "dark" : "light" })} options={[["light", "Claro"], ["dark", "Escuro"]]} />
          <label className="checkbox"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Ativa</label>
          <button className="primary" onClick={() => void save()}>{editing ? "Salvar organizacao" : "Cadastrar organizacao"}</button>
        </FormGrid>
      ) : <p className="muted">Cadastro de novas organizacoes disponivel apenas na variante multiempresa.</p>}
      <Feedback message={message} />
    </AdminBlock>
  );
}

function LegalEntitiesAdmin({ refresh }: { refresh: () => Promise<BootstrapData> }): JSX.Element {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [items, setItems] = useState<LegalEntity[]>([]);
  const [editing, setEditing] = useState<LegalEntity | null>(null);
  const [form, setForm] = useState<Omit<LegalEntity, "id" | "createdAt" | "updatedAt"> | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(async (): Promise<void> => {
    const bootstrap = await refresh();
    setData(bootstrap);
    setItems(await window.operationsCafe.listLegalEntities({ search, status }));
    setForm((current) => current ?? blankEntity(bootstrap.profile?.defaultOrganizationId ?? bootstrap.organizations[0]?.id ?? ""));
  }, [refresh, search, status]);
  useEffect(() => { void load(); }, [load]);
  if (!data || !form) return <p>Carregando...</p>;
  const currentEntityData = data;
  const currentEntityForm = form;
  async function save(): Promise<void> {
    try {
      const payload = { ...currentEntityForm, cnpj: onlyDigits(currentEntityForm.cnpj), phone: onlyDigits(currentEntityForm.phone), postalCode: onlyDigits(currentEntityForm.postalCode) ?? "" };
      if (editing) await window.operationsCafe.updateLegalEntity(editing.id, payload); else await window.operationsCafe.createLegalEntity(payload);
      setMessage("CNPJ salvo.");
      setEditing(null);
      setForm(blankEntity(currentEntityData.profile?.defaultOrganizationId ?? currentEntityData.organizations[0]?.id ?? ""));
      await load();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao salvar CNPJ."}`);
    }
  }
  return (
    <AdminBlock title="Empresas e CNPJs">
      <Toolbar search={search} status={status} onSearch={setSearch} onStatus={setStatus} />
      <div className="table">
        <div className="table-head entity-grid"><span>Fantasia</span><span>Razao social</span><span>CNPJ</span><span>Organizacao</span><span>Cidade/UF</span><span>IE</span><span>Status</span><span>Atualizado</span><span>Acoes</span></div>
        {items.map((item) => (
          <div key={item.id} className="table-row entity-grid">
            <span>{item.tradeName}</span><span>{item.legalName}</span><span>{formatCnpj(item.cnpj)}</span><span>{data.organizations.find((org) => org.id === item.organizationId)?.displayName}</span><span>{item.city}/{item.state}</span><span>{item.stateRegistration ?? "-"}</span><span>{item.isActive ? "Ativo" : "Inativo"}{item.isDraft ? " / rascunho" : ""}</span><span>{formatDateBr(item.updatedAt)}</span>
            <span className="actions"><button onClick={() => { setEditing(item); setForm(item); }}>Editar</button><button onClick={() => void (item.isActive ? window.confirm("Desativar CNPJ?") && window.operationsCafe.deactivateLegalEntity(item.id).then(load) : window.operationsCafe.activateLegalEntity(item.id).then(load))}>{item.isActive ? "Desativar" : "Ativar"}</button></span>
          </div>
        ))}
      </div>
      <FormGrid>
        <SelectField label="Organizacao" value={form.organizationId} onChange={(value) => setForm({ ...form, organizationId: value })} options={data.organizations.map((item) => [item.id, item.displayName])} />
        <TextField label="Razao social" value={form.legalName} onChange={(value) => setForm({ ...form, legalName: value })} required />
        <TextField label="Nome fantasia" value={form.tradeName} onChange={(value) => setForm({ ...form, tradeName: value })} required />
        <TextField label="CNPJ" value={form.cnpj ?? ""} onChange={(value) => setForm({ ...form, cnpj: value })} />
        <TextField label="Inscricao estadual" value={form.stateRegistration ?? ""} onChange={(value) => setForm({ ...form, stateRegistration: value || null })} />
        <TextField label="Email" value={form.email ?? ""} onChange={(value) => setForm({ ...form, email: value || null })} />
        <TextField label="Telefone" value={form.phone ?? ""} onChange={(value) => setForm({ ...form, phone: value || null })} />
        <TextField label="Endereco" value={form.addressLine} onChange={(value) => setForm({ ...form, addressLine: value })} required />
        <TextField label="Numero" value={form.addressNumber} onChange={(value) => setForm({ ...form, addressNumber: value })} required />
        <TextField label="Bairro" value={form.district} onChange={(value) => setForm({ ...form, district: value })} required />
        <TextField label="Cidade" value={form.city} onChange={(value) => setForm({ ...form, city: value })} required />
        <TextField label="UF" value={form.state} onChange={(value) => setForm({ ...form, state: value.toUpperCase() })} required />
        <TextField label="CEP" value={formatCep(form.postalCode)} onChange={(value) => setForm({ ...form, postalCode: value })} required />
        <TextField label="Prefixo documentos" value={form.documentPrefix ?? ""} onChange={(value) => setForm({ ...form, documentPrefix: value || null })} />
        <label className="checkbox"><input type="checkbox" checked={form.isDraft} onChange={(event) => setForm({ ...form, isDraft: event.target.checked })} /> Salvar como rascunho</label>
        <label className="checkbox"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Ativo</label>
        <button className="primary" onClick={() => void save()}>{editing ? "Salvar CNPJ" : "Cadastrar CNPJ"}</button>
      </FormGrid>
      <Feedback message={message} />
    </AdminBlock>
  );
}

function LocationsAdmin({ refresh }: { refresh: () => Promise<BootstrapData> }): JSX.Element {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [items, setItems] = useState<Location[]>([]);
  const [form, setForm] = useState<Omit<Location, "id" | "createdAt" | "updatedAt"> | null>(null);
  const [editing, setEditing] = useState<Location | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(async (): Promise<void> => {
    const bootstrap = await refresh();
    setData(bootstrap);
    setItems(await window.operationsCafe.listLocations({ search, status }));
    setForm((current) => current ?? blankLocation(bootstrap.profile?.defaultOrganizationId ?? bootstrap.organizations[0]?.id ?? ""));
  }, [refresh, search, status]);
  useEffect(() => { void load(); }, [load]);
  if (!data || !form) return <p>Carregando...</p>;
  const currentLocationData = data;
  const currentLocationForm = form;
  const orgEntities = currentLocationData.legalEntities.filter((item) => item.organizationId === currentLocationForm.organizationId);
  async function save(): Promise<void> {
    try {
      const payload = { ...currentLocationForm, postalCode: onlyDigits(currentLocationForm.postalCode) };
      if (editing) await window.operationsCafe.updateLocation(editing.id, payload); else await window.operationsCafe.createLocation(payload);
      setMessage("Local salvo.");
      setEditing(null);
      setForm(blankLocation(currentLocationData.profile?.defaultOrganizationId ?? currentLocationData.organizations[0]?.id ?? ""));
      await load();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao salvar local."}`);
    }
  }
  return (
    <AdminBlock title="Locais">
      <Toolbar search={search} status={status} onSearch={setSearch} onStatus={setStatus} />
      <div className="table">
        <div className="table-head location-grid"><span>Nome</span><span>Tipo</span><span>Organizacao</span><span>CNPJ</span><span>Cidade/UF</span><span>Status</span><span>Atualizado</span><span>Acoes</span></div>
        {items.map((item) => (
          <div key={item.id} className="table-row location-grid">
            <span>{item.name}</span><span>{locationLabels[item.type]}</span><span>{data.organizations.find((org) => org.id === item.organizationId)?.displayName}</span><span>{data.legalEntities.find((entity) => entity.id === item.legalEntityId)?.tradeName ?? "-"}</span><span>{item.city ? `${item.city}/${item.state}` : "-"}</span><span>{item.isActive ? "Ativo" : "Inativo"}</span><span>{formatDateBr(item.updatedAt)}</span>
            <span className="actions"><button onClick={() => { setEditing(item); setForm(item); }}>Editar</button><button onClick={() => void (item.isActive ? window.confirm("Desativar local?") && window.operationsCafe.deactivateLocation(item.id).then(load) : window.operationsCafe.activateLocation(item.id).then(load))}>{item.isActive ? "Desativar" : "Ativar"}</button></span>
          </div>
        ))}
      </div>
      <FormGrid>
        <SelectField label="Organizacao" value={form.organizationId} onChange={(value) => setForm({ ...form, organizationId: value, legalEntityId: null })} options={data.organizations.map((item) => [item.id, item.displayName])} />
        <SelectField label="CNPJ vinculado" value={form.legalEntityId ?? ""} onChange={(value) => setForm({ ...form, legalEntityId: value || null })} options={[["", "Sem CNPJ vinculado"], ...orgEntities.map((item) => [item.id, item.tradeName] as [string, string])]} />
        <TextField label="Nome" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
        <SelectField label="Tipo" value={form.type} onChange={(value) => setForm({ ...form, type: value as Location["type"] })} options={Object.entries(locationLabels)} />
        <TextField label="Descricao" value={form.description ?? ""} onChange={(value) => setForm({ ...form, description: value || null })} />
        <TextField label="Cidade" value={form.city ?? ""} onChange={(value) => setForm({ ...form, city: value || null })} />
        <TextField label="UF" value={form.state ?? ""} onChange={(value) => setForm({ ...form, state: value ? value.toUpperCase() : null })} />
        <TextField label="CEP" value={formatCep(form.postalCode)} onChange={(value) => setForm({ ...form, postalCode: value || null })} />
        <label className="checkbox"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Ativo</label>
        <button className="primary" onClick={() => void save()}>{editing ? "Salvar local" : "Cadastrar local"}</button>
      </FormGrid>
      <Feedback message={message} />
    </AdminBlock>
  );
}

function BrandingAdmin({ refresh }: { refresh: () => Promise<BootstrapData> }): JSX.Element {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [organizationId, setOrganizationId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { refresh().then((bootstrap) => { setData(bootstrap); setOrganizationId(bootstrap.profile?.defaultOrganizationId ?? bootstrap.organizations[0]?.id ?? ""); }).catch(() => setData(null)); }, [refresh]);
  if (!data) return <p>Carregando...</p>;
  const organization = data.organizations.find((item) => item.id === organizationId);
  async function select(kind: "logo" | "compactLogo" | "icon"): Promise<void> {
    try {
      await window.operationsCafe.selectOrganizationBrandingAsset(organizationId, kind);
      setMessage("Arquivo copiado para userData/settings/branding.");
      setData(await refresh());
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao copiar arquivo."}`);
    }
  }
  return (
    <AdminBlock title="Identidade visual">
      <SelectField label="Organizacao" value={organizationId} onChange={setOrganizationId} options={data.organizations.map((item) => [item.id, item.displayName])} />
      <div className="cards">
        {(["logo", "compactLogo", "icon"] as const).map((kind) => (
          <article key={kind}>
            <span>{kind === "logo" ? "Logo principal" : kind === "compactLogo" ? "Logo reduzida" : "Icone"}</span>
            <strong>{kind === "logo" ? organization?.logoPath ?? "Fallback" : kind === "compactLogo" ? organization?.compactLogoPath ?? "Fallback" : organization?.iconPath ?? "Fallback"}</strong>
            <button onClick={() => void select(kind)}>Selecionar arquivo</button>
          </article>
        ))}
      </div>
      <Feedback message={message} />
    </AdminBlock>
  );
}

function ProfileAdmin({ profile, refresh, onProfile }: { profile: InstallationProfile; refresh: () => Promise<BootstrapData>; onProfile: (profile: InstallationProfile) => void }): JSX.Element {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [form, setForm] = useState(profile);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { refresh().then(setData).catch(() => setData(null)); }, [refresh]);
  if (!data) return <p>Carregando...</p>;
  const entities = data.legalEntities.filter((item) => item.organizationId === form.defaultOrganizationId && item.isActive);
  async function save(): Promise<void> {
    try {
      const saved = await window.operationsCafe.updateInstallationProfile(form);
      onProfile(saved);
      setMessage("Perfil da instalacao salvo.");
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao salvar perfil."}`);
    }
  }
  return (
    <AdminBlock title="Perfil da instalacao">
      <FormGrid>
        <TextField label="Nome da instalacao" value={form.installationName} onChange={(value) => setForm({ ...form, installationName: value })} required />
        <TextField label="Variante" value={form.appVariant} onChange={(value) => setForm({ ...form, appVariant: value as AppVariant })} />
        <SelectField label="Organizacao padrao" value={form.defaultOrganizationId ?? ""} onChange={(value) => setForm({ ...form, defaultOrganizationId: value, defaultLegalEntityId: null })} options={data.organizations.map((item) => [item.id, item.displayName])} />
        <SelectField label="CNPJ padrao" value={form.defaultLegalEntityId ?? ""} onChange={(value) => setForm({ ...form, defaultLegalEntityId: value || null })} options={[["", "Sem CNPJ"], ...entities.map((item) => [item.id, item.tradeName] as [string, string])]} />
        <label className="checkbox"><input type="checkbox" checked={form.allowOrganizationSwitch} disabled={form.appVariant !== "multiempresa"} onChange={(event) => setForm({ ...form, allowOrganizationSwitch: event.target.checked })} /> Permitir troca de organizacao</label>
        <label className="checkbox"><input type="checkbox" checked={form.allowLegalEntitySwitch} onChange={(event) => setForm({ ...form, allowLegalEntitySwitch: event.target.checked })} /> Permitir troca de CNPJ</label>
        <button className="primary" onClick={() => void save()}>Salvar perfil</button>
      </FormGrid>
      <p className="muted">Banco: {data.version}. Caminhos locais disponiveis na tela Diagnostico.</p>
      <Feedback message={message} />
    </AdminBlock>
  );
}

function DiagnosticsLoader(): JSX.Element {
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  useEffect(() => { window.operationsCafe.getDiagnostics().then(setDiagnostics).catch(() => setDiagnostics(null)); }, []);
  return <DiagnosticsPage diagnostics={diagnostics} />;
}

function DiagnosticsPage({ diagnostics }: { diagnostics: Diagnostics | null }): JSX.Element {
  if (!diagnostics) return <AdminBlock title="Diagnostico"><p>Carregando diagnostico...</p></AdminBlock>;
  return (
    <AdminBlock title="Diagnostico">
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
        }).map(([label, value]) => <div key={label} className="diagnostic-row"><span>{label}</span><strong>{value}</strong></div>)}
      </div>
    </AdminBlock>
  );
}

function AdminBlock({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return <section className="admin-block"><h2>{title}</h2>{children}</section>;
}

function Toolbar({ search, status, onSearch, onStatus }: { search: string; status: StatusFilter; onSearch: (value: string) => void; onStatus: (value: StatusFilter) => void }): JSX.Element {
  return (
    <div className="toolbar">
      <input placeholder="Pesquisar" value={search} onChange={(event) => onSearch(event.target.value)} />
      <select value={status} onChange={(event) => onStatus(event.target.value as StatusFilter)}>
        <option value="all">Todos</option><option value="active">Ativos</option><option value="inactive">Inativos</option>
      </select>
    </div>
  );
}

function FormGrid({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="form-grid">{children}</div>;
}

function ChargesPage({ data }: { data: BootstrapData }): JSX.Element {
  const organizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "";
  const ownLegalEntityId = data.profile?.defaultLegalEntityId ?? data.legalEntities.find((item) => item.organizationId === organizationId)?.id ?? "";
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [charges, setCharges] = useState<ClientCharge[]>([]);
  const [eligible, setEligible] = useState<Operation[]>([]);
  const [detail, setDetail] = useState<ClientChargeDetail | null>(null);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [clientId, setClientId] = useState("");
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().slice(0, 8) + "01");
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const clients = await window.operationsCafe.listBusinessPartners({ organizationId, role: "CLIENT", status: "active" });
    setPartners(clients);
    setClientId((current) => current || clients[0]?.id || "");
    setCharges(await window.operationsCafe.listClientCharges({ organizationId, status: "all" }));
    setSummary(await window.operationsCafe.getBillingSummary(organizationId));
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  async function suggestPeriod(): Promise<void> {
    if (!clientId || !ownLegalEntityId) return;
    const [period] = await window.operationsCafe.suggestChargePeriods({ organizationId, ownLegalEntityId, clientPartnerId: clientId, referenceDate: periodEnd });
    if (period) { setPeriodStart(period.periodStart); setPeriodEnd(period.periodEnd); setMessage(period.label); }
  }

  async function findOperations(): Promise<void> {
    setEligible(await window.operationsCafe.findEligibleChargeOperations({ organizationId, ownLegalEntityId, clientPartnerId: clientId, periodStart, periodEnd }));
  }

  async function createDraft(): Promise<void> {
    try {
      const draft = await window.operationsCafe.createClientChargeDraft({ organizationId, ownLegalEntityId, clientPartnerId: clientId, billingProfileId: null, periodicity: "CUSTOM", periodStart, periodEnd, dueDate, notes: null, internalNotes: null, operationIds: eligible.map((item) => item.id) });
      setDetail(draft);
      setMessage("Rascunho gerado e operacoes reservadas.");
      await load();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao gerar cobranca."}`);
    }
  }

  async function issue(): Promise<void> {
    if (!detail) return;
    const issued = await window.operationsCafe.issueClientCharge(detail.charge.id);
    setDetail(issued);
    setMessage("Cobranca emitida com documentos.");
    await load();
  }

  async function addDiscount(): Promise<void> {
    if (!detail) return;
    const value = window.prompt("Valor do desconto em centavos");
    if (!value) return;
    setDetail(await window.operationsCafe.addChargeAdjustment({ clientChargeId: detail.charge.id, ledgerEntryId: null, adjustmentType: "DISCOUNT", effect: "REDUCE_RECEIVABLE", description: "Desconto manual", amountCents: Number(value), sortOrder: 10, reason: "Ajuste manual" }));
  }

  async function registerPayment(): Promise<void> {
    if (!detail) return;
    const value = window.prompt("Valor recebido em centavos");
    if (!value) return;
    const payment = await window.operationsCafe.createClientPayment({ organizationId, ownLegalEntityId, clientPartnerId: detail.charge.clientPartnerId, paymentDate: new Date().toISOString().slice(0, 10), amountCents: Number(value), paymentMethod: "PIX", bankAccountDescription: null, transactionReference: null, notes: null, attachmentPath: null });
    setDetail(await window.operationsCafe.allocateClientPayment({ clientPaymentId: payment.id, clientChargeId: detail.charge.id, amountCents: Number(value) }));
    await load();
  }

  return (
    <section className="content-section settings">
      <AdminBlock title="Gerar cobranca">
        <div className="cards">
          <article><span>Total a receber</span><strong>{formatCurrencyFromCents(summary?.openCents ?? 0)}</strong></article>
          <article><span>Recebido</span><strong>{formatCurrencyFromCents(summary?.receivedCents ?? 0)}</strong></article>
          <article><span>Creditos</span><strong>{formatCurrencyFromCents(summary?.availableCreditsCents ?? 0)}</strong></article>
          <article><span>Operacoes nao cobradas</span><strong>{summary?.unbilledOperations ?? 0}</strong></article>
        </div>
        <FormGrid>
          <SelectField label="Cliente" value={clientId} onChange={setClientId} options={partners.map((item) => [item.id, item.displayName])} />
          <TextField label="Inicio" value={periodStart} onChange={setPeriodStart} />
          <TextField label="Fim" value={periodEnd} onChange={setPeriodEnd} />
          <TextField label="Vencimento" value={dueDate} onChange={setDueDate} />
          <button onClick={() => void suggestPeriod()}>Sugerir periodo</button>
          <button onClick={() => void findOperations()}>Buscar operacoes</button>
          <button className="primary" onClick={() => void createDraft()} disabled={eligible.length === 0}>Gerar rascunho</button>
        </FormGrid>
        <div className="table"><div className="table-head charge-operation-grid"><span>Data</span><span>Tipo</span><span>Sacas</span><span>R$/saca</span><span>Servico</span><span>Status</span></div>{eligible.map((op) => <div key={op.id} className="table-row charge-operation-grid"><span>{op.operationDate}</span><span>{op.operationScope}</span><span>{op.quantitySacks}</span><span>{formatCurrencyFromCents(op.appliedRateValueCents)}</span><span>{formatCurrencyFromCents(op.serviceAmountCents)}</span><span>{op.billingStatus}</span></div>)}</div>
      </AdminBlock>
      {detail ? <AdminBlock title={`Detalhe ${detail.charge.chargeNumber ?? "Rascunho"}`}>
        <div className="cards">
          <article><span>Subtotal</span><strong>{formatCurrencyFromCents(detail.charge.subtotalServicesCents)}</strong></article>
          <article><span>Ajustes +</span><strong>{formatCurrencyFromCents(detail.charge.additionsCents)}</strong></article>
          <article><span>Ajustes -</span><strong>{formatCurrencyFromCents(detail.charge.deductionsCents)}</strong></article>
          <article><span>Total</span><strong>{formatCurrencyFromCents(detail.charge.finalAmountCents)}</strong></article>
          <article><span>Aberto</span><strong>{formatCurrencyFromCents(detail.charge.openAmountCents)}</strong></article>
        </div>
        <div className="toolbar"><button onClick={() => void addDiscount()}>Adicionar desconto</button><button className="primary" onClick={() => void issue()} disabled={!["DRAFT", "PENDING_REVIEW"].includes(detail.charge.status)}>Emitir e gerar documentos</button><button onClick={() => void registerPayment()}>Registrar pagamento</button></div>
      </AdminBlock> : null}
      <AdminBlock title="Historico de cobrancas">
        <div className="table"><div className="table-head charge-grid"><span>Numero</span><span>Cliente</span><span>Periodo</span><span>Total</span><span>Pago</span><span>Aberto</span><span>Status</span><span>Acoes</span></div>{charges.map((charge) => <div key={charge.id} className="table-row charge-grid"><span>{charge.chargeNumber ?? "Rascunho"}</span><span>{partners.find((item) => item.id === charge.clientPartnerId)?.displayName ?? charge.clientPartnerId}</span><span>{charge.periodStart} a {charge.periodEnd}</span><span>{formatCurrencyFromCents(charge.finalAmountCents)}</span><span>{formatCurrencyFromCents(charge.paidAmountCents)}</span><span>{formatCurrencyFromCents(charge.openAmountCents)}</span><span>{charge.status}</span><span><button onClick={() => window.operationsCafe.getClientCharge(charge.id).then(setDetail)}>Abrir</button></span></div>)}</div>
      </AdminBlock>
      <Feedback message={message} />
    </section>
  );
}

function LedgerPage({ data }: { data: BootstrapData }): JSX.Element {
  const organizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "";
  const ownLegalEntityId = data.profile?.defaultLegalEntityId ?? data.legalEntities.find((item) => item.organizationId === organizationId)?.id ?? "";
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [clientId, setClientId] = useState("");
  const [entries, setEntries] = useState<ClientLedgerEntry[]>([]);
  const [amount, setAmount] = useState("500000");
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(async () => {
    const clients = await window.operationsCafe.listBusinessPartners({ organizationId, role: "CLIENT", status: "active" });
    setPartners(clients);
    const selected = clientId || clients[0]?.id || "";
    setClientId(selected);
    if (selected) setEntries(await window.operationsCafe.listLedgerEntries({ organizationId, ownLegalEntityId, clientPartnerId: selected }));
  }, [organizationId, ownLegalEntityId, clientId]);
  useEffect(() => { void load(); }, [load]);
  async function createAdvance(): Promise<void> {
    await window.operationsCafe.createAdvance({ organizationId, ownLegalEntityId, clientPartnerId: clientId, clientChargeId: null, entryType: "ADVANCE_RECEIVED", effect: "REDUCE_RECEIVABLE", amountCents: Number(amount), entryDate: new Date().toISOString().slice(0, 10), description: "Adiantamento recebido", referenceNumber: null, notes: null, attachmentPath: null, availableAmountCents: Number(amount) });
    setMessage("Adiantamento registrado.");
    await load();
  }
  return (
    <section className="content-section settings">
      <AdminBlock title="Conta-corrente do cliente">
        <FormGrid>
          <SelectField label="Cliente" value={clientId} onChange={setClientId} options={partners.map((item) => [item.id, item.displayName])} />
          <TextField label="Valor em centavos" value={amount} onChange={setAmount} />
          <button className="primary" onClick={() => void createAdvance()}>Registrar adiantamento</button>
        </FormGrid>
        <div className="table"><div className="table-head ledger-grid"><span>Data</span><span>Tipo</span><span>Descricao</span><span>Efeito</span><span>Valor</span><span>Disponivel</span><span>Status</span></div>{entries.map((entry) => <div key={entry.id} className="table-row ledger-grid"><span>{entry.entryDate}</span><span>{entry.entryType}</span><span>{entry.description}</span><span>{entry.effect}</span><span>{formatCurrencyFromCents(entry.amountCents)}</span><span>{formatCurrencyFromCents(entry.availableAmountCents ?? 0)}</span><span>{entry.status}</span></div>)}</div>
      </AdminBlock>
      <Feedback message={message} />
    </section>
  );
}

function FinancialPage({ data }: { data: BootstrapData }): JSX.Element {
  const organizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "";
  const ownLegalEntityId = data.profile?.defaultLegalEntityId ?? data.legalEntities.find((item) => item.organizationId === organizationId)?.id ?? "";
  const [tab, setTab] = useState("Visao geral");
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [payables, setPayables] = useState<AccountPayable[]>([]);
  const [attachments, setAttachments] = useState<PayableDocumentAttachment[]>([]);
  const [reports, setReports] = useState<FinancialReportGeneration[]>([]);
  const [reportPreview, setReportPreview] = useState<FinancialReportPreview | null>(null);
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [message, setMessage] = useState("");
  const [payee, setPayee] = useState("Fornecedor avulso");
  const [description, setDescription] = useState("Aluguel do escritorio");
  const [amount, setAmount] = useState("100000");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [financialAccountId, setFinancialAccountId] = useState("");
  const [selectedPayableId, setSelectedPayableId] = useState("");
  const [reportType, setReportType] = useState("ACCOUNTS_PAYABLE");

  const load = useCallback(async () => {
    if (!organizationId || !ownLegalEntityId) return;
    const [loadedCategories, loadedCenters, loadedAccounts, loadedPayables, loadedPartners, loadedSummary, loadedReports] = await Promise.all([
      window.operationsCafe.listExpenseCategories(organizationId),
      window.operationsCafe.listCostCenters({ organizationId, ownLegalEntityId, status: "all" }),
      window.operationsCafe.listFinancialAccounts({ organizationId, ownLegalEntityId, status: "all" }),
      window.operationsCafe.listAccountsPayable({ organizationId, ownLegalEntityId }),
      window.operationsCafe.listBusinessPartners({ organizationId, status: "active" }),
      window.operationsCafe.getFinancialSummary(organizationId),
      window.operationsCafe.listFinancialReports({ organizationId, ownLegalEntityId })
    ]);
    setCategories(loadedCategories);
    setCostCenters(loadedCenters);
    setAccounts(loadedAccounts);
    setPayables(loadedPayables);
    setPartners(loadedPartners.filter((partner) => partner.roles.some((role) => ["SUPPLIER", "SERVICE_PROVIDER", "OTHER"].includes(role))));
    setSummary(loadedSummary);
    setReports(loadedReports);
    setCategoryId((current) => current || loadedCategories[0]?.id || "");
    setCostCenterId((current) => current || loadedCenters[0]?.id || "");
    setFinancialAccountId((current) => current || loadedAccounts[0]?.id || "");
    const selected = selectedPayableId || loadedPayables[0]?.id || "";
    setSelectedPayableId(selected);
    if (selected) setAttachments(await window.operationsCafe.listPayableAttachments(selected));
  }, [organizationId, ownLegalEntityId, selectedPayableId]);

  useEffect(() => { void load(); }, [load]);

  async function createCategory(): Promise<void> {
    await window.operationsCafe.createExpenseCategory({ organizationId, parentCategoryId: null, name: description || "Nova categoria", code: null, expenseNature: "OTHER", description: null, isActive: true });
    setMessage("Categoria cadastrada.");
    await load();
  }

  async function createCostCenter(): Promise<void> {
    await window.operationsCafe.createCostCenter({ organizationId, ownLegalEntityId, locationId: null, parentCostCenterId: null, name: description || "Centro de custo", code: null, description: null, isActive: true });
    setMessage("Centro de custo cadastrado.");
    await load();
  }

  async function createFinancialAccount(): Promise<void> {
    await window.operationsCafe.createFinancialAccount({ organizationId, ownLegalEntityId, name: description || "Conta financeira", accountType: "BANK_ACCOUNT", bankName: null, branch: null, accountIdentifierMasked: null, pixKeyDescription: null, notes: null, isActive: true });
    setMessage("Conta financeira cadastrada.");
    await load();
  }

  async function createPayable(confirm = false): Promise<void> {
    const category = categoryId || categories[0]?.id;
    if (!category) throw new Error("Cadastre uma categoria antes de lancar conta.");
    const detail = await window.operationsCafe.createAccountPayableDraft({
      organizationId,
      ownLegalEntityId,
      supplierPartnerId: null,
      supplierLegalEntityId: null,
      payeeNameSnapshot: payee,
      payeeTaxIdSnapshot: null,
      categoryId: category,
      defaultCostCenterId: costCenterId || null,
      defaultLocationId: null,
      source: "MANUAL",
      description,
      documentType: null,
      documentNumber: null,
      competenceDate: dueDate.slice(0, 8) + "01",
      issueDate: null,
      dueDate,
      originalAmountCents: Number(amount),
      discountCents: 0,
      interestCents: 0,
      penaltyCents: 0,
      otherAdditionsCents: 0,
      amountStatus: "CONFIRMED",
      notes: null,
      internalNotes: null
    });
    if (confirm) await window.operationsCafe.confirmAccountPayable(detail.payable.id);
    setMessage(confirm ? "Conta lancada e confirmada." : "Rascunho de conta criado.");
    await load();
  }

  async function createRecurring(): Promise<void> {
    const category = categoryId || categories[0]?.id;
    if (!category) throw new Error("Cadastre uma categoria antes de criar recorrencia.");
    const template = await window.operationsCafe.createPayableRecurringTemplate({
      organizationId,
      ownLegalEntityId,
      supplierPartnerId: null,
      supplierLegalEntityId: null,
      payeeNameSnapshot: payee,
      categoryId: category,
      defaultCostCenterId: costCenterId || null,
      defaultLocationId: null,
      description,
      amountMode: "FIXED",
      fixedAmountCents: Number(amount),
      estimatedAmountCents: null,
      frequency: "MONTHLY",
      dueDay: Number(dueDate.slice(-2)),
      generationLeadDays: 7,
      startDate: dueDate.slice(0, 8) + "01",
      endDate: null,
      autoGenerateOnOpen: false,
      isActive: true
    });
    await window.operationsCafe.generatePayableRecurringPeriod(template.id, 3);
    setMessage("Recorrencia criada e proximas contas geradas.");
    await load();
  }

  async function createInstallments(): Promise<void> {
    const category = categoryId || categories[0]?.id;
    if (!category) throw new Error("Cadastre uma categoria antes de criar parcelamento.");
    await window.operationsCafe.createPayableInstallmentGroup({
      organizationId,
      ownLegalEntityId,
      supplierPartnerId: null,
      supplierLegalEntityId: null,
      payeeNameSnapshot: payee,
      categoryId: category,
      defaultCostCenterId: costCenterId || null,
      defaultLocationId: null,
      description,
      totalAmountCents: Number(amount),
      installmentCount: 3,
      firstDueDate: dueDate,
      intervalType: "MONTHLY"
    });
    setMessage("Parcelamento em 3 vezes criado.");
    await load();
  }

  async function payFirstOpen(): Promise<void> {
    const payable = payables.find((item) => item.openAmountCents && item.openAmountCents > 0);
    if (!payable) return;
    const payment = await window.operationsCafe.createPayablePayment({ organizationId, ownLegalEntityId, financialAccountId: financialAccountId || null, paymentDate: new Date().toISOString().slice(0, 10), amountCents: payable.openAmountCents, paymentMethod: "PIX", transactionReference: null, payeeNameSnapshot: payable.payeeNameSnapshot, notes: null, attachmentPath: null, attachmentHash: null });
    await window.operationsCafe.allocatePayablePayment({ payablePaymentId: payment.id, accountPayableId: payable.id, amountCents: payable.openAmountCents });
    setMessage("Pagamento registrado.");
    await load();
  }

  async function attachToSelectedPayable(): Promise<void> {
    if (!selectedPayableId) return;
    const selected = await window.operationsCafe.selectPayableAttachment();
    if (!selected) return;
    await window.operationsCafe.addPayableAttachment({ token: selected.token, accountPayableId: selectedPayableId, attachmentType: "BILL", description: "Documento anexado pelo Financeiro" });
    setMessage("Documento anexado.");
    setAttachments(await window.operationsCafe.listPayableAttachments(selectedPayableId));
  }

  async function openAttachment(id: string): Promise<void> {
    await window.operationsCafe.openPayableAttachment(id);
  }

  async function removeAttachment(id: string): Promise<void> {
    const reason = window.prompt("Motivo da remocao/cancelamento do anexo") ?? "";
    await window.operationsCafe.removePayableAttachment(id, reason || null);
    if (selectedPayableId) setAttachments(await window.operationsCafe.listPayableAttachments(selectedPayableId));
  }

  async function refreshReportPreview(): Promise<void> {
    const filters = { organizationId, ownLegalEntityId, dateStart: null, dateEnd: null, categoryId: null, locationId: null, costCenterId: null, supplierPartnerId: null, status: null };
    setReportPreview(await window.operationsCafe.previewFinancialReport(filters));
  }

  async function generateReport(format: "PDF" | "EXCEL"): Promise<void> {
    const filters = { organizationId, ownLegalEntityId, dateStart: null, dateEnd: null, categoryId: null, locationId: null, costCenterId: null, supplierPartnerId: null, status: null };
    const report = await window.operationsCafe.generateFinancialReport({ reportType, format, filters });
    setMessage(`Relatorio ${format} gerado.`);
    setReports(await window.operationsCafe.listFinancialReports({ organizationId, ownLegalEntityId }));
    await window.operationsCafe.openFinancialReport(report.id);
  }

  return (
    <section className="content-section settings">
      <div className="settings-tabs">{["Visao geral", "Contas a pagar", "Cadastros", "Recorrencias e parcelas", "Pagamentos", "Relatorios"].map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</div>
      <div className="cards">
        <article><span>A pagar no mes</span><strong>{formatCurrencyFromCents(summary?.payableThisMonthCents ?? 0)}</strong></article>
        <article><span>Pago no mes</span><strong>{formatCurrencyFromCents(summary?.paidThisMonthCents ?? 0)}</strong></article>
        <article><span>Saldo em aberto</span><strong>{formatCurrencyFromCents(summary?.openCents ?? 0)}</strong></article>
        <article><span>Vencido</span><strong>{formatCurrencyFromCents(summary?.overdueCents ?? 0)}</strong></article>
        <article><span>Proximos 7 dias</span><strong>{formatCurrencyFromCents(summary?.dueNext7DaysCents ?? 0)}</strong></article>
        <article><span>Fluxo projetado</span><strong>{formatCurrencyFromCents(summary?.projectedResultCents ?? 0)}</strong></article>
      </div>
      {tab !== "Visao geral" && (
        <AdminBlock title="Lancamento rapido">
          <FormGrid>
            <TextField label="Favorecido" value={payee} onChange={setPayee} />
            <TextField label="Descricao" value={description} onChange={setDescription} />
            <TextField label="Valor em centavos" value={amount} onChange={setAmount} />
            <TextField label="Vencimento" value={dueDate} onChange={setDueDate} />
            <SelectField label="Categoria" value={categoryId} onChange={setCategoryId} options={categories.map((item) => [item.id, item.name])} />
            <SelectField label="Centro de custo" value={costCenterId} onChange={setCostCenterId} options={[["", "Sem centro"], ...costCenters.map((item) => [item.id, item.name] as [string, string])]} />
          </FormGrid>
          <div className="actions">
            <button className="primary" onClick={() => void createPayable(true)}>Lancar conta</button>
            <button onClick={() => void createPayable(false)}>Salvar rascunho</button>
            <button onClick={() => void createRecurring()}>Criar recorrencia</button>
            <button onClick={() => void createInstallments()}>Parcelar em 3x</button>
          </div>
        </AdminBlock>
      )}
      {tab === "Contas a pagar" && (
        <AdminBlock title="Contas a pagar">
          <FormGrid>
            <SelectField label="Conta selecionada" value={selectedPayableId} onChange={(value) => { setSelectedPayableId(value); void window.operationsCafe.listPayableAttachments(value).then(setAttachments); }} options={payables.map((item) => [item.id, `${item.dueDate} - ${item.description}`])} />
            <button className="primary" onClick={() => void attachToSelectedPayable()}>Anexar documento</button>
          </FormGrid>
          <div className="table"><div className="table-head payable-grid"><span>Vencimento</span><span>Descricao</span><span>Favorecido</span><span>Categoria</span><span>Total</span><span>Pago</span><span>Saldo</span><span>Status</span></div>{payables.map((item) => <div key={item.id} className="table-row payable-grid"><span>{item.dueDate}</span><span>{item.description}</span><span>{item.payeeNameSnapshot}</span><span>{categories.find((category) => category.id === item.categoryId)?.name ?? item.categoryId}</span><span>{formatCurrencyFromCents(item.finalAmountCents ?? 0)}</span><span>{formatCurrencyFromCents(item.paidAmountCents)}</span><span>{formatCurrencyFromCents(item.openAmountCents ?? 0)}</span><span>{item.status}</span></div>)}</div>
          <h3>Documentos</h3>
          {attachments.length === 0 ? <p>Nenhum documento anexado.</p> : <div className="table"><div className="table-head attachment-grid"><span>Tipo</span><span>Arquivo</span><span>Tamanho</span><span>Data</span><span>Descricao</span><span>Acoes</span></div>{attachments.map((item) => <div key={item.id} className="table-row attachment-grid"><span>{item.attachmentType}</span><span>{item.originalFileName}</span><span>{Math.round(item.fileSize / 1024)} KB</span><span>{item.createdAt.slice(0, 10)}</span><span>{item.description ?? "-"}</span><span><button onClick={() => void openAttachment(item.id)}>Abrir</button><button onClick={() => void removeAttachment(item.id)}>Remover</button></span></div>)}</div>}
        </AdminBlock>
      )}
      {tab === "Cadastros" && (
        <div className="settings">
          <AdminBlock title="Categorias"><div className="actions"><button onClick={() => void createCategory()}>Criar categoria pelo campo descricao</button></div><div className="table"><div className="table-head finance-catalog-grid"><span>Nome</span><span>Codigo</span><span>Natureza</span><span>Status</span></div>{categories.map((item) => <div key={item.id} className="table-row finance-catalog-grid"><span>{item.name}</span><span>{item.code ?? "-"}</span><span>{item.expenseNature}</span><span>{item.isActive ? "Ativa" : "Inativa"}</span></div>)}</div></AdminBlock>
          <AdminBlock title="Centros de custo"><div className="actions"><button onClick={() => void createCostCenter()}>Criar centro pelo campo descricao</button></div><div className="table"><div className="table-head finance-catalog-grid"><span>Nome</span><span>Codigo</span><span>CNPJ</span><span>Status</span></div>{costCenters.map((item) => <div key={item.id} className="table-row finance-catalog-grid"><span>{item.name}</span><span>{item.code ?? "-"}</span><span>{data.legalEntities.find((entity) => entity.id === item.ownLegalEntityId)?.tradeName ?? "-"}</span><span>{item.isActive ? "Ativo" : "Inativo"}</span></div>)}</div></AdminBlock>
          <AdminBlock title="Contas financeiras"><div className="actions"><button onClick={() => void createFinancialAccount()}>Criar conta pelo campo descricao</button></div><div className="table"><div className="table-head finance-catalog-grid"><span>Nome</span><span>Tipo</span><span>Banco</span><span>Status</span></div>{accounts.map((item) => <div key={item.id} className="table-row finance-catalog-grid"><span>{item.name}</span><span>{item.accountType}</span><span>{item.bankName ?? "-"}</span><span>{item.isActive ? "Ativa" : "Inativa"}</span></div>)}</div></AdminBlock>
        </div>
      )}
      {tab === "Recorrencias e parcelas" && (
        <AdminBlock title="Historico de geracao">
          <p>{payables.filter((item) => item.source === "RECURRING").length} contas recorrentes geradas. {payables.filter((item) => item.source === "INSTALLMENT").length} parcelas geradas.</p>
        </AdminBlock>
      )}
      {tab === "Pagamentos" && (
        <AdminBlock title="Pagamentos">
          <SelectField label="Conta financeira" value={financialAccountId} onChange={setFinancialAccountId} options={[["", "Sem conta"], ...accounts.map((item) => [item.id, item.name] as [string, string])]} />
          <div className="actions"><button className="primary" onClick={() => void payFirstOpen()}>Pagar primeira conta em aberto</button></div>
          <p>{partners.length} fornecedores/prestadores ativos disponiveis nos cadastros de parceiros.</p>
        </AdminBlock>
      )}
      {tab === "Relatorios" && (
        <AdminBlock title="Relatorios financeiros">
          <FormGrid>
            <SelectField label="Tipo" value={reportType} onChange={setReportType} options={[["ACCOUNTS_PAYABLE", "Contas a pagar"], ["OVERDUE_PAYABLES", "Vencidas"], ["PAYMENTS", "Pagamentos"], ["BY_CATEGORY", "Por categoria"], ["BY_LOCATION", "Por local"], ["BY_COST_CENTER", "Por centro"], ["BY_SUPPLIER", "Por fornecedor"], ["FIXED_VARIABLE", "Fixas e variaveis"], ["RECURRING", "Recorrentes"], ["INSTALLMENTS", "Parcelamentos"], ["PROJECTED_CASH_FLOW", "Fluxo projetado"]]} />
            <button onClick={() => void refreshReportPreview()}>Atualizar previa</button>
            <button className="primary" onClick={() => void generateReport("PDF")}>Gerar PDF</button>
            <button onClick={() => void generateReport("EXCEL")}>Gerar Excel</button>
          </FormGrid>
          <div className="cards">
            <article><span>Registros</span><strong>{reportPreview?.recordCount ?? payables.length}</strong></article>
            <article><span>Total</span><strong>{formatCurrencyFromCents(reportPreview?.totalFinalCents ?? 0)}</strong></article>
            <article><span>Saldo</span><strong>{formatCurrencyFromCents(reportPreview?.totalOpenCents ?? 0)}</strong></article>
          </div>
          <div className="table"><div className="table-head report-grid"><span>Data</span><span>Tipo</span><span>Formato</span><span>Arquivo</span><span>Acoes</span></div>{reports.map((item) => <div key={item.id} className="table-row report-grid"><span>{item.createdAt.slice(0, 10)}</span><span>{item.reportType}</span><span>{item.format}</span><span>{item.fileName}</span><span><button onClick={() => void window.operationsCafe.openFinancialReport(item.id)}>Abrir</button></span></div>)}</div>
        </AdminBlock>
      )}
      <Feedback message={message} />
    </section>
  );
}

function ModulePlaceholder({ title }: { title: string }): JSX.Element {
  return <section className="content-section"><h2>{title}</h2><p>Modulo em desenvolvimento. Esta etapa esta focada em multiempresa, CNPJs, locais e branding.</p></section>;
}

function Dashboard({ organizations, legalEntities, locations, organizationId }: { organizations: Organization[]; legalEntities: LegalEntity[]; locations: Location[]; organizationId?: string }): JSX.Element {
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
      <div className="page-title-row">
        <div>
          <span className="eyebrow">Visão geral</span>
          <h2>Dashboard operacional</h2>
          <p>Indicadores locais para operação, recebimentos, financeiro interno e confirmações de negócio.</p>
        </div>
      </div>
      <div className="dashboard-grid">
        <article><span>Organizações</span><strong>{organizations.length}</strong><small>Cadastros administrativos</small></article>
        <article><span>CNPJs próprios</span><strong>{legalEntities.length}</strong><small>Contextos de lançamento</small></article>
        <article><span>Locais</span><strong>{locations.length}</strong><small>Unidades e pontos operacionais</small></article>
        <article><span>Operações sem cobrança</span><strong>{billingSummary?.unbilledOperations ?? 0}</strong><small>Receita de serviço pendente</small></article>
        <article><span>Saldo a receber</span><strong>{formatCurrencyFromCents(billingSummary?.openCents ?? 0)}</strong><small>Cobranças emitidas em aberto</small></article>
        <article><span>Créditos de clientes</span><strong>{formatCurrencyFromCents(billingSummary?.availableCreditsCents ?? 0)}</strong><small>Conta-corrente disponível</small></article>
        <article><span>Contas a pagar abertas</span><strong>{formatCurrencyFromCents(financialSummary?.openCents ?? 0)}</strong><small>Financeiro gerencial</small></article>
        <article><span>Contas vencidas</span><strong>{formatCurrencyFromCents(financialSummary?.overdueCents ?? 0)}</strong><small>Exige atenção operacional</small></article>
        <article><span>Fluxo projetado</span><strong>{formatCurrencyFromCents(financialSummary?.projectedResultCents ?? 0)}</strong><small>Recebimentos previstos menos pagamentos</small></article>
        <article><span>Confirmações emitidas</span><strong>{confirmationSummary?.issued ?? 0}</strong><small>Documentos comerciais</small></article>
        <article><span>Aguardando assinatura</span><strong>{confirmationSummary?.waitingSignature ?? 0}</strong><small>Controle documental</small></article>
        <article><span>Sacas confirmadas</span><strong>{confirmationSummary?.totalSacksDecimal ?? "0"}</strong><small>Volume comercial, não receita</small></article>
      </div>
    </section>
  );
}

function Shell({ initialData }: { initialData: BootstrapData }): JSX.Element {
  const [data, setData] = useState(initialData);
  const [profile, setProfile] = useState(initialData.profile);
  const [activeMenu, setActiveMenu] = useState(() => legacyMenuFromPath(window.location.hash.replace(/^#/, "")));
  const organization = data.organizations.find((item) => item.id === profile?.defaultOrganizationId) ?? data.organizations[0];
  const legalEntity = data.legalEntities.find((item) => item.id === profile?.defaultLegalEntityId);
  const branding = getBrandingConfig(profile?.appVariant ?? "multiempresa");
  const orgEntities = data.legalEntities.filter((item) => item.organizationId === organization?.id && item.isActive);
  const canSwitchOrg = profile?.allowOrganizationSwitch && profile.appVariant === "multiempresa";

  const refresh = useCallback(async (): Promise<BootstrapData> => {
    const bootstrap = await window.operationsCafe.getBootstrapData();
    setData(bootstrap);
    setProfile(bootstrap.profile);
    return bootstrap;
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--brand-primary", organization?.primaryColor ?? branding.colors.primary);
    document.documentElement.style.setProperty("--brand-secondary", organization?.secondaryColor ?? branding.colors.secondary);
    document.documentElement.style.setProperty("--brand-accent", organization?.accentColor ?? branding.colors.accent);
  }, [organization, branding]);

  async function changeLegalEntity(id: string): Promise<void> {
    if (!id) return;
    setProfile(await window.operationsCafe.setActiveLegalEntity(id));
    await refresh();
  }

  async function changeOrganization(id: string): Promise<void> {
    setProfile(await window.operationsCafe.setActiveOrganization(id));
    await refresh();
  }

  function navigate(menu: string): void {
    setActiveMenu(menu);
    window.history.pushState(null, "", `#${pathFromLegacyMenu(menu)}`);
  }

  useEffect(() => {
    const handlePopState = (): void => setActiveMenu(legacyMenuFromPath(window.location.hash.replace(/^#/, "")));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const page = useMemo(() => {
    if (activeMenu === "Dashboard") return <Dashboard organizations={data.organizations} legalEntities={data.legalEntities} locations={data.locations} organizationId={organization?.id} />;
    if (activeMenu === "Notas e operacoes") return <OperationsPage data={data} />;
    if (activeMenu === "Clientes") return <PartnersPage data={data} refresh={refresh} />;
    if (activeMenu === "Regras por saca") return <ServiceRatesPage data={data} />;
    if (activeMenu === "Cobrancas") return <ChargesPage data={data} />;
    if (activeMenu === "Conta-corrente") return <LedgerPage data={data} />;
    if (activeMenu === "Confirmacoes") return <ConfirmationsPage data={data} />;
    if (activeMenu === "Financeiro") return <FinancialPage data={data} />;
    if (activeMenu === "Configuracoes" && profile) return <SettingsPage profile={profile} refresh={refresh} onProfile={setProfile} />;
    return <ModulePlaceholder title={activeMenu} />;
  }, [activeMenu, data, profile, refresh, organization?.id]);

  return (
    <AppLayout
      variant={profile?.appVariant ?? "multiempresa"}
      organization={organization ?? null}
      organizations={data.organizations}
      legalEntity={legalEntity ?? null}
      legalEntities={orgEntities}
      activeMenu={activeMenu}
      canSwitchOrganization={Boolean(canSwitchOrg)}
      canSwitchLegalEntity={Boolean(profile?.allowLegalEntitySwitch)}
      version={data.version}
      onNavigate={navigate}
      onOrganizationChange={(id) => void changeOrganization(id)}
      onLegalEntityChange={(id) => void changeLegalEntity(id)}
    >
      {page}
    </AppLayout>
  );
}

export default function LegacyWorkspace(): JSX.Element {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [profile, setProfile] = useState<InstallationProfile | null>(null);
  useEffect(() => { window.operationsCafe.getBootstrapData().then((bootstrap) => { setData(bootstrap); setProfile(bootstrap.profile); }); }, []);
  if (!data) return <Splash />;
  if (!profile?.completedSetup) return <SetupWizard data={data} onSaved={setProfile} />;
  return <Shell initialData={{ ...data, profile }} />;
}
