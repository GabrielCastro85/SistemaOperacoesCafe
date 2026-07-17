import { useState } from "react";
import type { Location } from "../../../../shared/types/domain";
import { Button, DataTable, PageHeader, SearchInput, StatusBadge } from "../../../design-system";
import { DeactivateLocationDialog } from "../dialogs/settingsDialogs";
import { useLocations } from "../hooks/useAdminLists";
import { blankLocation, locationLabels } from "../settingsModels";
import type { SettingsPageProps } from "../types";
import { LocationForm } from "./LocationForm";

export function LocationsPage({ refresh }: SettingsPageProps): JSX.Element {
  const [search, setSearch] = useState("");
  const { bootstrap, items, reload } = useLocations(refresh, search, "all");
  const defaultOrg = bootstrap?.profile?.defaultOrganizationId ?? bootstrap?.organizations[0]?.id ?? "";
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState<Omit<Location, "id" | "createdAt" | "updatedAt">>(blankLocation(defaultOrg));
  if (!bootstrap) return <section className="content-section">Carregando...</section>;
  async function save(): Promise<void> {
    if (editing) await window.operationsCafe.updateLocation(editing.id, form); else await window.operationsCafe.createLocation(form);
    setEditing(null);
    setForm(blankLocation(defaultOrg));
    await reload();
  }
  async function toggle(item: Location): Promise<void> {
    if (item.isActive) { if (await DeactivateLocationDialog()) await window.operationsCafe.deactivateLocation(item.id); } else await window.operationsCafe.activateLocation(item.id);
    await reload();
  }
  return <section className="content-section"><PageHeader eyebrow="Empresa" title="Locais" description="Locais fisicos vinculados a organizacao e opcionalmente a CNPJ proprio." actions={<Button onClick={() => void save()}>Salvar local</Button>} /><SearchInput label="Busca" value={search} onChange={(event) => setSearch(event.target.value)} /><DataTable rows={items} getRowKey={(row) => row.id} columns={[{ key: "name", header: "Nome", render: (row) => row.name }, { key: "type", header: "Tipo", render: (row) => locationLabels[row.type] }, { key: "org", header: "Organizacao", render: (row) => bootstrap.organizations.find((org) => org.id === row.organizationId)?.displayName ?? "-" }, { key: "entity", header: "CNPJ", render: (row) => bootstrap.legalEntities.find((entity) => entity.id === row.legalEntityId)?.tradeName ?? "-" }, { key: "city", header: "Cidade/UF", render: (row) => row.city ? `${row.city}/${row.state}` : "-" }, { key: "status", header: "Status", render: (row) => <StatusBadge status={row.isActive ? "ACTIVE" : "INACTIVE"} label={row.isActive ? "Ativo" : "Inativo"} /> }, { key: "actions", header: "Acoes", render: (row) => <span><button onClick={() => { setEditing(row); setForm(row); }}>Editar</button><button onClick={() => void toggle(row)}>{row.isActive ? "Desativar" : "Ativar"}</button></span> }]} /><LocationForm data={bootstrap} form={form} onChange={setForm} /></section>;
}
