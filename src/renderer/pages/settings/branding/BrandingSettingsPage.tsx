import { useEffect, useState } from "react";
import { Alert, Button, Card, PageHeader } from "../../../design-system";
import type { SettingsPageProps } from "../types";

const colorFields = [
  { key: "primaryColor", label: "Cor primaria" },
  { key: "secondaryColor", label: "Cor secundaria" },
  { key: "accentColor", label: "Cor de destaque" }
] as const;

export function BrandingSettingsPage({ data, refresh }: SettingsPageProps): JSX.Element {
  const [organizationId, setOrganizationId] = useState(data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "");
  const organization = data.organizations.find((item) => item.id === organizationId) ?? data.organizations[0] ?? null;
  const [colors, setColors] = useState({
    primaryColor: organization?.primaryColor ?? "#1F6F4A",
    secondaryColor: organization?.secondaryColor ?? "#0B3D26",
    accentColor: organization?.accentColor ?? "#E0A94A"
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!organization) return;
    setColors({
      primaryColor: organization.primaryColor,
      secondaryColor: organization.secondaryColor,
      accentColor: organization.accentColor
    });
  }, [organization?.id]);

  async function select(kind: "logo" | "compactLogo" | "icon"): Promise<void> {
    if (!organizationId) return;
    await window.operationsCafe.selectOrganizationBrandingAsset(organizationId, kind);
    await refresh();
  }

  async function saveColors(): Promise<void> {
    if (!organizationId) return;
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      await window.operationsCafe.updateOrganizationColors(organizationId, colors);
      await refresh();
      setMessage("Cores salvas. Ja valem em todas as telas e nos proximos PDFs gerados.");
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Falha ao salvar as cores.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="content-section">
      <PageHeader
        eyebrow="Identidade visual"
        title="Identidade visual"
        description="Logo, cores e previa -- valem pra tela e pros PDFs gerados por esta empresa, sem precisar gerar um instalador novo."
      />
      <select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>
        {data.organizations.map((item) => (
          <option key={item.id} value={item.id}>{item.displayName}</option>
        ))}
      </select>
      {error && <Alert variant="danger">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}
      <div className="cards">
        <Card title="Logo principal">
          <p>{organization?.logoPath ? "Configurada" : "Fallback"}</p>
          <Button onClick={() => void select("logo")}>Selecionar arquivo</Button>
        </Card>
        <Card title="Logo reduzida">
          <p>{organization?.compactLogoPath ? "Configurada" : "Fallback"}</p>
          <Button onClick={() => void select("compactLogo")}>Selecionar arquivo</Button>
        </Card>
        <Card title="Icone">
          <p>{organization?.iconPath ? "Configurado" : "Fallback"}</p>
          <Button onClick={() => void select("icon")}>Selecionar arquivo</Button>
        </Card>
        <Card title="Cores da marca">
          <div className="color-field-grid">
            {colorFields.map((field) => (
              <label key={field.key} className="color-field">
                <span>{field.label}</span>
                <div className="color-field__row">
                  <input
                    type="color"
                    value={colors[field.key]}
                    onChange={(event) => setColors((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  />
                  <span className="color-field__hex">{colors[field.key]}</span>
                </div>
              </label>
            ))}
          </div>
          <Button variant="primary" onClick={() => void saveColors()} loading={saving}>Salvar cores</Button>
        </Card>
        <Card title="Previa">
          <div style={{ background: colors.primaryColor, color: "#fff", padding: "10px 14px", borderRadius: 8 }}>
            Cabecalho de exemplo
          </div>
          <button
            className="primary"
            style={{ background: colors.accentColor, borderColor: colors.accentColor, marginTop: 10 }}
          >
            Botao de exemplo
          </button>
        </Card>
      </div>
    </section>
  );
}
