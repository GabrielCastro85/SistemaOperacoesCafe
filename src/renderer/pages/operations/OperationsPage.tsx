import React, { useCallback, useEffect, useRef, useState } from "react";
import type { BootstrapData, BusinessPartner, BusinessPartnerLegalEntity, FiscalDocument, FiscalDocumentDetail, OperationScope, Product, SheetPreview, SpreadsheetImportJob, SpreadsheetImportRow, WorkbookInspection, XmlFileInspection, XmlImportFile, XmlImportJob } from "../../../shared/types/domain";
import { formatCurrencyFromCents, formatDateBr, formatDateOnlyBr, onlyDigits, parseCurrencyToCents } from "../../../shared/utils/format";
import { EmptyState, FileDropzone, ListStepsIcon, PageHeader, StatusBadge, Stepper, Tabs } from "../../design-system";
import type { StepperStep } from "../../design-system";
import { SelectField, TextField } from "../../components/forms/LegacyFields";
import { PartnerQuickSearch } from "../../components/forms/PartnerQuickSearch";
import { Feedback } from "../../components/feedback/Feedback";
import { AdminBlock, FormGrid } from "../../components/layout/SectionPrimitives";
import { useAutoScroll } from "../../hooks/useAutoScroll";
import { requestDecision, requestTextInput } from "../../utils/dialogs";
import { parseNfeExtractedPreview, resolveOwnAndCounterparty } from "./xmlPreview";
import { formatOperationScope, OPERATION_SCOPE_OPTIONS } from "../../../shared/utils/operationLabels";
import { formatProductUnit } from "../../../shared/utils/productLabels";
import { formatStatusLabel } from "../../../shared/utils/statusLabels";

