import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { getBrandingConfig } from "../shared/branding/branding";
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
  OperationScope,
  Organization,
  OrganizationListItem,
  PartnerContact,
  Product,
  ServiceRateRule
} from "../shared/types/domain";
import { formatCep, formatCnpj, formatCurrencyFromCents, formatDateBr, onlyDigits } from "../shared/utils/format";
import "./styles.css";

type StatusFilter = "active" | "inactive" | "all";
type SettingsTab = "Organizacoes" | "Empresas e CNPJs" | "Locais" | "Identidade visual" | "Perfil da instalacao" | "Diagnostico";

const menuItems = ["Dashboard", "Notas e operacoes", "Clientes", "Cobrancas", "Conta-corrente", "Confirmacoes", "Financeiro", "Relatorios", "Configuracoes"];
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

function ModulePlaceholder({ title }: { title: string }): JSX.Element {
  return <section className="content-section"><h2>{title}</h2><p>Modulo em desenvolvimento. Esta etapa esta focada em multiempresa, CNPJs, locais e branding.</p></section>;
}

function Dashboard({ organizations, legalEntities, locations }: { organizations: Organization[]; legalEntities: LegalEntity[]; locations: Location[] }): JSX.Element {
  return (
    <section className="content-section">
      <h2>Inicio</h2>
      <p>Ambiente offline-first configurado para operacoes de cafe, com cadastros administrativos persistentes.</p>
      <div className="cards">
        <article><span>Organizacoes</span><strong>{organizations.length}</strong></article>
        <article><span>CNPJs</span><strong>{legalEntities.length}</strong></article>
        <article><span>Locais</span><strong>{locations.length}</strong></article>
      </div>
    </section>
  );
}

function Shell({ initialData }: { initialData: BootstrapData }): JSX.Element {
  const [data, setData] = useState(initialData);
  const [profile, setProfile] = useState(initialData.profile);
  const [activeMenu, setActiveMenu] = useState("Dashboard");
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

  const page = useMemo(() => {
    if (activeMenu === "Dashboard") return <Dashboard organizations={data.organizations} legalEntities={data.legalEntities} locations={data.locations} />;
    if (activeMenu === "Clientes") return <PartnersPage data={data} refresh={refresh} />;
    if (activeMenu === "Cobrancas") return <ServiceRatesPage data={data} />;
    if (activeMenu === "Configuracoes" && profile) return <SettingsPage profile={profile} refresh={refresh} onProfile={setProfile} />;
    return <ModulePlaceholder title={activeMenu} />;
  }, [activeMenu, data, profile, refresh]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block"><div className="brand-mark">{organization?.displayName.slice(0, 2).toUpperCase() ?? "OC"}</div><strong>{organization?.appDisplayName ?? branding.appDisplayName}</strong></div>
        <nav>{menuItems.map((item) => <button key={item} className={activeMenu === item ? "active" : ""} onClick={() => setActiveMenu(item)}>{item}</button>)}</nav>
      </aside>
      <section className="main-area">
        <header className="topbar">
          <div><span>Organizacao ativa</span>{canSwitchOrg ? <select value={organization?.id ?? ""} onChange={(event) => void changeOrganization(event.target.value)}>{data.organizations.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select> : <strong>{organization?.displayName ?? "Nao definida"}</strong>}</div>
          <div><span>CNPJ ativo</span><select value={legalEntity?.id ?? ""} onChange={(event) => void changeLegalEntity(event.target.value)} disabled={!profile?.allowLegalEntitySwitch}>{orgEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.tradeName}</option>)}</select></div>
          <div><span>Usuario</span><strong>Usuario provisorio</strong></div>
          <div><span>Versao</span><strong>{data.version}</strong></div>
        </header>
        {page}
      </section>
    </main>
  );
}

function App(): JSX.Element {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [profile, setProfile] = useState<InstallationProfile | null>(null);
  useEffect(() => { window.operationsCafe.getBootstrapData().then((bootstrap) => { setData(bootstrap); setProfile(bootstrap.profile); }); }, []);
  if (!data) return <Splash />;
  if (!profile?.completedSetup) return <SetupWizard data={data} onSaved={setProfile} />;
  return <Shell initialData={{ ...data, profile }} />;
}

createRoot(document.getElementById("root") as HTMLElement).render(<React.StrictMode><App /></React.StrictMode>);
