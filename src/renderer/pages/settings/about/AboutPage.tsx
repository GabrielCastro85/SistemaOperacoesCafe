import { CopyButton, DefinitionList, PageHeader, PageSection } from "../../../design-system";
import { useDiagnostics } from "../hooks/useAdminLists";

export function AboutPage(): JSX.Element {
  const diagnostics = useDiagnostics();
  const text = JSON.stringify(diagnostics, null, 2);

  return (
    <section className="content-section">
      <PageHeader
        eyebrow="Distribuicao"
        title={diagnostics?.productName ?? "Sistema de Operacoes de Cafe"}
        description="Metadados da instalacao Windows, variante, banco local e assinatura."
        actions={<CopyButton value={text}>Copiar diagnostico</CopyButton>}
      />
      <PageSection title="Aplicativo">
        <DefinitionList
          items={[
            { label: "Produto", value: diagnostics?.productName ?? "-" },
            { label: "Versao", value: diagnostics?.appVersion ?? "-" },
            { label: "Variante", value: diagnostics?.buildVariant ?? diagnostics?.activeVariant ?? "-" },
            { label: "App ID", value: diagnostics?.appId ?? "-" },
            { label: "Executavel", value: diagnostics?.executableName ?? "-" },
            { label: "Arquitetura", value: diagnostics?.architecture ?? "-" },
            { label: "Electron", value: diagnostics?.electronVersion ?? "-" },
            { label: "Assinatura", value: diagnostics?.signatureStatus ?? "-" }
          ]}
        />
      </PageSection>
      <PageSection title="Dados locais">
        <DefinitionList
          items={[
            { label: "Banco", value: diagnostics?.databaseStatus ?? "-" },
            { label: "Migration", value: diagnostics?.currentMigration ?? "-" },
            { label: "Documentos", value: diagnostics?.documentsPath ? "Configurado" : "-" },
            { label: "Organizacao", value: diagnostics?.activeOrganization ?? "-" },
            { label: "CNPJ", value: diagnostics?.activeLegalEntity ?? "-" }
          ]}
        />
      </PageSection>
    </section>
  );
}
