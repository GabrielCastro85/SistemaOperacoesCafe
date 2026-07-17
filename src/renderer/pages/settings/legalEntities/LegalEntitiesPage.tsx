import { useState } from "react";
import type { LegalEntity } from "../../../../shared/types/domain";
import { Button, DataTable, PageHeader, SearchInput, StatusBadge } from "../../../design-system";
import { formatCnpj, formatDateBr, onlyDigits } from "../../../../shared/utils/format";
import { DeactivateLegalEntityDialog } from "../dialogs/settingsDialogs";
import { useLegalEntities } from "../hooks/useAdminLists";
import { blankEntity } from "../settingsModels";
import type { SettingsPageProps } from "../types";
import { LegalEntityForm } from "./LegalEntityForm";

export function LegalEntitiesPage({ refresh }: SettingsPageProps): JSX.Element {
  const [search, setSearch] = useState("");
  const { bootstrap, items, reload } = useLegalEntities(refresh, search, "all");
  const defaultOrg = bootstrap?.profile?.defaultOrganizationId ?? bootstrap?.organizations[0]?.id ?? "";
  const [editing, setEditing] = useState<LegalEntity | null>(null);
  const [form, setForm] = useState<Omit<LegalEntity, "id" | "createdAt" | "updatedAt">>(blankEntity(defaultOrg));
  if (!bootstrap) return <section className="content-section">Carregando...</section>;
  async function save(): Promise<void> {
    const payload = { ...form, cnpj: onlyDigits(form.cnpj), phone: onlyDigits(form.phone), postalCode: onlyDigits(form.postalCode) ?? "" };
    if (editing) await window.operationsCafe.updateLegalEntity(editing.id, payload); else await window.operationsCafe.createLegalEntity(payload);
    setEditing(null);
    setForm(blankEntity(defaultOrg));
    await reload();
  }
  async function toggle(item: LegalEntity): Promise<void> {
    if (item.isActive) { if (await DeactivateLegalEntityDialog()) await window.operationsCafe.deactivateLegalEntity(item.id); } else await window.operationsCafe.activateLegalEntity(item.id);
    await reload();
  }
  return <section className="content-section"><PageHeader eyebrow="Empresa" title="Empresas e CNPJs proprios" description="Dados fiscais, endereco, contato, prefixo e status." actions={<Button onClick={() => void save()}>Salvar CNPJ</Button>} /><SearchInput label="Busca" value={search} onChange={(event) => setSearch(event.target.value)} /><DataTable rows={items} getRowKey={(row) => row.id} columns={[{ key: "trade", header: "Fantasia", render: (row) => row.tradeName }, { key: "legal", header: "Razao social", render: (row) => row.legalName }, { key: "cnpj", header: "CNPJ", render: (row) => formatCnpj(row.cnpj) }, { key: "org", header: "Organizacao", render: (row) => bootstrap.organizations.find((org) => org.id === row.organizationId)?.displayName ?? "-" }, { key: "city", header: "Cidade/UF", render: (row) => `${row.city}/${row.state}` }, { key: "ie", header: "IE", render: (row) => row.stateRegistration ?? "-" }, { key: "status", header: "Status", render: (row) => <StatusBadge status={row.isActive ? "ACTIVE" : "INACTIVE"} label={`${row.isActive ? "Ativo" : "Inativo"}${row.isDraft ? " / rascunho" : ""}`} /> }, { key: "updated", header: "Atualizado", render: (row) => formatDateBr(row.updatedAt) }, { key: "actions", header: "Acoes", render: (row) => <span><button onClick={() => { setEditing(row); setForm(row); }}>Editar</button><button onClick={() => void toggle(row)}>{row.isActive ? "Desativar" : "Ativar"}</button></span> }]} /><LegalEntityForm data={bootstrap} form={form} onChange={setForm} /></section>;
}
