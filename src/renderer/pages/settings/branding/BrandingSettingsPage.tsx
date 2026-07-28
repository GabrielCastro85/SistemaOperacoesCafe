import { useState } from "react";
import { Button, Card, PageHeader } from "../../../design-system";
import type { SettingsPageProps } from "../types";

export function BrandingSettingsPage({ data, refresh }: SettingsPageProps): JSX.Element {
  const [organizationId, setOrganizationId] = useState(data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "");
  const organization = data.organizations.find((item) => item.id === organizationId) ?? data.organizations[0] ?? null;
  async function select(kind: "logo" | "compactLogo" | "icon"): Promise<void> {
    if (!organizationId) return;
    await window.operationsCafe.selectOrganizationBrandingAsset(organizationId, kind);
    await refresh();
  }
  return <section className="content-section"><PageHeader eyebrow="Identidade visual" title="Identidade visual" description="Logos, cores, modo de tema e previas sem salvar Base64 no banco." /><select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>{data.organizations.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select><div className="cards"><Card title="Logo principal"><p>{organization?.logoPath ? "Configurada" : "Fallback"}</p><Button onClick={() => void select("logo")}>Selecionar arquivo</Button></Card><Card title="Logo reduzida"><p>{organization?.compactLogoPath ? "Configurada" : "Fallback"}</p><Button onClick={() => void select("compactLogo")}>Selecionar arquivo</Button></Card><Card title="Icone"><p>{organization?.iconPath ? "Configurado" : "Fallback"}</p><Button onClick={() => void select("icon")}>Selecionar arquivo</Button></Card><Card title="Previa"><p>Primaria {organization?.primaryColor}</p><p>Destaque {organization?.accentColor}</p><button className="primary">Botao</button></Card></div></section>;
}
