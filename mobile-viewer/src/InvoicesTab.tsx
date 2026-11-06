import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson, queryString } from "./api";
import { companyColorClass } from "./companyColor";
import { InvoiceDetailDrawer, ManualInvoiceDrawer } from "./InvoiceEditor";
import { formatCurrencyBr, formatDateBr } from "./viewerFormat";
import { Alert } from "./renderer/design-system/components/Alert";
import { Badge, StatusBadge } from "./renderer/design-system/components/Badge";
import { Button } from "./renderer/design-system/components/Button";
import { Card } from "./renderer/design-system/components/Card";
import { EmptyState } from "./renderer/design-system/components/EmptyState";
import { FilterBar } from "./renderer/design-system/components/FilterBar";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { PageHeader } from "./renderer/design-system/components/PageHeader";

type DirectionFilter = "ALL" | "INBOUND" | "OUTBOUND";
type StatusFilter = "ACTIVE" | "PENDING" | "CANCELED" | "ALL";

interface InvoiceRow {
  id: string;
  documentNumber: string;
  series: string | null;
  issueDate: string;
  status: string;
  direction: string;
  source: string;
  ownLegalEntityName: string;
  responsiblePartnerName: string | null;
  counterpartyName: string;
  issuerName: string | null;
  recipientName: string | null;
  totalAmountCents: number;
  sacks: number;
  productNames: string[];
  operationTypes: string[];
  hasPendingIssues: boolean;
  pendingNotes: string | null;
}

interface PartnerOption {
  id: string;
  display_name: string;
  roles: Array<{ role: string }>;
  legal_entities: Array<{ cnpj: string | null; legal_name: string }>;
}

interface ProductOption { id: string; name: string; code: string | null }

interface XmlParty { legalName?: string; tradeName?: string; cnpjCpf?: string; state?: string }
interface XmlItem {
  itemNumber: string;
  productCode?: string;
  description?: string;
  cfop?: string;
  commercialUnit?: string;
  commercialQuantity?: number;
  totalAmountCents?: number;
}
interface XmlPreview {
  accessKey: string;
  number: string;
  series: string;
  issueDate: string;
  nature: string;
  issuer: XmlParty;
  recipient: XmlParty;
  items: XmlItem[];
  ownLegalEntityId: string;
  ownLegalEntityName: string;
  direction: "INBOUND" | "OUTBOUND";
  counterpartyPartnerLegalEntityId: string | null;
  counterpartyCnpj: string;
  counterpartyName: string;
  warnings: string[];
  thirdParty?: boolean;
}

const DIRECTION_LABELS: Record<DirectionFilter, string> = { ALL: "Entradas e saídas", INBOUND: "Entradas", OUTBOUND: "Saídas" };
const STATUS_LABELS: Record<StatusFilter, string> = { ACTIVE: "Ativas", PENDING: "Com pendência", CANCELED: "Canceladas", ALL: "Todas" };
const SOURCE_LABELS: Record<string, string> = { XML: "XML", MANUAL: "Manual", SPREADSHEET: "Planilha", SEFAZ: "SEFAZ" };

function currentMonth(): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const end = new Date(year, now.getMonth() + 1, 0).getDate();
  return { start: `${year}-${month}-01`, end: `${year}-${month}-${String(end).padStart(2, "0")}` };
}

