import { Card, PageHeader } from "../../design-system";

const groups = [
  { title: "Empresa", items: [["Organizacoes", "/settings/organizations"], ["Empresas e CNPJs", "/settings/legal-entities"], ["Locais", "/settings/locations"], ["Identidade visual", "/settings/branding"]] },
  { title: "Operacao", items: [["Produtos", "/products"], ["Regras por saca", "/billing/rates"], ["Templates de importacao", "/settings/import-templates"]] },
  { title: "Financeiro", items: [["Categorias", "/finance/categories"], ["Centros de custo", "/finance/cost-centers"], ["Contas financeiras", "/finance/accounts"]] },
  { title: "Documentos", items: [["Templates de confirmacao", "/settings/confirmation-templates"], ["Clausulas", "/settings/clauses"], ["Numeracoes", "/settings/document-sequences"]] },
  { title: "Sistema", items: [["Perfil da instalacao", "/settings/installation"], ["Diretorios", "/settings/directories"], ["Diagnostico", "/settings/diagnostics"], ["Sistema", "/settings/system"]] },
  { title: "Seguranca e recuperacao", items: [["Backups", "/settings/backups"], ["Criar backup", "/settings/backups/new"], ["Restaurar", "/settings/restore"], ["Integridade", "/settings/integrity"], ["Retencao", "/settings/retention"]] }
];

export function SettingsHomePage(): JSX.Element {
  return <section className="content-section"><PageHeader eyebrow="Administracao" title="Configuracoes" description="Escolha um cadastro ou ajuste administrativo sem renderizar todos os formularios na mesma tela." /><div className="cards">{groups.map((group) => <Card key={group.title}><h2>{group.title}</h2>{group.items.map(([label, route]) => <button key={route} onClick={() => { window.location.hash = `#${route}`; }}>{label}</button>)}</Card>)}</div></section>;
}
