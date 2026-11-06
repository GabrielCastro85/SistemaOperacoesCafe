import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { apiJson, queryString } from "./api";
import { PageHeader } from "./renderer/design-system/components/PageHeader";
import { FilterBar } from "./renderer/design-system/components/FilterBar";
import { Card } from "./renderer/design-system/components/Card";
import { Button } from "./renderer/design-system/components/Button";
import { Badge } from "./renderer/design-system/components/Badge";
import { EmptyState } from "./renderer/design-system/components/EmptyState";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { Alert } from "./renderer/design-system/components/Alert";
import type { BusinessPartnerRole, BusinessPartnerRow } from "./types";

const ROLE_LABELS: Record<BusinessPartnerRole, string> = {
  CLIENT: "Cliente", SUPPLIER: "Fornecedor", SELLER: "Vendedor", BUYER: "Comprador",
  DESTINATION: "Destino", CARRIER: "Transportadora", SERVICE_PROVIDER: "Prestador de serviço", OTHER: "Outro"
};
type FilterMode = "ALL" | "CLIENT" | "SUPPLIER";
const FILTER_LABELS: Record<FilterMode, string> = { ALL: "Todos", CLIENT: "Clientes", SUPPLIER: "Fornecedores" };
const ALL_ROLES = Object.keys(ROLE_LABELS) as BusinessPartnerRole[];

type PartnerForm = {
  id?: string; entityId?: string; displayName: string; notes: string; roles: BusinessPartnerRole[];
  legalName: string; tradeName: string; cnpj: string; stateRegistration: string; email: string; phone: string;
  addressLine: string; addressNumber: string; addressComplement: string; district: string; city: string; state: string; postalCode: string;
};
const EMPTY_FORM: PartnerForm = {
  displayName: "", notes: "", roles: ["CLIENT"], legalName: "", tradeName: "", cnpj: "", stateRegistration: "",
  email: "", phone: "", addressLine: "", addressNumber: "", addressComplement: "", district: "", city: "", state: "", postalCode: ""
};

function toForm(partner: BusinessPartnerRow): PartnerForm {
  const entity = partner.legal_entities[0];
  return {
    id: partner.id, entityId: entity?.id, displayName: partner.display_name, notes: partner.notes ?? "",
    roles: partner.roles.map((entry) => entry.role), legalName: entity?.legal_name ?? "", tradeName: entity?.trade_name ?? "",
    cnpj: entity?.cnpj ?? "", stateRegistration: entity?.state_registration ?? "", email: entity?.email ?? "", phone: entity?.phone ?? "",
    addressLine: entity?.address_line ?? "", addressNumber: entity?.address_number ?? "", addressComplement: entity?.address_complement ?? "",
    district: entity?.district ?? "", city: entity?.city ?? "", state: entity?.state ?? "", postalCode: entity?.postal_code ?? ""
  };
}