function formatSacks(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export function InvoicesTab({ organizationId, legalEntityId }: { organizationId: string; legalEntityId?: string }): JSX.Element {
  const initial = currentMonth();
  const [periodStart, setPeriodStart] = useState(initial.start);
  const [periodEnd, setPeriodEnd] = useState(initial.end);
  const [direction, setDirection] = useState<DirectionFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ACTIVE");
  const [search, setSearch] = useState("");
  const [documents, setDocuments] = useState<InvoiceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showImporter, setShowImporter] = useState(false);
  const [xmlText, setXmlText] = useState("");
  const [xmlFileName, setXmlFileName] = useState("");
  const [preview, setPreview] = useState<XmlPreview | null>(null);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [responsiblePartnerId, setResponsiblePartnerId] = useState("");
  const [operationScope, setOperationScope] = useState<"INTERNAL" | "EXTERNAL">("INTERNAL");
  const [hasFinancialService, setHasFinancialService] = useState(false);
  const [confirmOperations, setConfirmOperations] = useState(true);
  const [itemProducts, setItemProducts] = useState<Record<string, string>>({});
  const [importBusy, setImportBusy] = useState<"preview" | "import" | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    if (!organizationId) return;
    setError(null);
    setDocuments(null);
    try {
      setDocuments(await apiJson(`/v1/viewer/invoices?${queryString({
        organizationId, legalEntityId, periodStart, periodEnd, direction, status
      })}`));
    } catch (value) {
      setError(value instanceof Error ? value.message : "Falha ao carregar as notas fiscais.");
    }
  }, [organizationId, legalEntityId, periodStart, periodEnd, direction, status]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!showImporter || !organizationId) return;
    void Promise.all([
      apiJson<PartnerOption[]>(`/v1/viewer/partners?${queryString({ organizationId, legalEntityId })}`),
      apiJson<ProductOption[]>(`/v1/viewer/products?${queryString({ organizationId, legalEntityId })}`)
    ]).then(([partnerRows, productRows]) => {
      setPartners(partnerRows);
      setProducts(productRows);
    }).catch((value) => setImportError(value instanceof Error ? value.message : "Falha ao carregar os cadastros comerciais."));
  }, [showImporter, organizationId, legalEntityId]);

  useEffect(() => {
    if (!preview) return;
    if (!responsiblePartnerId) {
      const matched = partners.find((partner) => partner.legal_entities.some((entity) => (entity.cnpj ?? "").replace(/\D/g, "") === preview.counterpartyCnpj));
      if (matched) setResponsiblePartnerId(matched.id);
    }
    setItemProducts((current) => {
      const next = { ...current };
      for (const item of preview.items) {
        if (next[item.itemNumber]) continue;
        const sourceCode = (item.productCode ?? "").trim().toLocaleLowerCase("pt-BR");
        const sourceDescription = (item.description ?? "").trim().toLocaleLowerCase("pt-BR");
        const matched = products.find((product) => {
          const code = (product.code ?? "").trim().toLocaleLowerCase("pt-BR");
          const name = product.name.trim().toLocaleLowerCase("pt-BR");
          return Boolean(sourceCode && code === sourceCode) || Boolean(sourceDescription && (name === sourceDescription || name.includes(sourceDescription) || sourceDescription.includes(name)));
        });
        if (matched) next[item.itemNumber] = matched.id;
      }
      return next;
    });
  }, [preview, partners, products, responsiblePartnerId]);

  const resetImporter = (): void => {
    setXmlText(""); setXmlFileName(""); setPreview(null); setResponsiblePartnerId("");
    setOperationScope("INTERNAL"); setHasFinancialService(false); setConfirmOperations(true);
    setItemProducts({}); setImportError(null); setImportBusy(null);
  };

  const previewXml = async (content = xmlText): Promise<void> => {
    if (!content) return;
    setImportBusy("preview"); setImportError(null); setPreview(null);
    try {
      const result = await apiJson<XmlPreview>("/v1/manage/invoices/xml/preview", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, xml: content })
      });
      setPreview(result);
      setOperationScope(result.issuer.state && result.recipient.state && result.issuer.state !== result.recipient.state ? "EXTERNAL" : "INTERNAL");
      setResponsiblePartnerId("");
      setItemProducts(Object.fromEntries(result.items.map((item) => [item.itemNumber, ""])));
    } catch (value) {
      setImportError(value instanceof Error ? value.message : "Não foi possível ler o XML.");
    } finally { setImportBusy(null); }
  };

  const importXml = async (): Promise<void> => {
    if (!preview) return;
    setImportBusy("import"); setImportError(null);
    try {
      const result = await apiJson<{ status: string; pendingNotes: string | null }>("/v1/manage/invoices/xml/import", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          organizationId, xml: xmlText, responsiblePartnerId, operationScope, hasFinancialService,
          confirmOperations, itemProducts: preview.items.map((item) => ({ itemNumber: item.itemNumber, productId: itemProducts[item.itemNumber] }))
        })
      });
      setSuccess(result.status === "CONFIRMED" ? `NF ${preview.number} importada e confirmada.` : `NF ${preview.number} importada com pendência para revisão.`);
      setShowImporter(false); resetImporter(); await load();
    } catch (value) {
      setImportError(value instanceof Error ? value.message : "Não foi possível importar a nota.");
    } finally { setImportBusy(null); }
  };

  const allItemsMapped = Boolean(preview?.items.length) && preview!.items.every((item) => Boolean(itemProducts[item.itemNumber]));

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return documents ?? [];
    return (documents ?? []).filter((document) => [
      document.documentNumber, document.series, document.counterpartyName, document.responsiblePartnerName,
      document.ownLegalEntityName, document.issuerName, document.recipientName, ...document.productNames
    ].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(term));
  }, [documents, search]);

  const totals = useMemo(() => ({
    count: filtered.length,
    sacks: filtered.reduce((sum, document) => sum + document.sacks, 0),
    amountCents: filtered.reduce((sum, document) => sum + document.totalAmountCents, 0),
    pending: filtered.filter((document) => document.hasPendingIssues || document.status === "PENDING").length
  }), [filtered]);

  return (
    <>
      <PageHeader eyebrow="Operações" title="Notas e operações" description="Consulte, lance, importe e corrija entradas e saídas. Clique numa nota para editar, confirmar, cancelar ou excluir." actions={
        <>
          <Button onClick={() => { setShowManual(true); setSuccess(null); }}>Lançar nota</Button>
          <Button variant={showImporter ? "secondary" : "primary"} onClick={() => { setShowImporter((current) => !current); resetImporter(); }}>{showImporter ? "Fechar importação" : "Importar XML"}</Button>
        </>
      } />
      <ManualInvoiceDrawer open={showManual} organizationId={organizationId} legalEntityId={legalEntityId}
        onClose={() => setShowManual(false)}
        onSaved={(message) => { setShowManual(false); setSuccess(message); void load(); }} />
      <InvoiceDetailDrawer invoiceId={selectedInvoiceId} organizationId={organizationId} legalEntityId={legalEntityId}
        onClose={() => setSelectedInvoiceId(null)}
        onChanged={(message) => { setSuccess(message); void load(); }} />
      {success ? <Alert tone="success" title="Nota atualizada">{success}</Alert> : null}
      {showImporter ? (
        <Card className="viewer-xml-importer" eyebrow="Nova nota" title="Importar NF-e por XML" actions={<Badge tone="info">Leitura segura</Badge>}>
          <div className="viewer-xml-importer__intro">
            <label className="viewer-xml-file">
              <strong>{xmlFileName || "Selecione o XML autorizado da NF-e"}</strong>
              <small>O arquivo é analisado antes de qualquer gravação. Limite de 10 MB.</small>
              <input type="file" accept=".xml,text/xml,application/xml" onChange={(event) => {
                const file = event.target.files?.[0]; if (!file) return;
                if (file.size > 10 * 1024 * 1024) { setImportError("O XML ultrapassa o limite de 10 MB."); return; }
                setXmlFileName(file.name); setPreview(null); setImportError(null);
                void file.text().then((content) => { setXmlText(content); void previewXml(content); });
              }} />
            </label>
            <Button variant="secondary" loading={importBusy === "preview"} disabled={!xmlText} onClick={() => void previewXml()}>Ler novamente</Button>
          </div>
          {importError ? <Alert tone="danger" title="Não foi possível concluir">{importError}</Alert> : null}
          {preview ? (
            <div className="viewer-xml-preview">
              <div className="viewer-xml-preview__summary">
                <span><small>Nota</small><strong>NF {preview.number}{preview.series ? `/${preview.series}` : ""}</strong></span>
                <span><small>Sentido</small><strong>{preview.direction === "INBOUND" ? "Entrada / compra" : "Saída / venda"}</strong></span>
                <span><small>{preview.thirdParty ? "Emissora terceirizada" : "Empresa própria"}</small><strong>{preview.ownLegalEntityName}</strong></span>
                <span><small>Contraparte</small><strong>{preview.counterpartyName}</strong><small>{preview.counterpartyCnpj}</small></span>
              </div>
              {preview.thirdParty ? (
                <Alert tone="info" title="Nota terceirizada">Nenhum CNPJ da nota é empresa própria. Ela será lançada sob a emissora e entra apenas em cobranças, não em fechamento de negócio.</Alert>
              ) : null}
              <div className="viewer-xml-importer__fields">
                <label>Responsável comercial
                  <select className="ui-select" value={responsiblePartnerId} onChange={(event) => setResponsiblePartnerId(event.target.value)}>
                    <option value="">Selecione cliente, corretor ou fornecedor</option>
                    {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.display_name} · {partner.roles.map((role) => role.role).join("/") || "sem papel"}</option>)}
                  </select>
                </label>
                <label>Escopo da operação
                  <select className="ui-select" value={operationScope} onChange={(event) => setOperationScope(event.target.value as "INTERNAL" | "EXTERNAL")}>
                    <option value="INTERNAL">Mesma UF</option><option value="EXTERNAL">Outra UF</option>
                  </select>
                </label>
              </div>
              <div className="viewer-xml-items">
                <div className="viewer-xml-items__head"><span>Item do XML</span><span>CFOP / quantidade</span><span>Produto no sistema</span></div>
                {preview.items.map((item) => (
                  <div className="viewer-xml-item" key={item.itemNumber}>
                    <span><strong>{item.description || `Item ${item.itemNumber}`}</strong><small>Código {item.productCode || "não informado"}</small></span>
                    <span><strong>{item.cfop || "Sem CFOP"}</strong><small>{Number(item.commercialQuantity ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 4 })} {item.commercialUnit}</small></span>
                    <select className="ui-select" value={itemProducts[item.itemNumber] ?? ""} onChange={(event) => setItemProducts((current) => ({ ...current, [item.itemNumber]: event.target.value }))}>
                      <option value="">Selecione o produto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}{product.code ? ` · ${product.code}` : ""}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="viewer-xml-importer__options">
                {preview.direction === "OUTBOUND" ? <label><input type="checkbox" checked={hasFinancialService} onChange={(event) => setHasFinancialService(event.target.checked)} /> Esta nota possui financeiro</label> : null}
                <label><input type="checkbox" checked={confirmOperations} onChange={(event) => setConfirmOperations(event.target.checked)} /> Aplicar tarifas e confirmar as operações agora</label>
              </div>
              <div className="viewer-xml-importer__footer">
                <small>{preview.nature || "Natureza da operação não informada"}</small>
                <Button variant="primary" loading={importBusy === "import"} disabled={!responsiblePartnerId || !allItemsMapped} onClick={() => void importXml()}>Importar {preview.items.length} item(ns)</Button>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}
      <FilterBar
        activeCount={(direction !== "ALL" ? 1 : 0) + (status !== "ALL" ? 1 : 0) + (search.trim() ? 1 : 0)}
        onClear={() => { setDirection("ALL"); setStatus("ALL"); setSearch(""); }}
      >
        <div className="viewer-period-filter viewer-period-filter--inline">
          <label>Início<input className="ui-input" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
          <label>Fim<input className="ui-input" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
        </div>
        <input className="ui-input" type="search" placeholder="Buscar nota, empresa, fornecedor, cliente ou produto..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <div className="viewer-filter-groups">
          <div className="viewer-chip-row">
            {(Object.keys(DIRECTION_LABELS) as DirectionFilter[]).map((mode) => (
              <Button key={mode} variant={direction === mode ? "primary" : "secondary"} onClick={() => setDirection(mode)}>{DIRECTION_LABELS[mode]}</Button>
            ))}
          </div>
          <div className="viewer-chip-row">
            {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((mode) => (
              <Button key={mode} variant={status === mode ? "primary" : "secondary"} onClick={() => setStatus(mode)}>{STATUS_LABELS[mode]}</Button>
            ))}
          </div>
        </div>
      </FilterBar>
      {error ? <Alert tone="danger" title="Falha ao carregar notas">{error}</Alert> : null}
      {!error && !documents ? <LoadingState label="Carregando notas e operações..." /> : null}
      {documents ? (
        <Card className="viewer-open-notes-summary">
          <div className="viewer-open-notes-summary__metrics viewer-invoice-summary__metrics">
            <span><small>Notas no filtro</small><strong>{totals.count.toLocaleString("pt-BR")}</strong></span>
            <span><small>Sacas</small><strong>{formatSacks(totals.sacks)}</strong></span>
            <span><small>Valor fiscal</small><strong>{formatCurrencyBr(totals.amountCents)}</strong></span>
            <span><small>Com pendência</small><strong>{totals.pending.toLocaleString("pt-BR")}</strong></span>
          </div>
        </Card>
      ) : null}
      {documents && filtered.length === 0 ? <EmptyState title="Nenhuma nota encontrada" description="Ajuste o período, o sentido, a situação ou a busca." /> : null}
      {documents && filtered.length > 0 ? (
        <div className="viewer-invoice-list">
          <div className="viewer-invoice-list__head" aria-hidden="true">
            <span>Nota / emissão</span><span>Sentido / empresa</span><span>Contraparte / responsável</span><span>Produto / sacas</span><span>Valor fiscal</span><span>Situação</span>
          </div>
          {filtered.map((document) => (
            <article key={document.id} className={`viewer-invoice-row viewer-invoice-row--clickable ${companyColorClass(document.ownLegalEntityName)}`}
              role="button" tabIndex={0} aria-label={`Abrir NF ${document.documentNumber}`}
              onClick={() => { setSelectedInvoiceId(document.id); setSuccess(null); }}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedInvoiceId(document.id); setSuccess(null); } }}>
              <span className="viewer-invoice-row__note"><strong>NF {document.documentNumber}{document.series ? `/${document.series}` : ""}</strong><small>{formatDateBr(document.issueDate)}</small></span>
              <span><Badge tone={document.direction === "INBOUND" ? "info" : document.direction === "OUTBOUND" ? "success" : "neutral"}>{document.direction === "INBOUND" ? "Entrada" : document.direction === "OUTBOUND" ? "Saída" : "Não identificada"}</Badge><small>{document.ownLegalEntityName}</small></span>
              <span><strong>{document.counterpartyName}</strong><small>{document.responsiblePartnerName ? `Responsável: ${document.responsiblePartnerName}` : "Sem responsável comercial"}</small></span>
              <span><strong>{document.productNames.slice(0, 2).join(" · ") || "Produto não informado"}</strong><small>{formatSacks(document.sacks)} sacas</small></span>
              <span className="viewer-invoice-row__amount"><strong>{formatCurrencyBr(document.totalAmountCents)}</strong><small>{SOURCE_LABELS[document.source] ?? document.source}</small></span>
              <span><StatusBadge status={document.status} />{document.hasPendingIssues ? <Badge tone="warning">Revisar</Badge> : null}</span>
            </article>
          ))}
        </div>
      ) : null}
    </>
  );
}
