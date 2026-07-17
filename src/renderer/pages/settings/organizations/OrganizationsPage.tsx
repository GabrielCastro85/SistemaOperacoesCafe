import { useState } from "react";
import type { Organization } from "../../../../shared/types/domain";
import { Button, DataTable, PageHeader, SearchInput, StatusBadge } from "../../../design-system";
import { formatDateBr } from "../../../../shared/utils/format";
import { DeactivateOrganizationDialog } from "../dialogs/settingsDialogs";
import { useOrganizations } from "../hooks/useAdminLists";
import { blankOrg } from "../settingsModels";
import type { SettingsPageProps } from "../types";
import { OrganizationForm } from "./OrganizationForm";

export function OrganizationsPage({ profile, refresh }: SettingsPageProps): JSX.Element {
  const [search, setSearch] = useState("");
  const { items, reload } = useOrganizations(search, "all");
  const [editing, setEditing] = useState<Organization | null>(null);
  const [form, setForm] = useState(blankOrg(profile.appVariant));
  async function save(): Promise<void> {
    if (editing) await window.operationsCafe.updateOrganization(editing.id, form); else await window.operationsCafe.createOrganization(form);
    setEditing(null);
    setForm(blankOrg(profile.appVariant));
    await Promise.all([reload(), refresh()]);
  }
  async function toggle(item: Organization): Promise<void> {
    if (item.isActive) {
      if (await DeactivateOrganizationDialog()) await window.operationsCafe.deactivateOrganization(item.id);
    } else await window.operationsCafe.activateOrganization(item.id);
    await reload();
  }
  return <section className="content-section"><PageHeader eyebrow="Empresa" title="Organizacoes" description="Organizacoes, tema e limites por variante." actions={<Button onClick={() => void save()} disabled={profile.appVariant !== "multiempresa" && !editing}>Salvar</Button>} /><SearchInput label="Busca" value={search} onChange={(event) => setSearch(event.target.value)} /><DataTable rows={items} getRowKey={(row) => row.id} columns={[{ key: "logo", header: "Logo", render: (row) => row.logoPath ? "Logo" : row.displayName.slice(0, 2).toUpperCase() }, { key: "name", header: "Nome", render: (row) => row.name }, { key: "display", header: "Nome exibido", render: (row) => row.displayName }, { key: "slug", header: "Slug", render: (row) => row.slug }, { key: "entities", header: "CNPJs", render: (row) => row.legalEntityCount }, { key: "locations", header: "Locais", render: (row) => row.locationCount }, { key: "status", header: "Status", render: (row) => <StatusBadge status={row.isActive ? "ACTIVE" : "INACTIVE"} label={row.isActive ? "Ativa" : "Inativa"} /> }, { key: "updated", header: "Atualizacao", render: (row) => formatDateBr(row.updatedAt) }, { key: "actions", header: "Acoes", render: (row) => <span><button onClick={() => { setEditing(row); setForm(row); }}>Editar</button><button onClick={() => void toggle(row)}>{row.isActive ? "Desativar" : "Ativar"}</button></span> }]} />{profile.appVariant === "multiempresa" || editing ? <OrganizationForm form={form} onChange={setForm} /> : <p className="muted">Cadastro de novas organizacoes disponivel apenas na variante multiempresa.</p>}</section>;
}
