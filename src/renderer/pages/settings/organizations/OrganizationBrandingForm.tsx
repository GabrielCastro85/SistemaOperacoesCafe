import type { Organization } from "../../../../shared/types/domain";
import { Card } from "../../../design-system";

export function OrganizationBrandingForm({ organization }: { organization: Organization | null }): JSX.Element {
  return <Card><strong>Previa de identidade</strong><p>Logo principal: {organization?.logoPath ? "Configurada" : "Fallback"}</p><p>Logo reduzida: {organization?.compactLogoPath ? "Configurada" : "Fallback"}</p><p>Icone: {organization?.iconPath ? "Configurado" : "Fallback"}</p><p>Cores: {organization?.primaryColor ?? "-"} / {organization?.accentColor ?? "-"}</p></Card>;
}
