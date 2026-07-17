import { PageHeader } from "../../../design-system";
import type { SettingsPageProps } from "../types";
export function LegalEntityDetailsPage({ data }: SettingsPageProps): JSX.Element { const item = data.legalEntities[0]; return <section className="content-section"><PageHeader eyebrow="CNPJ" title={item?.tradeName ?? "CNPJ proprio"} description={item ? `${item.legalName} · ${item.city}/${item.state}` : "Selecione um CNPJ."} /></section>; }
