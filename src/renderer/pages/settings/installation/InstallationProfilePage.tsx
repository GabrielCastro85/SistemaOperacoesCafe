import { useState } from "react";
import { Button, DefinitionList, PageHeader, Select } from "../../../design-system";
import type { InstallationProfile } from "../../../../shared/types/domain";
import type { SettingsPageProps } from "../types";

export function InstallationProfilePage({ data, profile, onProfile }: SettingsPageProps): JSX.Element {
  const [form, setForm] = useState<InstallationProfile>(profile);
  async function save(): Promise<void> {
    const saved = await window.operationsCafe.updateInstallationProfile(form);
    onProfile(saved);
  }
  return <section className="content-section"><PageHeader eyebrow="Sistema" title="Perfil da instalacao" description="Padroes da instalacao local e permissoes de troca." actions={<Button onClick={() => void save()}>Salvar perfil</Button>} /><DefinitionList items={[{ label: "Instalacao", value: form.installationName }, { label: "Variante", value: form.appVariant }, { label: "Setup concluido", value: form.completedSetup ? "Sim" : "Nao" }, { label: "Versao", value: data.version }]} /><Select label="Organizacao padrao" value={form.defaultOrganizationId ?? ""} onChange={(event) => setForm({ ...form, defaultOrganizationId: event.target.value || null })}>{data.organizations.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</Select><Select label="CNPJ padrao" value={form.defaultLegalEntityId ?? ""} onChange={(event) => setForm({ ...form, defaultLegalEntityId: event.target.value || null })}>{data.legalEntities.map((item) => <option key={item.id} value={item.id}>{item.tradeName}</option>)}</Select></section>;
}
