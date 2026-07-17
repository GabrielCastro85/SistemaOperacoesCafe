import React, { useCallback, useEffect, useState } from "react";
import type { BootstrapData, BusinessPartner, FiscalDocument, FiscalDocumentDetail, OperationScope, Product, SheetPreview, SpreadsheetImportJob, SpreadsheetImportRow, WorkbookInspection, XmlFileInspection, XmlImportFile, XmlImportJob } from "../../../shared/types/domain";
import { formatCurrencyFromCents, formatDateBr, onlyDigits } from "../../../shared/utils/format";
import { PageHeader, Stepper, Tabs } from "../../design-system";
import { SelectField, TextField } from "../../components/forms/LegacyFields";
import { Feedback } from "../../components/feedback/Feedback";
import { AdminBlock, FormGrid } from "../../components/layout/SectionPrimitives";
import { requestTextInput } from "../../utils/dialogs";
export function OperationsPage({ data }: { data: BootstrapData }): JSX.Element {
  const organizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "";
  const ownLegalEntityId = data.profile?.defaultLegalEntityId ?? data.legalEntities.find((item) => item.organizationId === organizationId)?.id ?? "";
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [documents, setDocuments] = useState<FiscalDocument[]>([]);
  const [detail, setDetail] = useState<FiscalDocumentDetail | null>(null);
  const [indicators, setIndicators] = useState<{ documents: number; pending: number; confirmed: number; operations: number; serviceAmountCents: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState("");
  const [number, setNumber] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [total, setTotal] = useState("0,00");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("0.0000");
  const [sacks, setSacks] = useState("1");
  const [scope, setScope] = useState<OperationScope>("EXTERNAL");
  const [operationType, setOperationType] = useState<"PURCHASE" | "SALE">("SALE");
  const [workbook, setWorkbook] = useState<WorkbookInspection | null>(null);
  const [preview, setPreview] = useState<SheetPreview | null>(null);
  const [importJob, setImportJob] = useState<{ job: SpreadsheetImportJob; rows: SpreadsheetImportRow[] } | null>(null);
  const [importHistory, setImportHistory] = useState<SpreadsheetImportJob[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [headerRow, setHeaderRow] = useState("1");
  const [xmlSelections, setXmlSelections] = useState<Array<{ token: string; fileName: string; sizeBytes: number }>>([]);
  const [xmlQueue, setXmlQueue] = useState<XmlFileInspection[]>([]);
  const [xmlJob, setXmlJob] = useState<{ job: XmlImportJob; files: XmlImportFile[] } | null>(null);
  const [xmlHistory, setXmlHistory] = useState<XmlImportJob[]>([]);
  const [includeXmlSubfolders, setIncludeXmlSubfolders] = useState(false);

  const load = useCallback(async () => {
    const clientPartners = await window.operationsCafe.listBusinessPartners({ organizationId, role: "CLIENT", status: "active" });
    setPartners(clientPartners);
    setPartnerId((current) => current || clientPartners[0]?.id || "");
    const activeProducts = await window.operationsCafe.listProducts({ organizationId, status: "active" });
    setProducts(activeProducts);
    setProductId((current) => current || activeProducts[0]?.id || "");
    setDocuments(await window.operationsCafe.listFiscalDocuments({ organizationId, status: "all" }));
    setIndicators(await window.operationsCafe.getOperationalIndicators(organizationId));
    setImportHistory(await window.operationsCafe.listSpreadsheetImportJobs(organizationId));
    setXmlHistory(await window.operationsCafe.listXmlImportJobs(organizationId));
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  const parseCurrency = (value: string): number => Math.round(Number(value.replace(".", "").replace(",", ".")) * 100);

  async function createDocument(): Promise<void> {
    try {
      const created = await window.operationsCafe.createFiscalDocument({
        organizationId,
        ownLegalEntityId,
        responsiblePartnerId: partnerId,
        partnerLegalEntityId: null,
        accessKey: onlyDigits(accessKey),
        documentNumber: number,
        series: null,
        issueDate: new Date().toISOString().slice(0, 10),
        totalAmountCents: parseCurrency(total),
        hasPendingIssues: false,
        pendingNotes: null,
        notes: null
      });
      setDetail(created);
      setMessage(created.document.duplicateWarning ?? "Nota criada.");
      await load();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao criar nota."}`);
    }
  }

  async function addItemAndOperation(): Promise<void> {
    if (!detail) return;
    try {
      const item = await window.operationsCafe.addFiscalDocumentItem({
        fiscalDocumentId: detail.document.id,
        productId: productId || null,
        description: products.find((product) => product.id === productId)?.name ?? "Item manual",
        quantity,
        unit: "SACK",
        unitPriceDecimal: unitPrice,
        totalAmountCents: parseCurrency(total),
        sacksQuantity: sacks
      });
      await window.operationsCafe.addOperation({
        fiscalDocumentId: detail.document.id,
        fiscalDocumentItemId: item.id,
        ownLegalEntityId,
        responsiblePartnerId: detail.document.responsiblePartnerId,
        productId: productId || null,
        operationType,
        operationScope: scope,
        operationDate: detail.document.issueDate,
        quantitySacks: sacks,
        manualRateValueCents: null,
        manualOverrideReason: null,
        notes: null
      });
      setDetail(await window.operationsCafe.getFiscalDocument(detail.document.id));
      setMessage("Item e operacao adicionados.");
      await load();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao adicionar operacao."}`);
    }
  }

  async function overrideFirstOperation(): Promise<void> {
    if (!detail?.operations[0]) return;
    const reason = await requestTextInput({ title: "Alterar valor do serviço", label: "Motivo da alteração manual do valor por saca" });
    if (!reason) return;
    await window.operationsCafe.updateOperationManualRate(detail.operations[0].id, 750, reason);
    setDetail(await window.operationsCafe.getFiscalDocument(detail.document.id));
    setMessage("Valor por saca alterado manualmente para R$ 7,50.");
  }

  async function selectSpreadsheet(): Promise<void> {
    try {
      const selected = await window.operationsCafe.selectSpreadsheetFile();
      if (!selected) return;
      setWorkbook(selected);
      setSelectedSheet(selected.sheets[0]?.name ?? "");
      setMessage("Planilha selecionada.");
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao selecionar planilha."}`);
    }
  }

  async function previewSpreadsheet(): Promise<void> {
    if (!workbook || !selectedSheet) return;
    const sheetPreview = await window.operationsCafe.previewSpreadsheetSheet({ token: workbook.token, sheetName: selectedSheet, headerRow: Number(headerRow) });
    setPreview(sheetPreview);
    setMessage("Previa carregada.");
  }

  async function validateSpreadsheet(): Promise<void> {
    if (!workbook || !preview || !partnerId) return;
    const job = await window.operationsCafe.createSpreadsheetImportDraft({
      organizationId,
      ownLegalEntityId,
      mappingTemplateId: null,
      originalFileName: workbook.fileName,
      storedFilePath: null,
      selectedSheetName: selectedSheet,
      importType: preview.suggestedMapping.clientName ? "GENERAL_SALES" : "CLIENT_INDIVIDUAL",
      settings: { defaultPartnerId: partnerId, operationType, defaultOperationScope: scope, defaultProductId: productId, defaultDate: new Date().toISOString().slice(0, 10) }
    });
    const validated = await window.operationsCafe.validateSpreadsheetImportRows({
      token: workbook.token,
      jobId: job.id,
      sheetName: selectedSheet,
      headerRow: Number(headerRow),
      mapping: preview.suggestedMapping,
      defaults: { defaultPartnerId: partnerId, operationType, defaultOperationScope: scope, defaultProductId: productId, defaultDate: new Date().toISOString().slice(0, 10) }
    });
    setImportJob(validated);
    setMessage("Linhas validadas.");
  }

  async function executeSpreadsheet(): Promise<void> {
    if (!workbook || !importJob) return;
    const executed = await window.operationsCafe.executeSpreadsheetImport({ jobId: importJob.job.id, token: workbook.token, importWarnings: true });
    setImportJob(executed);
    setMessage("Importacao processada.");
    await load();
  }

  async function prepareXmlImport(source: "single" | "multiple" | "folder"): Promise<void> {
    try {
      const selected =
        source === "single"
          ? await window.operationsCafe.selectXmlFile()
          : source === "multiple"
            ? await window.operationsCafe.selectXmlFiles()
            : (await window.operationsCafe.selectXmlFolder(includeXmlSubfolders)).files;
      if (selected.length === 0) return;
      const inspections = await window.operationsCafe.inspectXmlFiles(selected.map((file) => file.token));
      setXmlSelections(selected);
      setXmlQueue(inspections);
      setXmlJob(null);
      setMessage(`${inspections.length} XML(s) inspecionado(s).`);
    } catch (errorValue) {
      setMessage(`Erro XML: ${errorValue instanceof Error ? errorValue.message : "falha ao selecionar XML."}`);
    }
  }

  async function validateXmlImport(): Promise<void> {
    if (xmlSelections.length === 0) return;
    try {
      const job = await window.operationsCafe.createXmlImportDraft({
        organizationId,
        sourceType: xmlSelections.length === 1 ? "FILE" : "MULTIPLE_FILES",
        selectedFolder: null,
        includeSubfolders: includeXmlSubfolders,
        settings: { clientPartnerId: partnerId || null, operationType, operationScope: scope, productId: productId || null, createOperations: true }
      });
      const added = await window.operationsCafe.addXmlImportFiles({ jobId: job.id, tokens: xmlSelections.map((file) => file.token) });
      const validated = await window.operationsCafe.validateXmlImportJob(added.job.id);
      setXmlJob(validated);
      setMessage("Fila XML validada.");
      await load();
    } catch (errorValue) {
      setMessage(`Erro XML: ${errorValue instanceof Error ? errorValue.message : "falha ao validar XML."}`);
    }
  }

  async function executeXmlImport(): Promise<void> {
    if (!xmlJob) return;
    try {
      const executed = await window.operationsCafe.executeXmlImportJob({ jobId: xmlJob.job.id, tokens: xmlSelections.map((file) => file.token) });
      setXmlJob(executed);
      setMessage("Importacao XML processada.");
      await load();
    } catch (errorValue) {
      setMessage(`Erro XML: ${errorValue instanceof Error ? errorValue.message : "falha ao importar XML."}`);
    }
  }

  return (
    <section className="content-section settings">
      <PageHeader
        eyebrow="Operações"
        title="Notas e operações"
        description="Cadastre notas manuais, acompanhe operações, pendências e importações locais de planilhas e XML."
      />
      <Stepper
        activeId="documents"
        steps={[
          { id: "documents", label: "Notas fiscais", status: "current" },
          { id: "items", label: "Itens", status: detail ? "complete" : "pending" },
          { id: "classification", label: "Classificação", status: detail?.operations.length ? "complete" : "pending" },
          { id: "review", label: "Revisão", status: detail?.document.status === "CONFIRMED" ? "complete" : "pending" }
        ]}
      />
      <Tabs
        active="documents"
        items={[
          { id: "documents", label: "Notas fiscais" },
          { id: "operations", label: "Operações" },
          { id: "pending", label: "Pendências" },
          { id: "spreadsheets", label: "Planilhas" },
          { id: "xml", label: "XML NF-e" }
        ]}
        onChange={() => undefined}
      />
      <AdminBlock title="Notas e operacoes manuais">
        <div className="cards">
          <article><span>Notas</span><strong>{indicators?.documents ?? 0}</strong></article>
          <article><span>Pendencias</span><strong>{indicators?.pending ?? 0}</strong></article>
          <article><span>Servico calculado</span><strong>{formatCurrencyFromCents(indicators?.serviceAmountCents ?? 0)}</strong></article>
        </div>
        <FormGrid>
          <SelectField label="Cliente responsavel" value={partnerId} onChange={setPartnerId} options={partners.map((item) => [item.id, item.displayName])} />
          <TextField label="Numero da nota" value={number} onChange={setNumber} />
          <TextField label="Chave de acesso" value={accessKey} onChange={setAccessKey} />
          <TextField label="Valor total" value={total} onChange={setTotal} />
          <button className="primary" onClick={() => void createDocument()}>Criar nota</button>
        </FormGrid>
        <div className="table"><div className="table-head invoice-grid"><span>Numero</span><span>Cliente</span><span>Emissao</span><span>Status</span><span>Valor</span><span>Alerta</span><span>Acoes</span></div>{documents.map((doc) => <div key={doc.id} className="table-row invoice-grid"><span>{doc.documentNumber}</span><span>{partners.find((partner) => partner.id === doc.responsiblePartnerId)?.displayName ?? doc.responsiblePartnerId}</span><span>{doc.issueDate}</span><span>{doc.status}</span><span>{formatCurrencyFromCents(doc.totalAmountCents)}</span><span>{doc.duplicateWarning ?? "-"}</span><span><button onClick={() => window.operationsCafe.getFiscalDocument(doc.id).then(setDetail)}>Abrir</button></span></div>)}</div>
      </AdminBlock>
      {detail ? <AdminBlock title={`Detalhe da nota ${detail.document.documentNumber}`}>
        <FormGrid>
          <SelectField label="Produto" value={productId} onChange={setProductId} options={products.map((item) => [item.id, item.name])} />
          <SelectField label="Compra/venda" value={operationType} onChange={(value) => setOperationType(value as "PURCHASE" | "SALE")} options={[["PURCHASE", "Compra"], ["SALE", "Venda"]]} />
          <SelectField label="Interna/externa" value={scope} onChange={(value) => setScope(value as OperationScope)} options={[["INTERNAL", "Interna"], ["EXTERNAL", "Externa"]]} />
          <TextField label="Quantidade" value={quantity} onChange={setQuantity} />
          <TextField label="Preco unitario comercial" value={unitPrice} onChange={setUnitPrice} />
          <TextField label="Sacas" value={sacks} onChange={setSacks} />
          <button onClick={() => void addItemAndOperation()}>Adicionar item e operacao</button>
          <button onClick={() => void overrideFirstOperation()}>Alterar valor primeira operacao</button>
          <button onClick={() => window.operationsCafe.confirmFiscalDocument(detail.document.id).then(setDetail).catch((errorValue: unknown) => setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao confirmar."}`))}>Confirmar</button>
          <button onClick={() => { void requestTextInput({ title: "Cancelar nota", label: "Motivo do cancelamento" }).then((reason) => { if (reason) void window.operationsCafe.cancelFiscalDocument(detail.document.id, reason).then(setDetail); }); }}>Cancelar</button>
        </FormGrid>
        <div className="cards">
          <article><span>Itens</span><strong>{detail.items.map((item) => `${item.description}: ${item.quantity} ${item.unit}`).join(" | ") || "Nenhum"}</strong></article>
          <article><span>Operacoes</span><strong>{detail.operations.map((op) => `${op.operationType}/${op.operationScope}: ${op.quantitySacks} sacas - ${formatCurrencyFromCents(op.serviceAmountCents)}`).join(" | ") || "Nenhuma"}</strong></article>
          <article><span>Status</span><strong>{detail.document.status}</strong></article>
        </div>
      </AdminBlock> : null}
      <AdminBlock title="Importar planilha">
        <div className="toolbar">
          <button onClick={() => void selectSpreadsheet()}>Selecionar planilha</button>
          <SelectField label="Aba" value={selectedSheet} onChange={setSelectedSheet} options={(workbook?.sheets ?? []).map((sheet) => [sheet.name, `${sheet.name} (${sheet.rowCount} linhas)`])} />
          <TextField label="Linha de cabecalho" value={headerRow} onChange={setHeaderRow} />
          <button onClick={() => void previewSpreadsheet()} disabled={!workbook}>Previsualizar</button>
          <button onClick={() => void validateSpreadsheet()} disabled={!preview}>Validar</button>
          <button className="primary" onClick={() => void executeSpreadsheet()} disabled={!importJob}>Importar validas</button>
        </div>
        {workbook ? <p className="muted">Arquivo: {workbook.fileName} - {Math.round(workbook.sizeBytes / 1024)} KB</p> : null}
        {preview ? <div className="table"><div className="table-head import-grid"><span>Campo</span><span>Coluna sugerida</span></div>{Object.entries(preview.suggestedMapping).map(([field, column]) => <div key={field} className="table-row import-grid"><span>{field}</span><span>{column}</span></div>)}</div> : null}
        {importJob ? <div className="cards"><article><span>Total</span><strong>{importJob.job.totalRows}</strong></article><article><span>Validas</span><strong>{importJob.job.validRows}</strong></article><article><span>Erros</span><strong>{importJob.job.errorRows}</strong></article><article><span>Importadas</span><strong>{importJob.job.importedRows}</strong></article></div> : null}
      </AdminBlock>
      <AdminBlock title="Historico de importacoes">
        <div className="table"><div className="table-head import-history-grid"><span>Arquivo</span><span>Aba</span><span>Status</span><span>Linhas</span><span>Importadas</span><span>Acoes</span></div>{importHistory.map((job) => <div key={job.id} className="table-row import-history-grid"><span>{job.originalFileName}</span><span>{job.selectedSheetName}</span><span>{job.status}</span><span>{job.totalRows}</span><span>{job.importedRows}</span><span><button onClick={() => window.operationsCafe.getSpreadsheetImportJob(job.id).then(setImportJob)}>Detalhar</button><button onClick={() => { void requestTextInput({ title: "Reverter importação", label: "Motivo da reversão" }).then((reason) => { if (reason) void window.operationsCafe.revertSpreadsheetImportJob(job.id, reason).then(setImportJob).then(() => load()); }); }}>Reverter</button></span></div>)}</div>
      </AdminBlock>
      <AdminBlock title="Importar XML NF-e">
        <div className="toolbar">
          <button onClick={() => void prepareXmlImport("single")}>Selecionar XML</button>
          <button onClick={() => void prepareXmlImport("multiple")}>Selecionar varios XMLs</button>
          <button onClick={() => void prepareXmlImport("folder")}>Selecionar pasta</button>
          <label className="inline-check"><input type="checkbox" checked={includeXmlSubfolders} onChange={(event) => setIncludeXmlSubfolders(event.target.checked)} /> Incluir subpastas</label>
          <button onClick={() => void validateXmlImport()} disabled={xmlQueue.length === 0}>Validar fila</button>
          <button className="primary" onClick={() => void executeXmlImport()} disabled={!xmlJob}>Importar XMLs</button>
        </div>
        <FormGrid>
          <SelectField label="Cliente padrao" value={partnerId} onChange={setPartnerId} options={partners.map((item) => [item.id, item.displayName])} />
          <SelectField label="Compra/venda" value={operationType} onChange={(value) => setOperationType(value as "PURCHASE" | "SALE")} options={[["PURCHASE", "Compra"], ["SALE", "Venda"]]} />
          <SelectField label="Interna/externa" value={scope} onChange={(value) => setScope(value as OperationScope)} options={[["INTERNAL", "Interna"], ["EXTERNAL", "Externa"]]} />
        </FormGrid>
        {xmlQueue.length ? <div className="table"><div className="table-head xml-grid"><span>Arquivo</span><span>Tipo</span><span>Chave</span><span>Status</span><span>Mensagens</span></div>{xmlQueue.map((file) => <div key={file.token} className="table-row xml-grid"><span>{file.originalFileName}</span><span>{file.xmlType}</span><span>{file.accessKey ?? "-"}</span><span>{file.status}</span><span>{file.errorMessage ?? (file.warnings.join(", ") || "-")}</span></div>)}</div> : null}
        {xmlJob ? <div className="cards"><article><span>Arquivos</span><strong>{xmlJob.job.totalFiles}</strong></article><article><span>Validos</span><strong>{xmlJob.job.validFiles}</strong></article><article><span>Eventos</span><strong>{xmlJob.job.importedEvents}</strong></article><article><span>Notas</span><strong>{xmlJob.job.importedNotes}</strong></article><article><span>Erros</span><strong>{xmlJob.job.errorFiles}</strong></article></div> : null}
      </AdminBlock>
      <AdminBlock title="Historico de XML">
        <div className="table"><div className="table-head xml-history-grid"><span>Data</span><span>Status</span><span>Arquivos</span><span>Notas</span><span>Eventos</span><span>Erros</span><span>Acoes</span></div>{xmlHistory.map((job) => <div key={job.id} className="table-row xml-history-grid"><span>{formatDateBr(job.createdAt)}</span><span>{job.status}</span><span>{job.totalFiles}</span><span>{job.importedNotes}</span><span>{job.importedEvents}</span><span>{job.errorFiles}</span><span><button onClick={() => window.operationsCafe.getXmlImportJob(job.id).then(setXmlJob)}>Detalhar</button><button onClick={() => { void requestTextInput({ title: "Reverter XML", label: "Motivo da reversão XML" }).then((reason) => { if (reason) void window.operationsCafe.revertXmlImportJob(job.id, reason).then(setXmlJob).then(() => load()); }); }}>Reverter</button></span></div>)}</div>
      </AdminBlock>
      <Feedback message={message} />
    </section>
  );
}

