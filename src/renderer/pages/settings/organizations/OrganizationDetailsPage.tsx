import { PageHeader } from "../../../design-system";
import type { SettingsPageProps } from "../types";
import { OrganizationBrandingForm } from "./OrganizationBrandingForm";
export function OrganizationDetailsPage({ data }: SettingsPageProps): JSX.Element { const organization = data.organizations[0] ?? null; return <section className="content-section"><PageHeader eyebrow="Organizacao" title={organization?.displayName ?? "Organizacao"} description="Detalhes, branding e restricoes da variante." /><OrganizationBrandingForm organization={organization} /></section>; }