export function PartnersTab({ organizationId, legalEntityId }: { organizationId: string; legalEntityId?: string }): JSX.Element {
  const [partners, setPartners] = useState<BusinessPartnerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("ALL");
  const [form, setForm] = useState<PartnerForm | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    try { setPartners(await apiJson<BusinessPartnerRow[]>(`/v1/viewer/partners?${queryString({ organizationId, legalEntityId })}`)); }
    catch (value) { setError(value instanceof Error ? value.message : "Falha ao carregar cadastros."); }
  }, [organizationId, legalEntityId]);
  useEffect(() => { setPartners(null); setForm(null); void load(); }, [load]);

  const filtered = useMemo(() => {
    if (!partners) return [];
    const term = search.trim().toLowerCase();
    return partners.filter((partner) => {
      const roles = partner.roles.map((entry) => entry.role);
      if (filter !== "ALL" && !roles.includes(filter)) return false;
      return !term || `${partner.display_name} ${partner.document_number ?? ""} ${partner.city ?? ""}`.toLowerCase().includes(term);
    });
  }, [partners, search, filter]);

  function field(key: keyof PartnerForm, value: string): void { setForm((current) => current ? { ...current, [key]: value } : current); }
  function toggleRole(role: BusinessPartnerRole): void {
    setForm((current) => {
      if (!current) return current;
      const roles = current.roles.includes(role) ? current.roles.filter((item) => item !== role) : [...current.roles, role];
      return { ...current, roles: roles.length ? roles : current.roles };
    });
  }
  async function save(event: FormEvent): Promise<void> {
    event.preventDefault(); if (!form) return;
    setSaving(true); setError(null); setNotice(null);
    try {
      const body = {
        organizationId, legalEntityId, displayName: form.displayName, notes: form.notes, isActive: true, roles: form.roles,
        entity: form.legalName || form.cnpj ? {
          id: form.entityId, legalName: form.legalName || form.displayName, tradeName: form.tradeName, cnpj: form.cnpj,
          stateRegistration: form.stateRegistration, email: form.email, phone: form.phone, addressLine: form.addressLine,
          addressNumber: form.addressNumber, addressComplement: form.addressComplement, district: form.district,
          city: form.city, state: form.state, postalCode: form.postalCode
        } : undefined
      };
      await apiJson(form.id ? `/v1/manage/partners/${encodeURIComponent(form.id)}` : "/v1/manage/partners", {
        method: form.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      });
      setNotice(form.id ? "Cadastro atualizado e sincronizado." : "Cadastro criado e sincronizado.");
      setForm(null); await load();
    } catch (value) { setError(value instanceof Error ? value.message : "Não foi possível salvar o cadastro."); }
    finally { setSaving(false); }
  }

  return <>
    <PageHeader eyebrow="Comercial" title="Cadastros comerciais" description="Crie e altere clientes, fornecedores e empresas diretamente no sistema web." actions={<Button variant="primary" onClick={() => setForm({ ...EMPTY_FORM })}>Novo cadastro</Button>} />
    {error ? <Alert tone="danger" title="Falha no cadastro">{error}</Alert> : null}
    {notice ? <Alert tone="success" title="Alteração concluída">{notice}</Alert> : null}
    {form ? <PartnerEditor form={form} saving={saving} onField={field} onToggleRole={toggleRole} onSubmit={save} onCancel={() => setForm(null)} /> : null}
    {!error && !partners ? <LoadingState label="Carregando cadastros..." /> : null}
    {partners ? <>
      <FilterBar activeCount={(filter !== "ALL" ? 1 : 0) + (search.trim() ? 1 : 0)} onClear={() => { setSearch(""); setFilter("ALL"); }}>
        <input type="search" className="ui-input" placeholder="Buscar nome, documento ou cidade..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <div className="viewer-chip-row">{(Object.keys(FILTER_LABELS) as FilterMode[]).map((mode) => <Button key={mode} variant={filter === mode ? "primary" : "secondary"} onClick={() => setFilter(mode)}>{FILTER_LABELS[mode]}</Button>)}</div>
      </FilterBar>
      {filtered.length === 0 ? <EmptyState title="Nenhum cadastro encontrado" description="Ajuste a busca ou crie um novo cadastro." /> : <div className="viewer-card-grid">{filtered.map((partner) => <Card key={partner.id} title={partner.display_name} actions={<Button onClick={() => setForm(toForm(partner))}>Editar</Button>}>
        <div className="viewer-chip-row">{partner.roles.map((entry) => <Badge key={entry.role} tone="info">{ROLE_LABELS[entry.role]}</Badge>)}</div>
        <p className="viewer-card-line">{partner.document_number ?? partner.legal_entities[0]?.cnpj ?? "Sem documento"}</p>
        {partner.city ? <p className="viewer-card-line">{partner.city}{partner.state ? `/${partner.state}` : ""}</p> : null}
        {partner.email || partner.phone ? <p className="viewer-card-line">{[partner.email, partner.phone].filter(Boolean).join(" · ")}</p> : null}
      </Card>)}</div>}
    </> : null}
  </>;
}

function PartnerEditor({ form, saving, onField, onToggleRole, onSubmit, onCancel }: {
  form: PartnerForm; saving: boolean; onField: (key: keyof PartnerForm, value: string) => void;
  onToggleRole: (role: BusinessPartnerRole) => void; onSubmit: (event: FormEvent) => void; onCancel: () => void;
}): JSX.Element {
  const input = (label: string, key: keyof PartnerForm, required = false) => <label>{label}<input className="ui-input" value={String(form[key] ?? "")} onChange={(event) => onField(key, event.target.value)} required={required} /></label>;
  return <Card title={form.id ? "Editar cadastro" : "Novo cadastro"} className="viewer-editor-card"><form onSubmit={onSubmit}>
    <div className="viewer-form-grid">{input("Nome do cliente/fornecedor", "displayName", true)}{input("Razão social", "legalName")}{input("Nome fantasia", "tradeName")}{input("CNPJ", "cnpj")}{input("Inscrição estadual", "stateRegistration")}{input("E-mail", "email")}{input("Telefone", "phone")}{input("Cidade", "city")}{input("UF", "state")}</div>
    <label>Perfis</label><div className="viewer-chip-row viewer-editor-section">{ALL_ROLES.map((role) => <Button key={role} variant={form.roles.includes(role) ? "primary" : "secondary"} onClick={() => onToggleRole(role)}>{ROLE_LABELS[role]}</Button>)}</div>
    <details className="viewer-details"><summary>Endereço e observações</summary><div className="viewer-form-grid">{input("Endereço", "addressLine")}{input("Número", "addressNumber")}{input("Complemento", "addressComplement")}{input("Bairro", "district")}{input("CEP", "postalCode")}</div><label>Observações<textarea className="ui-input" value={form.notes} onChange={(event) => onField("notes", event.target.value)} /></label></details>
    <div className="viewer-form-actions"><Button variant="ghost" onClick={onCancel}>Cancelar</Button><Button type="submit" variant="primary" loading={saving}>Salvar cadastro</Button></div>
  </form></Card>;
}