function decimalTextBr(value: string | null): string {
  return value ? value.replace(".", ",") : "-";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function normalizeMatchText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

export function OperationsPage({ data }: { data: BootstrapData }): JSX.Element {
  const organizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "";
  const ownLegalEntityId = data.profile?.defaultLegalEntityId ?? data.legalEntities.find((item) => item.organizationId === organizationId)?.id ?? "";
  const ownLegalEntity = data.legalEntities.find((item) => item.id === ownLegalEntityId) ?? null;
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [partnerLegalEntities, setPartnerLegalEntities] = useState<BusinessPartnerLegalEntity[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [documents, setDocuments] = useState<FiscalDocument[]>([]);
  const [documentServiceInfo, setDocumentServiceInfo] = useState<Record<string, { sacks: string; rateCents: number | null; serviceCents: number; missingRate: boolean }>>({});
  const [detail, setDetail] = useState<FiscalDocumentDetail | null>(null);
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
  const [pageTab, setPageTab] = useState<"documents" | "spreadsheets" | "xml">("xml");
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
  const [xmlSelectionSource, setXmlSelectionSource] = useState<"FILE" | "MULTIPLE_FILES" | "FOLDER" | "DRAG_DROP">("FILE");
  const [xmlResolutionSelections, setXmlResolutionSelections] = useState<Record<string, string>>({});
  const [selectedXmlToken, setSelectedXmlToken] = useState<string | null>(null);
  const scrollTo = useAutoScroll();
  const manualDetailRef = useRef<HTMLDivElement | null>(null);
  const spreadsheetResultRef = useRef<HTMLDivElement | null>(null);
  const spreadsheetHistoryRef = useRef<HTMLDivElement | null>(null);
  const xmlDataRef = useRef<HTMLDivElement | null>(null);
  const xmlResultRef = useRef<HTMLDivElement | null>(null);
  const xmlHistoryRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const clientPartners = await window.operationsCafe.listBusinessPartners({ role: "CLIENT", status: "active" });
    setPartners(clientPartners);
    setPartnerLegalEntities((await Promise.all(clientPartners.map((partner) => window.operationsCafe.listPartnerLegalEntities(partner.id)))).flat());
    setPartnerId((current) => current || clientPartners[0]?.id || "");
    const activeProducts = await window.operationsCafe.listProducts({ organizationId, status: "active" });
    setProducts(activeProducts);
    setProductId((current) => current || activeProducts[0]?.id || "");
    const fiscalDocuments = await window.operationsCafe.listFiscalDocuments({ organizationId, ownLegalEntityId, status: "all" });
    setDocuments(fiscalDocuments);
    const details = await Promise.all(fiscalDocuments.map((doc) => window.operationsCafe.getFiscalDocument(doc.id)));
    setDocumentServiceInfo(Object.fromEntries(details.map((docDetail) => {
      const sacks = docDetail.operations.map((op) => op.quantitySacks).reduce((total, value) => String(Number(total) + Number(value)), "0");
      const rateValues = Array.from(new Set(docDetail.operations.map((op) => op.appliedRateValueCents)));
      return [docDetail.document.id, {
        sacks,
        rateCents: rateValues.length === 1 ? rateValues[0] : null,
        serviceCents: docDetail.operations.reduce((total, op) => total + op.serviceAmountCents, 0),
        missingRate: docDetail.operations.some((op) => op.appliedRateValueCents === 0)
      }];
    })));
    setImportHistory(await window.operationsCafe.listSpreadsheetImportJobs(organizationId));
    setXmlHistory(await window.operationsCafe.listXmlImportJobs(organizationId));
  }, [organizationId, ownLegalEntityId]);

  useEffect(() => { void load(); }, [load]);

  const parseCurrency = (value: string): number => parseCurrencyToCents(value);

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
      scrollTo(manualDetailRef);
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
      scrollTo(manualDetailRef);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao adicionar operacao."}`);
    }
  }

  async function overrideFirstOperation(): Promise<void> {
    if (!detail?.operations[0]) return;
    const newValue = await requestTextInput({ title: "Alterar valor do serviço", label: "Novo valor por saca (R$)" });
    if (!newValue) return;
    const manualRateValueCents = parseCurrency(newValue);
    if (!Number.isFinite(manualRateValueCents) || manualRateValueCents < 0) {
      setMessage("Erro: valor por saca invalido.");
      return;
    }
    const reason = await requestTextInput({ title: "Alterar valor do serviço", label: "Motivo da alteração manual do valor por saca" });
    if (!reason) return;
    await window.operationsCafe.updateOperationManualRate(detail.operations[0].id, manualRateValueCents, reason);
    setDetail(await window.operationsCafe.getFiscalDocument(detail.document.id));
    setMessage(`Valor por saca alterado manualmente para ${formatCurrencyFromCents(manualRateValueCents)}.`);
  }

  async function deleteDocument(document: FiscalDocument): Promise<void> {
    const confirmed = await requestDecision({
      title: "Excluir nota definitivamente",
      message: `Deseja excluir a nota ${document.documentNumber}? Itens e operacoes vinculados a ela tambem serao removidos.`
    });
    if (!confirmed) return;
    const xmlJobIdToRefresh = xmlJob?.files.some((file) => file.fiscalDocumentId === document.id) ? xmlJob.job.id : null;
    try {
      await window.operationsCafe.deleteFiscalDocument(document.id);
      setDetail((current) => current?.document.id === document.id ? null : current);
      setXmlJob((current) => current ? { ...current, files: current.files.map((file) => file.fiscalDocumentId === document.id ? { ...file, fiscalDocumentId: null, status: "REVERTED" } : file) } : current);
      setMessage("Nota excluida definitivamente.");
      await load();
      if (xmlJobIdToRefresh) setXmlJob(await window.operationsCafe.getXmlImportJob(xmlJobIdToRefresh));
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao excluir nota."}`);
    }
  }

  async function deleteCurrentDocument(): Promise<void> {
    if (!detail) return;
    await deleteDocument(detail.document);
  }

  async function selectSpreadsheet(): Promise<void> {
    try {
      const selected = await window.operationsCafe.selectSpreadsheetFile();
      if (!selected) return;
    setWorkbook(selected);
    setSelectedSheet(selected.sheets[0]?.name ?? "");
    setMessage("Planilha selecionada.");
    scrollTo(spreadsheetResultRef);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao selecionar planilha."}`);
    }
  }

  async function previewSpreadsheet(): Promise<void> {
    if (!workbook || !selectedSheet) return;
    const sheetPreview = await window.operationsCafe.previewSpreadsheetSheet({ token: workbook.token, sheetName: selectedSheet, headerRow: Number(headerRow) });
    setPreview(sheetPreview);
    setMessage("Previa carregada.");
    scrollTo(spreadsheetResultRef);
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
    scrollTo(spreadsheetResultRef);
  }

  async function executeSpreadsheet(): Promise<void> {
    if (!importJob) return;
    const executed = await window.operationsCafe.executeSpreadsheetImport({ jobId: importJob.job.id, token: workbook?.token, importWarnings: true });
    setImportJob(executed);
    setMessage(`Importacao processada: ${executed.job.importedRows} de ${executed.job.totalRows} linha(s) importada(s).`);
    await load();
    scrollTo(spreadsheetHistoryRef);
  }

  async function prepareXmlImport(source: "single" | "multiple" | "folder"): Promise<void> {
    try {
      const selected =
        source === "single"
          ? await window.operationsCafe.selectXmlFile()
          : source === "multiple"
            ? await window.operationsCafe.selectXmlFiles()
            : (await window.operationsCafe.selectXmlFolder(includeXmlSubfolders)).files;
      await inspectSelectedXmlFiles(selected, source === "folder" ? "FOLDER" : selected.length === 1 ? "FILE" : "MULTIPLE_FILES");
    } catch (errorValue) {
      setMessage(`Erro XML: ${errorValue instanceof Error ? errorValue.message : "falha ao selecionar XML."}`);
    }
  }

  async function prepareDroppedXmlImport(files: File[]): Promise<void> {
    try {
      const paths = window.operationsCafe.getDroppedFilePaths(files);
      const xmlPaths = paths.filter((path) => path.toLowerCase().endsWith(".xml"));
      if (xmlPaths.length === 0) {
        setMessage(paths.length === 0 ? "Nao foi possivel ler o arquivo arrastado. Tente arrastar o arquivo direto do Explorador do Windows." : "Arraste somente arquivos XML da NF-e para importar.");
        return;
      }
      const selected = await window.operationsCafe.registerDroppedXmlFiles(xmlPaths);
      await inspectSelectedXmlFiles(selected, "DRAG_DROP");
    } catch (errorValue) {
      setMessage(`Erro XML: ${errorValue instanceof Error ? errorValue.message : "falha ao receber arquivos arrastados."}`);
    }
  }

  async function inspectSelectedXmlFiles(
    selected: Array<{ token: string; fileName: string; sizeBytes: number }>,
    sourceType: "FILE" | "MULTIPLE_FILES" | "FOLDER" | "DRAG_DROP"
  ): Promise<void> {
    if (selected.length === 0) return;
    const inspections = await window.operationsCafe.inspectXmlFiles(selected.map((file) => file.token));
    const invalidCount = inspections.filter((file) => file.status === "ERROR").length;
    setXmlSelectionSource(sourceType);
    setXmlSelections(selected);
    setXmlQueue(inspections);
    setXmlJob(null);
    setSelectedXmlToken(inspections.find((file) => file.status !== "ERROR")?.token ?? inspections[0]?.token ?? null);
    setMessage(
      invalidCount
        ? `${inspections.length} XML(s) inspecionado(s). ${invalidCount} arquivo(s) com erro.`
        : `${inspections.length} XML(s) inspecionado(s).`
    );
    scrollTo(xmlDataRef);
  }

  async function validateXmlImport(): Promise<void> {
    if (xmlSelections.length === 0) return;
    try {
      const job = await window.operationsCafe.createXmlImportDraft({
        organizationId,
        sourceType: xmlSelectionSource,
        selectedFolder: null,
        includeSubfolders: includeXmlSubfolders,
        settings: { clientPartnerId: partnerId || null, operationType, operationScope: scope, productId: productId || null, createOperations: true }
      });
      const added = await window.operationsCafe.addXmlImportFiles({ jobId: job.id, tokens: xmlSelections.map((file) => file.token) });
      const validated = await window.operationsCafe.validateXmlImportJob(added.job.id);
      setXmlJob(validated);
      setMessage("Fila XML validada.");
      await load();
      scrollTo(xmlResultRef);
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
      scrollTo(xmlHistoryRef);
    } catch (errorValue) {
      setMessage(`Erro XML: ${errorValue instanceof Error ? errorValue.message : "falha ao importar XML."}`);
    }
  }

  function xmlFileParty(file: XmlImportFile): { issuer: { legalName: string | null; tradeName: string | null; cnpjCpf: string | null } | null; recipient: { legalName: string | null; tradeName: string | null; cnpjCpf: string | null } | null } {
    if (!file.extractedDataJson) return { issuer: null, recipient: null };
    try {
      const extracted = JSON.parse(file.extractedDataJson) as { issuer?: { legalName: string | null; tradeName: string | null; cnpjCpf: string | null }; recipient?: { legalName: string | null; tradeName: string | null; cnpjCpf: string | null } };
      return { issuer: extracted.issuer ?? null, recipient: extracted.recipient ?? null };
    } catch {
      return { issuer: null, recipient: null };
    }
  }

  function xmlFileCounterparty(file: XmlImportFile): { legalName: string | null; tradeName: string | null; cnpjCpf: string | null } | null {
    const { issuer, recipient } = xmlFileParty(file);
    return operationType === "SALE" ? recipient : issuer;
  }

  function xmlFileStatusLabel(file: XmlImportFile): string | undefined {
    return file.status === "REVERTED" && !file.fiscalDocumentId ? "Excluida" : undefined;
  }

  function xmlFileDetailMessage(file: XmlImportFile): string {
    if (file.status === "REVERTED" && !file.fiscalDocumentId) return "Nota excluida; este XML ficou apenas no historico.";
    return file.errorMessage ?? (file.warningCodesJson && file.warningCodesJson !== "[]" ? file.warningCodesJson : "Processado sem erro");
  }

  async function saveXmlFileResolution(fileId: string): Promise<void> {
    const clientPartnerId = xmlResolutionSelections[fileId];
    if (!clientPartnerId) return;
    try {
      await window.operationsCafe.updateXmlImportFileResolution(fileId, { clientPartnerId });
      if (xmlJob) setXmlJob(await window.operationsCafe.getXmlImportJob(xmlJob.job.id));
      setMessage("Cliente associado. Clique em \"Importar XMLs\" novamente para reprocessar.");
    } catch (errorValue) {
      setMessage(`Erro XML: ${errorValue instanceof Error ? errorValue.message : "falha ao salvar resolucao."}`);
    }
  }

  async function saveXmlFileResolutionAndRegister(file: XmlImportFile): Promise<void> {
    const clientPartnerId = xmlResolutionSelections[file.id];
    if (!clientPartnerId) return;
    try {
      const counterparty = xmlFileCounterparty(file);
      const cnpjDigits = (counterparty?.cnpjCpf ? onlyDigits(counterparty.cnpjCpf) : null) ?? "";
      if (cnpjDigits.length === 14) {
        await window.operationsCafe.createPartnerLegalEntity({
          businessPartnerId: clientPartnerId,
          legalName: counterparty?.legalName ?? counterparty?.tradeName ?? "Nao informado",
          tradeName: counterparty?.tradeName ?? counterparty?.legalName ?? "Nao informado",
          cnpj: cnpjDigits,
          stateRegistration: null,
          municipalRegistration: null,
          email: null,
          phone: null,
          addressLine: null,
          addressNumber: null,
          addressComplement: null,
          district: null,
          city: null,
          state: null,
          postalCode: null,
          isPrimary: false,
          isActive: true,
          isDraft: false
        });
      } else if (counterparty?.tradeName || counterparty?.legalName) {
        await window.operationsCafe.createPartnerAlias({
          organizationId,
          businessPartnerId: clientPartnerId,
          partnerLegalEntityId: null,
          alias: counterparty.tradeName ?? counterparty.legalName ?? "",
          source: "XML_IMPORT",
          isActive: true
        });
      }
      await saveXmlFileResolution(file.id);
      setMessage("Cliente associado e CNPJ/apelido cadastrado. Proximas notas desse contraparte serao reconhecidas automaticamente.");
    } catch (errorValue) {
      setMessage(`Erro XML: ${errorValue instanceof Error ? errorValue.message : "falha ao cadastrar CNPJ/alias."}`);
    }
  }

  const selectedXmlFile = xmlQueue.find((file) => file.token === selectedXmlToken) ?? xmlQueue[0] ?? null;
  const selectedXmlPreview = parseNfeExtractedPreview(selectedXmlFile?.extractedData ?? null);
  const selectedXmlParties = resolveOwnAndCounterparty(selectedXmlPreview, data.legalEntities);
  const selectedXmlItem = selectedXmlPreview?.items[0] ?? null;
  const selectedXmlOwnMismatch = Boolean(
    selectedXmlParties.ownEntityLabel &&
    ownLegalEntity &&
    selectedXmlParties.ownEntityLabel !== ownLegalEntity.tradeName
  );
  const hasValidXmlSelection = xmlQueue.some((file) => file.status !== "ERROR");

  useEffect(() => {
    if (!selectedXmlFile || !selectedXmlParties.counterpartyLabel) return;
    const counterpartyCnpj = selectedXmlParties.counterpartyCnpj ? onlyDigits(selectedXmlParties.counterpartyCnpj) : null;
    const byCnpj = counterpartyCnpj
      ? partnerLegalEntities.find((entity) => entity.cnpj && onlyDigits(entity.cnpj) === counterpartyCnpj)
      : null;
    const byName = !byCnpj
      ? partners.find((partner) => {
          const counterpartyName = normalizeMatchText(selectedXmlParties.counterpartyLabel);
          const partnerName = normalizeMatchText(partner.displayName);
          if (!counterpartyName || !partnerName) return false;
          return counterpartyName === partnerName || counterpartyName.includes(partnerName) || partnerName.includes(counterpartyName);
        })
      : null;
    const matchedPartnerId = byCnpj?.businessPartnerId ?? byName?.id ?? "";
    if (matchedPartnerId && matchedPartnerId !== partnerId) {
      setPartnerId(matchedPartnerId);
      setMessage(`Cliente reconhecido automaticamente: ${partners.find((partner) => partner.id === matchedPartnerId)?.displayName ?? selectedXmlParties.counterpartyLabel}.`);
    }
  }, [partnerId, partnerLegalEntities, partners, selectedXmlFile, selectedXmlParties.counterpartyCnpj, selectedXmlParties.counterpartyLabel]);

  const xmlJobStatus = xmlJob?.job.status;
  const xmlImportSteps: StepperStep[] = [
    { id: "import", label: "Importar arquivo", status: xmlQueue.length > 0 ? "complete" : "current" },
    { id: "read", label: "Leitura automatica", status: xmlQueue.length > 0 ? "complete" : "pending" },
    { id: "rule", label: "Aplicar regra", status: xmlJob ? "complete" : xmlQueue.length > 0 ? "current" : "pending" },
    {
      id: "save",
      label: "Salvar nota",
      status:
        xmlJobStatus === "COMPLETED" || xmlJobStatus === "COMPLETED_WITH_ERRORS"
          ? "complete"
          : xmlJob
            ? "current"
            : "pending"
    }
  ];
  const visibleServiceCents = Object.values(documentServiceInfo).reduce((sum, item) => sum + item.serviceCents, 0);
  const detailMainItem = detail?.items[0] ?? null;
  const detailMainOperation = detail?.operations[0] ?? null;
  const operationTypeLabel = detailMainOperation?.operationType === "PURCHASE" ? "Compra" : detailMainOperation?.operationType === "SALE" ? "Venda" : "-";
  const operationScopeLabel = formatOperationScope(detailMainOperation?.operationScope);

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
        active={pageTab}
        items={[
          { id: "xml", label: "XML NF-e" },
          { id: "documents", label: "Notas fiscais" },
          { id: "spreadsheets", label: "Planilhas" }
        ]}
        onChange={setPageTab}
      />
      {pageTab === "documents" && <>
      <AdminBlock title="Notas e operacoes manuais">
        <div className="operation-context-note">
          <span>CNPJ ativo para notas</span>
          <strong>{ownLegalEntity?.tradeName ?? "Nao selecionado"}</strong>
          <small>{ownLegalEntity?.cnpj ?? "CNPJ pendente"} - a lista abaixo mostra somente notas desse CNPJ.</small>
        </div>
        <div className="cards">
          <article><span>Notas deste CNPJ</span><strong>{documents.length}</strong></article>
          <article><span>Pendencias</span><strong>{documents.filter((doc) => doc.status === "PENDING" || doc.hasPendingIssues).length}</strong></article>
          <article><span>Servico calculado</span><strong>{formatCurrencyFromCents(visibleServiceCents)}</strong></article>
        </div>
        <FormGrid>
          <PartnerQuickSearch label="Cliente responsavel" value={partnerId} onChange={setPartnerId} partners={partners} legalEntities={partnerLegalEntities} />
          <TextField label="Numero da nota" value={number} onChange={setNumber} />
          <TextField label="Chave de acesso" value={accessKey} onChange={setAccessKey} />
          <TextField label="Valor total" value={total} onChange={setTotal} />
          <button className="primary" onClick={() => void createDocument()}>Criar nota</button>
        </FormGrid>
        <div className="table"><div className="table-head invoice-grid"><span>Numero</span><span>Cliente</span><span>Emissao</span><span>Status</span><span>Valor NF</span><span>Servico</span><span>Alerta</span><span>Acoes</span></div>{documents.map((doc) => {
          const info = documentServiceInfo[doc.id];
          const serviceLabel = info ? `${formatCurrencyFromCents(info.serviceCents)}${info.rateCents !== null ? ` (${formatCurrencyFromCents(info.rateCents)}/saca)` : ""}` : "-";
          return <div key={doc.id} className="table-row invoice-grid"><span>{doc.documentNumber}</span><span>{partners.find((partner) => partner.id === doc.responsiblePartnerId)?.displayName ?? doc.responsiblePartnerId}</span><span>{formatDateOnlyBr(doc.issueDate)}</span><span><StatusBadge status={doc.status} /></span><span>{formatCurrencyFromCents(doc.totalAmountCents)}</span><span>{serviceLabel}</span><span>{info?.missingRate ? "Sem valor por saca" : doc.duplicateWarning ?? "-"}</span><span className="row-actions"><button onClick={() => window.operationsCafe.getFiscalDocument(doc.id).then(setDetail)}>Abrir</button><button className="danger" onClick={() => void deleteDocument(doc)}>Excluir</button></span></div>;
        })}</div>
      </AdminBlock>
      {detail ? <div ref={manualDetailRef}><AdminBlock title={`Detalhe da nota ${detail.document.documentNumber}`}>
        <div className="invoice-detail-layout">
          <section className="invoice-action-card invoice-action-card--wide">
            <header><span>{detail.items.length ? "Dados da nota" : "Adicionar item"}</span><strong>{detail.items.length ? "Preenchido pelo XML/regra" : "Produto e classificacao fiscal"}</strong></header>
            {detailMainItem || detailMainOperation ? (
              <div className="invoice-auto-summary">
                <div><span>Produto</span><strong>{detailMainItem?.description ?? products.find((product) => product.id === detailMainOperation?.productId)?.name ?? "-"}</strong></div>
                <div><span>Quantidade</span><strong>{detailMainItem ? `${detailMainItem.quantity} ${formatProductUnit(detailMainItem.unit)}` : "-"}</strong></div>
                <div><span>Preco comercial</span><strong>{detailMainItem ? decimalTextBr(detailMainItem.unitPriceDecimal) : "-"}</strong></div>
                <div><span>Sacas</span><strong>{detailMainOperation?.quantitySacks ?? detailMainItem?.sacksQuantity ?? "-"}</strong></div>
                <div><span>UF da venda</span><strong>{operationTypeLabel} / {operationScopeLabel}</strong></div>
                <div><span>Servico calculado</span><strong>{detailMainOperation ? `${formatCurrencyFromCents(detailMainOperation.serviceAmountCents)} (${formatCurrencyFromCents(detailMainOperation.appliedRateValueCents)}/saca)` : "-"}</strong></div>
              </div>
            ) : null}
            {detail.items.length ? <p className="muted">Os campos abaixo servem apenas para adicionar outro item/operacao manualmente nesta nota.</p> : null}
            <FormGrid>
              <SelectField label="Produto" value={productId} onChange={setProductId} options={products.map((item) => [item.id, item.name])} />
              <SelectField label="Compra/venda" value={operationType} onChange={(value) => setOperationType(value as "PURCHASE" | "SALE")} options={[["PURCHASE", "Compra"], ["SALE", "Venda"]]} />
              <SelectField label="UF da venda" value={scope} onChange={(value) => setScope(value as OperationScope)} options={OPERATION_SCOPE_OPTIONS} />
              <TextField label="Quantidade" value={quantity} onChange={setQuantity} />
              <TextField label="Preco unitario comercial" value={unitPrice} onChange={setUnitPrice} />
              <TextField label="Sacas" value={sacks} onChange={setSacks} />
            </FormGrid>
            <button className="invoice-action-button invoice-action-button--primary" onClick={() => void addItemAndOperation()}>Adicionar item e operacao</button>
          </section>
          <section className="invoice-action-card">
            <header><span>Servico</span><strong>Valor por saca</strong></header>
            <p className="muted">Altera manualmente a primeira operacao da nota e exige motivo.</p>
            <button className="invoice-action-button" disabled={!detail.operations.length} onClick={() => void overrideFirstOperation()}>Alterar valor da primeira operacao</button>
          </section>
          <section className="invoice-action-card">
            <header><span>Status</span><strong>Controle da nota</strong></header>
            <p className="muted">Confirme para liberar cobranca ou cancele quando a nota deve permanecer no historico.</p>
            <div className="invoice-action-row">
              <button className="invoice-action-button invoice-action-button--primary" disabled={detail.document.status === "CONFIRMED" || detail.document.status === "CANCELED"} onClick={() => window.operationsCafe.confirmFiscalDocument(detail.document.id).then((updated) => { setDetail(updated); void load(); }).catch((errorValue: unknown) => setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao confirmar."}`))}>Confirmar nota</button>
              <button className="invoice-action-button" disabled={detail.document.status === "CANCELED"} onClick={() => { void requestTextInput({ title: "Cancelar nota", label: "Motivo do cancelamento" }).then((reason) => { if (reason) void window.operationsCafe.cancelFiscalDocument(detail.document.id, reason).then((updated) => { setDetail(updated); void load(); }); }); }}>Cancelar nota</button>
              <button className="invoice-action-button invoice-action-button--danger" onClick={() => void deleteCurrentDocument()}>Excluir nota</button>
            </div>
          </section>
        </div>
        <div className="cards">
          <article><span>Itens</span><strong>{detail.items.map((item) => `${item.description}: ${item.quantity} ${formatProductUnit(item.unit)}`).join(" | ") || "Nenhum"}</strong></article>
          <article><span>Operacoes</span><strong>{detail.operations.map((op) => `${op.operationType}/${formatOperationScope(op.operationScope)}: ${op.quantitySacks} sacas - ${formatCurrencyFromCents(op.serviceAmountCents)}`).join(" | ") || "Nenhuma"}</strong></article>
          <article><span>Status</span><strong>{formatStatusLabel(detail.document.status)}</strong></article>
        </div>
      </AdminBlock></div> : null}
      </>}
      {pageTab === "spreadsheets" && <>
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
        <div ref={spreadsheetResultRef}>
          {preview ? <div className="table"><div className="table-head import-grid"><span>Campo</span><span>Coluna sugerida</span></div>{Object.entries(preview.suggestedMapping).map(([field, column]) => <div key={field} className="table-row import-grid"><span>{field}</span><span>{column}</span></div>)}</div> : null}
          {importJob ? <div className="cards"><article><span>Total</span><strong>{importJob.job.totalRows}</strong></article><article><span>Validas</span><strong>{importJob.job.validRows}</strong></article><article><span>Avisos</span><strong>{importJob.job.warningRows}</strong></article><article><span>Duplicadas</span><strong>{importJob.job.duplicateRows}</strong></article><article><span>Erros</span><strong>{importJob.job.errorRows}</strong></article><article><span>Importadas</span><strong>{importJob.job.importedRows}</strong></article></div> : null}
        </div>
      </AdminBlock>
      <div ref={spreadsheetHistoryRef}><AdminBlock title="Historico de importacoes">
        <div className="table"><div className="table-head import-history-grid"><span>Arquivo</span><span>Aba</span><span>Status</span><span>Linhas</span><span>Importadas</span><span>Acoes</span></div>{importHistory.map((job) => <div key={job.id} className="table-row import-history-grid"><span>{job.originalFileName}</span><span>{job.selectedSheetName}</span><span><StatusBadge status={job.status} /></span><span>{job.totalRows}</span><span>{job.importedRows}</span><span><button onClick={() => window.operationsCafe.getSpreadsheetImportJob(job.id).then(setImportJob)}>Detalhar</button><button onClick={() => { void requestTextInput({ title: "Reverter importação", label: "Motivo da reversão" }).then((reason) => { if (reason) void window.operationsCafe.revertSpreadsheetImportJob(job.id, reason).then(setImportJob).then(() => load()); }); }}>Reverter</button></span></div>)}</div>
      </AdminBlock></div>
      </>}
      {pageTab === "xml" && <>
      <AdminBlock title="Importacao automatica de NF-e">
        <p className="muted">Leitura de XML e captura automatica dos dados.</p>
        <div className="import-columns">
          <div className="import-column" ref={xmlDataRef}>
            <h3>Importar NF-e</h3>
            <FileDropzone
              title="Arraste XMLs aqui ou selecione os arquivos"
              description="Solte um ou mais XMLs da NF-e nesta area para inspecionar automaticamente."
              dropHint="Tambem e possivel usar os botoes abaixo para escolher arquivo, varios XMLs ou uma pasta inteira."
              onDropFiles={(files) => void prepareDroppedXmlImport(files)}
              actions={
                <>
                  <button onClick={() => void prepareXmlImport("single")}>Selecionar XML</button>
                  <button onClick={() => void prepareXmlImport("multiple")}>Selecionar varios XMLs</button>
                  <button onClick={() => void prepareXmlImport("folder")}>Selecionar pasta</button>
                </>
              }
            />
            <label className="inline-check"><input type="checkbox" checked={includeXmlSubfolders} onChange={(event) => setIncludeXmlSubfolders(event.target.checked)} /> Incluir subpastas</label>
            {xmlQueue.length ? (
              <ul className="xml-queue-list">
                {xmlQueue.map((file) => (
                  <li key={file.token}>
                    <button type="button" className={file.token === selectedXmlFile?.token ? "active" : ""} onClick={() => setSelectedXmlToken(file.token)}>
                      <span>{file.originalFileName}</span>
                      <StatusBadge status={file.status} />
                      <small>{formatFileSize(file.fileSize)}{file.errorMessage ? ` - ${file.errorMessage}` : file.accessKey ? ` - chave ${file.accessKey}` : ""}</small>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nenhum arquivo selecionado" description="Selecione um ou mais XMLs de NF-e para comecar." />
            )}
            <div className="toolbar">
              <button onClick={() => void validateXmlImport()} disabled={xmlQueue.length === 0 || !hasValidXmlSelection}>Validar fila</button>
            </div>
          </div>

          <div className="import-column">
            <h3>Dados extraidos</h3>
            {selectedXmlPreview ? (
              <>
                {selectedXmlOwnMismatch ? (
                  <div className="operation-warning-card">
                    <strong>Atencao: XML de outro CNPJ</strong>
                    <span>O XML parece ser de {selectedXmlParties.ownEntityLabel}, mas o topo esta operando em {ownLegalEntity?.tradeName}. Troque o CNPJ ativo antes de salvar a nota.</span>
                  </div>
                ) : null}
                <dl className="kv-list">
                  <div><dt>Empresa</dt><dd>{selectedXmlParties.ownEntityLabel ?? "Nao identificada"}</dd></div>
                  <div><dt>Cliente</dt><dd>{selectedXmlParties.counterpartyLabel ?? "Nao identificado"}</dd></div>
                  <div><dt>Produto</dt><dd>{selectedXmlItem?.description ?? "-"}</dd></div>
                  <div><dt>Quantidade</dt><dd>{decimalTextBr(selectedXmlItem?.commercialQuantity ?? null)} sacas</dd></div>
                  <div><dt>R$/saca</dt><dd>{selectedXmlItem?.commercialUnitValue ? formatCurrencyFromCents(Math.round(Number(selectedXmlItem.commercialUnitValue) * 100)) : "-"}</dd></div>
                  <div><dt>Valor total</dt><dd>{selectedXmlPreview.productsAmountCents != null ? formatCurrencyFromCents(selectedXmlPreview.productsAmountCents) : "-"}</dd></div>
                </dl>
                <h4>Informacoes complementares</h4>
                <dl className="kv-list">
                  <div><dt>Chave da NF-e</dt><dd>{selectedXmlPreview.accessKey ?? "-"}</dd></div>
                  <div><dt>Emissao</dt><dd>{selectedXmlPreview.issuedAt ? formatDateBr(selectedXmlPreview.issuedAt) : "-"}</dd></div>
                  <div><dt>Numero/Serie</dt><dd>{selectedXmlPreview.number ?? "-"}/{selectedXmlPreview.series ?? "-"}</dd></div>
                  <div><dt>Modelo</dt><dd>{selectedXmlPreview.model ?? "-"}</dd></div>
                  <div><dt>Natureza da operacao</dt><dd>{selectedXmlPreview.nature ?? "-"}</dd></div>
                  <div><dt>Transportadora</dt><dd>{selectedXmlPreview.transportCarrierName ?? "-"}</dd></div>
                </dl>
              </>
            ) : selectedXmlFile?.status === "ERROR" ? (
              <EmptyState title="XML nao lido" description={selectedXmlFile.errorMessage ?? "O arquivo selecionado nao pode ser lido. Confira se ele nao esta vazio ou corrompido."} />
            ) : (
              <EmptyState title="Sem dados ainda" description="Selecione um arquivo na lista ao lado para ver os dados extraidos automaticamente." />
            )}
          </div>

          <div className="import-column">
            <h3><ListStepsIcon /> Fluxo de importacao</h3>
            <Stepper activeId={xmlImportSteps.find((step) => step.status === "current")?.id ?? "save"} steps={xmlImportSteps} />
            <FormGrid>
              <PartnerQuickSearch label="Cliente padrao (usado so se o CNPJ/nome do contraparte nao for reconhecido)" value={partnerId} onChange={setPartnerId} partners={partners} legalEntities={partnerLegalEntities} />
              <SelectField label="Compra/venda" value={operationType} onChange={(value) => setOperationType(value as "PURCHASE" | "SALE")} options={[["PURCHASE", "Compra"], ["SALE", "Venda"]]} />
              <SelectField label="UF da venda" value={scope} onChange={(value) => setScope(value as OperationScope)} options={OPERATION_SCOPE_OPTIONS} />
            </FormGrid>
            <div className="toolbar">
              <button onClick={() => { setXmlSelections([]); setXmlQueue([]); setXmlJob(null); setSelectedXmlToken(null); }} disabled={xmlQueue.length === 0}>Cancelar importacao</button>
              <button className="primary" onClick={() => void executeXmlImport()} disabled={!xmlJob}>Salvar nota</button>
            </div>
          </div>
        </div>
        <div ref={xmlResultRef}>
        {xmlJob ? <div className="cards"><article><span>Arquivos</span><strong>{xmlJob.job.totalFiles}</strong></article><article><span>Validos</span><strong>{xmlJob.job.validFiles}</strong></article><article><span>Eventos</span><strong>{xmlJob.job.importedEvents}</strong></article><article><span>Notas</span><strong>{xmlJob.job.importedNotes}</strong></article><article><span>Erros</span><strong>{xmlJob.job.errorFiles}</strong></article></div> : null}
        {xmlJob ? (
          <div className="table">
            <div className="table-head xml-files-grid"><span>Arquivo</span><span>Status</span><span>Tipo</span><span>Chave</span><span>Detalhe</span></div>
            {xmlJob.files.map((file) => (
              <div key={file.id} className="table-row xml-files-grid">
                <span>{file.originalFileName}</span>
                <span><StatusBadge status={file.status} label={xmlFileStatusLabel(file)} /></span>
                <span>{file.xmlType}</span>
                <span>{file.accessKey ?? "-"}</span>
                <span className="row-actions">
                  <span>{xmlFileDetailMessage(file)}</span>
                  {file.fiscalDocumentId ? <button onClick={() => void window.operationsCafe.getFiscalDocument(file.fiscalDocumentId as string).then(setDetail)}>Abrir nota</button> : null}
                  {file.fiscalDocumentId ? <button className="danger" onClick={() => {
                    const doc = documents.find((item) => item.id === file.fiscalDocumentId);
                    if (doc) void deleteDocument(doc);
                    else void window.operationsCafe.getFiscalDocument(file.fiscalDocumentId as string).then((opened) => deleteDocument(opened.document));
                  }}>Excluir nota</button> : null}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        {xmlJob && xmlJob.files.some((file) => file.status === "PENDING_REVIEW") ? (
          <div className="table">
            <div className="table-head xml-resolution-grid"><span>Arquivo</span><span>Status</span><span>Emitente</span><span>Destinatario</span><span>Associar cliente</span><span>Acoes</span></div>
            {xmlJob.files.filter((file) => file.status === "PENDING_REVIEW").map((file) => {
              const { issuer, recipient } = xmlFileParty(file);
              return (
                <div key={file.id} className="table-row xml-resolution-grid">
                  <span>{file.originalFileName}</span>
                  <span>Pendente</span>
                  <span>{issuer?.tradeName ?? issuer?.legalName ?? "-"}</span>
                  <span>{recipient?.tradeName ?? recipient?.legalName ?? "-"}</span>
                  <span>
                    <PartnerQuickSearch label="Cliente" value={xmlResolutionSelections[file.id] ?? ""} onChange={(value) => setXmlResolutionSelections((current) => ({ ...current, [file.id]: value }))} partners={partners} legalEntities={partnerLegalEntities} />
                  </span>
                  <span>
                    <button disabled={!xmlResolutionSelections[file.id]} onClick={() => void saveXmlFileResolution(file.id)}>Salvar</button>
                    <button disabled={!xmlResolutionSelections[file.id]} onClick={() => void saveXmlFileResolutionAndRegister(file)}>Salvar e cadastrar CNPJ/alias</button>
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}
        </div>
      </AdminBlock>
      <div ref={xmlHistoryRef}><AdminBlock title="Historico de XML">
        <div className="table"><div className="table-head xml-history-grid"><span>Data</span><span>Status</span><span>Arquivos</span><span>Notas</span><span>Eventos</span><span>Erros</span><span>Acoes</span></div>{xmlHistory.map((job) => <div key={job.id} className="table-row xml-history-grid"><span>{formatDateBr(job.createdAt)}</span><span><StatusBadge status={job.status} /></span><span>{job.totalFiles}</span><span>{job.importedNotes}</span><span>{job.importedEvents}</span><span>{job.errorFiles}</span><span><button onClick={() => window.operationsCafe.getXmlImportJob(job.id).then(setXmlJob)}>Detalhar</button><button onClick={() => { void requestTextInput({ title: "Reverter XML", label: "Motivo da reversão XML" }).then((reason) => { if (reason) void window.operationsCafe.revertXmlImportJob(job.id, reason).then(setXmlJob).then(() => load()); }); }}>Reverter</button></span></div>)}</div>
      </AdminBlock></div>
      </>}
      <Feedback message={message} />
    </section>
  );
}
