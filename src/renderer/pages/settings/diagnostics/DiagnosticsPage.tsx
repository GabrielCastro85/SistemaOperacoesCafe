import { CopyButton, DefinitionList, PageHeader } from "../../../design-system";
import { useDiagnostics } from "../hooks/useAdminLists";

export function DiagnosticsPage(): JSX.Element {
  const diagnostics = useDiagnostics();
  const text = JSON.stringify(diagnostics, null, 2);
  return <section className="content-section"><PageHeader eyebrow="Diagnostico" title="Diagnostico" description="Informacoes tecnicas sem expor conteudo integral do banco." actions={<CopyButton value={text}>Copiar informacoes tecnicas</CopyButton>} /><DefinitionList items={[{ label: "App", value: diagnostics?.appVersion ?? "-" }, { label: "Produto", value: diagnostics?.productName ?? "-" }, { label: "Variante", value: diagnostics?.buildVariant ?? diagnostics?.activeVariant ?? "-" }, { label: "App ID", value: diagnostics?.appId ?? "-" }, { label: "Executavel", value: diagnostics?.executableName ?? "-" }, { label: "Arquitetura", value: diagnostics?.architecture ?? "-" }, { label: "Assinatura", value: diagnostics?.signatureStatus ?? "-" }, { label: "Organizacao", value: diagnostics?.activeOrganization ?? "-" }, { label: "CNPJ", value: diagnostics?.activeLegalEntity ?? "-" }, { label: "Banco", value: diagnostics?.databaseStatus ?? "-" }, { label: "Documentos", value: diagnostics?.documentsPath ? "Configurado" : "-" }, { label: "Migration", value: diagnostics?.currentMigration ?? "-" }]} /></section>;
}
