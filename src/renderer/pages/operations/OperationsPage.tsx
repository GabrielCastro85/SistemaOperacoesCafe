import React, { useCallback, useEffect, useRef, useState } from "react";
import type { BootstrapData, BusinessPartner, BusinessPartnerLegalEntity, FiscalDocument, FiscalDocumentDetail, OperationScope, Product, SheetPreview, SpreadsheetImportJob, SpreadsheetImportRow, WorkbookInspection, XmlFileInspection, XmlImportFile, XmlImportJob } from "../../../shared/types/domain";
import { formatCurrencyFromCents, formatDateBr, formatDateOnlyBr, onlyDigits, parseCurrencyToCents } from "../../../shared/utils/format";
import { DateInput, EmptyState, FileDropzone, ListStepsIcon, PageHeader, StatusBadge, Stepper, Tabs } from "../../design-system";
import type { StepperStep } from "../../design-system";
import { SelectField, TextField } from "../../components/forms/LegacyFields";
import { PartnerQuickSearch } from "../../components/forms/PartnerQuickSearch";
import { Feedback } from "../../components/feedback/Feedback";
import { AdminBlock, FormGrid } from "../../components/layout/SectionPrimitives";
import { useAutoScroll } from "../../hooks/useAutoScroll";
import { requestDecision, requestTextInput } from "../../utils/dialogs";
import { parseNfeExtractedPreview, resolveOwnAndCounterparty, type NfeExtractedPreview } from "./xmlPreview";
import { formatOperationScope, OPERATION_SCOPE_OPTIONS } from "../../../shared/utils/operationLabels";
import { formatProductUnit } from "../../../shared/utils/productLabels";
import { formatStatusLabel } from "../../../shared/utils/statusLabels";

function decimalTextBr(value: string | null): string {
  return value ? value.replace(".", ",") : "-";
}

function xmlQuantityInSacks(
  quantity: string | null | undefined,
  unit: string | null | undefined
): string | null {
  if (!quantity) return null;

  const normalizedUnit = unit?.trim().toUpperCase() ?? "";
  const numericQuantity = Number(quantity.replace(",", "."));

  if (!Number.isFinite(numericQuantity)) return quantity;

  if (["KG", "KGS", "KILO", "KILOS", "QUILO", "QUILOS"].includes(normalizedUnit)) {
    const sacks = numericQuantity / 60;
    return sacks.toFixed(6).replace(/\.?0+$/, "");
  }

  return quantity;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function inferXmlOperationScope(preview: NfeExtractedPreview | null): OperationScope | null {
  const issuerState = preview?.issuer?.state?.trim().toUpperCase() ?? "";
  const recipientState = preview?.recipient?.state?.trim().toUpperCase() ?? "";
  if (!issuerState || !recipientState) return null;
  return issuerState === recipientState ? "INTERNAL" : "EXTERNAL";
}

function xmlImportIsVisuallyDeleted(job: XmlImportJob): boolean {
  return job.status === "CANCELLED" || job.status === "REVERTED";
}

function xmlImportFileIsVisuallyDeleted(file: XmlImportFile): boolean {
  return file.status === "REVERTED";
}

type DocumentSortKey = "number" | "client";
type SortDirection = "asc" | "desc";

export function OperationsPage({ data }: { data: BootstrapData }): JSX.Element {
  function brazilDateValue(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Nao foi possivel determinar a data de Brasilia.");
  }

  return `${year}-${month}-${day}`;
}
  const organizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "";
  const ownLegalEntityId = data.profile?.defaultLegalEntityId ?? data.legalEntities.find((item) => item.organizationId === organizationId)?.id ?? "";
  const ownLegalEntity = data.legalEntities.find((item) => item.id === ownLegalEntityId) ?? null;
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [secondaryPartners, setSecondaryPartners] = useState<BusinessPartner[]>([]);
  const [partnerLegalEntities, setPartnerLegalEntities] = useState<BusinessPartnerLegalEntity[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [documents, setDocuments] = useState<FiscalDocument[]>([]);
  const [documentSearch, setDocumentSearch] = useState("");
  const [documentSort, setDocumentSort] = useState<{ key: DocumentSortKey | null; direction: SortDirection }>({
    key: null,
    direction: "asc"
  });
  const [documentServiceInfo, setDocumentServiceInfo] = useState<Record<string, { sacks: string; rateCents: number | null; serviceCents: number; missingRate: boolean }>>({});
  const [detail, setDetail] = useState<FiscalDocumentDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState("");
  const [number, setNumber] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [total, setTotal] = useState("0,00");
  const [issueDate, setIssueDate] = useState(() => brazilDateValue());
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
  const [xmlSecondaryResolutionSelections, setXmlSecondaryResolutionSelections] = useState<Record<string, string>>({});
  const [xmlScopeOverrides, setXmlScopeOverrides] = useState<Record<string, OperationScope>>({});
  const [selectedXmlToken, setSelectedXmlToken] = useState<string | null>(null);
  const [detailSecondaryPartnerId, setDetailSecondaryPartnerId] = useState("");
  const [detailCompanySearchTerm, setDetailCompanySearchTerm] = useState("");
  // Nota terceirizada lancada manualmente: nem emitente nem destinatario e' a
  // empresa propria ativa no topo -- ver resolveIssuerLegalEntityFromPartner.
  // Vazio = comportamento de sempre (emissora = CNPJ proprio ativo).
  const [manualIssuerSearchTerm, setManualIssuerSearchTerm] = useState("");
  const [manualIssuerPartnerLegalEntityId, setManualIssuerPartnerLegalEntityId] = useState<string | null>(null);
  // Cliente da revenda numa nota triangulada lancada manualmente -- so' usado
  // quando manualIssuerPartnerLegalEntityId esta preenchido (ver createDocument).
  const [manualSecondaryPartnerId, setManualSecondaryPartnerId] = useState("");
  const scrollTo = useAutoScroll();
  const manualDetailRef = useRef<HTMLDivElement | null>(null);
  const spreadsheetResultRef = useRef<HTMLDivElement | null>(null);
  const spreadsheetHistoryRef = useRef<HTMLDivElement | null>(null);
  const xmlDataRef = useRef<HTMLDivElement | null>(null);
  const xmlResultRef = useRef<HTMLDivElement | null>(null);
  const xmlHistoryRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const roleForOperationType = operationType === "PURCHASE" ? "SUPPLIER" : "CLIENT";
    // Nota triangulada: o segundo parceiro (a outra perna, compra ou venda)
    // precisa ter o papel OPOSTO ao do parceiro principal selecionado acima.
    const secondaryRole = roleForOperationType === "SUPPLIER" ? "CLIENT" : "SUPPLIER";
    const [rolePartners, oppositeRolePartners] = await Promise.all([
      window.operationsCafe.listBusinessPartners({ role: roleForOperationType, status: "active" }),
      window.operationsCafe.listBusinessPartners({ role: secondaryRole, status: "active" })
    ]);
    setPartners(rolePartners);
    setSecondaryPartners(oppositeRolePartners);
    const searchablePartners = [...rolePartners, ...oppositeRolePartners];
    // Empresas/CNPJs sem cliente/corretor dono (cadastradas direto em
    // "Empresas e CNPJs") nao aparecem percorrendo os parceiros -- precisa
    // buscar as soltas separadamente e juntar, senao elas nunca aparecem nas
    // buscas desta tela (responsavel da nota, empresa da nota, resolucao de
    // XML), mesmo depois de cadastradas (ver mesmo padrao em PartnersPage).
    const [linkedLegalEntities, unlinkedLegalEntities] = await Promise.all([
      Promise.all(searchablePartners.map((partner) => window.operationsCafe.listPartnerLegalEntities(partner.id))),
      organizationId ? window.operationsCafe.listUnlinkedPartnerLegalEntities(organizationId) : Promise.resolve([])
    ]);
    setPartnerLegalEntities([...linkedLegalEntities.flat(), ...unlinkedLegalEntities]);
    setPartnerId((current) => (rolePartners.some((partner) => partner.id === current) ? current : ""));
    const activeProducts = await window.operationsCafe.listProducts({ organizationId, status: "active" });
    setProducts(activeProducts);
    setProductId((current) => current || activeProducts[0]?.id || "");
    const fiscalDocuments = await window.operationsCafe.listFiscalDocuments({ organizationId, ownLegalEntityId, status: "all", includeThirdParty: true });
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
    const xmlJobs = await window.operationsCafe.listXmlImportJobs(organizationId);
    setXmlHistory(xmlJobs.filter((job) => !xmlImportIsVisuallyDeleted(job)));
  }, [organizationId, ownLegalEntityId, operationType]);

  useEffect(() => { void load(); }, [load]);

  const parseCurrency = (value: string): number => parseCurrencyToCents(value);

  async function createDocument(): Promise<void> {
    try {
      // Nota terceirizada: usuario escolheu uma empresa emissora diferente do
      // CNPJ proprio ativo -- resolve (ou cria) o "CNPJ emissor" terceirizado
      // ANTES de criar a nota, e usa ele no lugar do ownLegalEntityId normal.
      let issuerLegalEntityId = ownLegalEntityId;
      let notes: string | null = null;
      // Nota triangulada: nem emitente nem destinatario e' empresa propria --
      // alem do emissor terceirizado, o usuario tambem informou o cliente da
      // revenda (manualSecondaryPartnerId). Grava o parceiro/tipo secundario
      // direto na nota (mesmo campo que XML/completeFiscalDocumentTriangulation
      // usam) para addItemAndOperation criar as duas pernas por item.
      const isTriangulated = Boolean(manualIssuerPartnerLegalEntityId && manualSecondaryPartnerId);
      if (manualIssuerPartnerLegalEntityId) {
        const issuer = await window.operationsCafe.resolveIssuerLegalEntityFromPartner(organizationId, manualIssuerPartnerLegalEntityId);
        issuerLegalEntityId = issuer.id;
        notes = isTriangulated
          ? "Nota triangulada: compra do fornecedor revendida direto ao cliente, sem passar pelas nossas empresas."
          : "Nota terceirizada: entra apenas em cobrancas, nao em fechamento de negocio.";
      }
      const created = await window.operationsCafe.createFiscalDocument({
        organizationId,
        ownLegalEntityId: issuerLegalEntityId,
        responsiblePartnerId: partnerId,
        partnerLegalEntityId: null,
        operationType,
        secondaryResponsiblePartnerId: isTriangulated ? manualSecondaryPartnerId : null,
        secondaryOperationType: isTriangulated ? (operationType === "PURCHASE" ? "SALE" : "PURCHASE") : null,
        accessKey: onlyDigits(accessKey),
        documentNumber: number,
        series: null,
        issueDate,
        totalAmountCents: parseCurrency(total),
        hasPendingIssues: false,
        pendingNotes: null,
        notes
      });
      setDetail(created);
      setMessage(created.document.duplicateWarning ?? (isTriangulated ? "Nota triangulada criada -- cada item lancado abaixo ja gera compra e venda automaticamente." : "Nota criada."));
      setManualIssuerSearchTerm("");
      setManualIssuerPartnerLegalEntityId(null);
      setManualSecondaryPartnerId("");
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
        ownLegalEntityId: detail.document.ownLegalEntityId,
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
      // Nota triangulada: cada item lancado ja ganha a segunda perna (tipo
      // oposto, parceiro secundario) na hora, igual a importacao de XML --
      // diferente de completeFiscalDocumentTriangulation, que so' pode ser
      // chamada uma vez por nota e deixaria itens seguintes com uma perna so'.
      if (detail.document.secondaryResponsiblePartnerId && detail.document.secondaryOperationType) {
        const secondaryLegalEntities = await window.operationsCafe.listPartnerLegalEntities(detail.document.secondaryResponsiblePartnerId);
        const secondaryLegalEntity = secondaryLegalEntities.find((entity) => entity.isPrimary && entity.isActive)
          ?? secondaryLegalEntities.find((entity) => entity.isActive)
          ?? null;
        await window.operationsCafe.addOperation({
          fiscalDocumentId: detail.document.id,
          fiscalDocumentItemId: item.id,
          ownLegalEntityId: detail.document.ownLegalEntityId,
          responsiblePartnerId: detail.document.secondaryResponsiblePartnerId,
          productId: productId || null,
          operationType: detail.document.secondaryOperationType,
          operationScope: scope,
          operationDate: detail.document.issueDate,
          quantitySacks: sacks,
          manualRateValueCents: null,
          manualOverrideReason: null,
          notes: "Segunda perna (nota triangulada) criada manualmente",
          counterpartyPartnerLegalEntityId: secondaryLegalEntity?.id ?? null
        });
      }
      setDetail(await window.operationsCafe.getFiscalDocument(detail.document.id));
      setMessage(detail.document.secondaryResponsiblePartnerId ? "Item e as duas operacoes (compra e venda) adicionados." : "Item e operacao adicionados.");
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
    try {
      await window.operationsCafe.deleteFiscalDocument(document.id);
      setDetail((current) => current?.document.id === document.id ? null : current);
      setXmlJob((current) => {
        if (!current) return current;
        const files = current.files.filter((file) => file.fiscalDocumentId !== document.id);
        return files.length > 0 ? { ...current, files } : null;
      });
      setMessage("Nota excluida definitivamente.");
      await load();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao excluir nota."}`);
    }
  }

  async function deleteCurrentDocument(): Promise<void> {
    if (!detail) return;
    await deleteDocument(detail.document);
  }

  async function openXmlImportJob(jobId: string): Promise<void> {
    try {
      const openedJob = await window.operationsCafe.getXmlImportJob(jobId);
      const visibleFiles = openedJob.files.filter((file) => !xmlImportFileIsVisuallyDeleted(file));
      setXmlJob(xmlImportIsVisuallyDeleted(openedJob.job) || visibleFiles.length === 0 ? null : { ...openedJob, files: visibleFiles });
      setSelectedXmlToken(null);
      setMessage(visibleFiles.length && !xmlImportIsVisuallyDeleted(openedJob.job) ? "Detalhes da importacao XML carregados." : "Importacao XML excluida. Ela nao aparece mais na tela.");
      if (visibleFiles.length && !xmlImportIsVisuallyDeleted(openedJob.job)) scrollTo(xmlResultRef);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao detalhar importacao XML."}`);
    }
  }

  function xmlImportCanBeCancelled(job: XmlImportJob): boolean {
    return ["DRAFT", "INSPECTING", "VALIDATED"].includes(job.status);
  }

  function xmlImportCanBeReverted(job: XmlImportJob): boolean {
    return !["CANCELLED", "REVERTED"].includes(job.status);
  }

  async function removeXmlImportJob(jobId?: string): Promise<void> {
    const id = jobId ?? xmlJob?.job.id;
    if (!id) return;

    try {
      const current = xmlJob?.job.id === id ? xmlJob : await window.operationsCafe.getXmlImportJob(id);
      if (xmlImportCanBeCancelled(current.job) && current.job.importedNotes === 0 && current.job.createdOperations === 0) {
        const confirmed = await requestDecision({
          title: "Excluir importacao XML",
          message: "Esta importacao ainda nao gerou nota fiscal. Deseja cancelar esse registro de importacao?"
        });
        if (!confirmed) return;

        await window.operationsCafe.cancelXmlImportJob(current.job.id);
        setXmlJob(null);
        setSelectedXmlToken(null);
        setMessage("Importacao XML excluida. Nenhuma nota foi criada.");
        await load();
        return;
      }

      const reason = await requestTextInput({ title: "Reverter XML", label: "Motivo da reversao XML" });
      if (!reason) return;
      await window.operationsCafe.revertXmlImportJob(current.job.id, reason);
      setXmlJob(null);
      setSelectedXmlToken(null);
      setMessage("Importacao XML revertida e removida da tela.");
      await load();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao excluir/reverter XML."}`);
    }
  }

  async function completeDetailTriangulation(): Promise<void> {
    if (!detail || !detailSecondaryPartnerId) return;
    try {
      const updated = await window.operationsCafe.completeFiscalDocumentTriangulation(detail.document.id, {
        secondaryResponsiblePartnerId: detailSecondaryPartnerId
      });
      setDetail(updated);
      setDetailSecondaryPartnerId("");
      setMessage("Nota triangulada completada. A segunda perna entrou para a cobrança/acerto do parceiro selecionado.");
      await load();
      scrollTo(manualDetailRef);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao completar nota triangulada."}`);
    }
  }

  // Nota lancada manualmente (sem XML) nunca fica com empresa/CNPJ vinculado
  // -- so' o XML resolve isso sozinho. Sem empresa vinculada a nota nao pode
  // entrar em Confirmacoes (busca por empresa/CNPJ ou por numero da nota),
  // entao aqui deixa vincular depois, a qualquer momento.
  async function linkCompanyToDocument(partnerLegalEntityId: string): Promise<void> {
    if (!detail) return;
    try {
      const updated = await window.operationsCafe.updateFiscalDocument(detail.document.id, {
        organizationId: detail.document.organizationId,
        ownLegalEntityId: detail.document.ownLegalEntityId,
        responsiblePartnerId: detail.document.responsiblePartnerId,
        partnerLegalEntityId,
        operationType: detail.document.direction === "INBOUND" ? "PURCHASE" : "SALE",
        secondaryResponsiblePartnerId: detail.document.secondaryResponsiblePartnerId,
        secondaryOperationType: detail.document.secondaryOperationType,
        accessKey: detail.document.accessKey,
        documentNumber: detail.document.documentNumber,
        series: detail.document.series,
        issueDate: detail.document.issueDate,
        totalAmountCents: detail.document.totalAmountCents,
        hasPendingIssues: detail.document.hasPendingIssues,
        pendingNotes: detail.document.pendingNotes,
        notes: detail.document.notes
      });
      setDetail(updated);
      setDetailCompanySearchTerm("");
      setMessage("Empresa da nota vinculada.");
      await load();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao vincular empresa da nota."}`);
    }
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
      settings: {
        defaultPartnerId: partnerId,
        operationType,
        defaultOperationScope: scope,
        defaultProductId: productId,
        defaultDate: brazilDateValue()
      }
    });
    const validated = await window.operationsCafe.validateSpreadsheetImportRows({
      token: workbook.token,
      jobId: job.id,
      sheetName: selectedSheet,
      headerRow: Number(headerRow),
      mapping: preview.suggestedMapping,
      defaults: {
        defaultPartnerId: partnerId,
        operationType,
        defaultOperationScope: scope,
        defaultProductId: productId,
        defaultDate: brazilDateValue()
      }
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
    setXmlScopeOverrides({});
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
    if (!partnerId) {
      setMessage(operationType === "PURCHASE" ? "Selecione o fornecedor responsavel antes de validar o XML." : "Selecione o cliente/corretor responsavel pela cobranca antes de validar o XML.");
      scrollTo(xmlDataRef);
      return;
    }
    try {
      const job = await window.operationsCafe.createXmlImportDraft({
        organizationId,
        sourceType: xmlSelectionSource,
        selectedFolder: null,
        includeSubfolders: includeXmlSubfolders,
        settings: { ownLegalEntityId, clientPartnerId: partnerId || null, operationType, operationScope: scope, productId: productId || null, createOperations: true }
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
    if (!partnerId) {
      setMessage(operationType === "PURCHASE" ? "Selecione o fornecedor responsavel antes de salvar a nota." : "Selecione o cliente/corretor responsavel pela cobranca antes de salvar a nota.");
      scrollTo(xmlDataRef);
      return;
    }
    try {
      const executed = await window.operationsCafe.executeXmlImportJob({ jobId: xmlJob.job.id, tokens: xmlSelections.map((file) => file.token) });
      setXmlJob(executed);
      const warningCount = executed.job.itemsWithoutOperation;
      setMessage(
        warningCount > 0
          ? `Importacao XML processada. ${warningCount} item(ns) nao geraram operacao (produto ou unidade nao reconhecidos) -- revise a coluna "Alerta" nas notas abaixo.`
          : "Importacao XML processada."
      );
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
    const secondaryPartnerId = xmlSecondaryResolutionSelections[fileId] || null;
    try {
      await window.operationsCafe.updateXmlImportFileResolution(fileId, { clientPartnerId, secondaryPartnerId });
      if (xmlJob) setXmlJob(await window.operationsCafe.getXmlImportJob(xmlJob.job.id));
      setMessage(
        secondaryPartnerId
          ? "Nota triangulada: parceiro principal e secundario associados. Clique em \"Importar XMLs\" novamente para reprocessar."
          : "Cliente/corretor associado. Clique em \"Importar XMLs\" novamente para reprocessar."
      );
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
      setMessage("Cliente/corretor associado e empresa/apelido cadastrado. Proximas notas desse contraparte poderao ser vinculadas a ele.");
    } catch (errorValue) {
      setMessage(`Erro XML: ${errorValue instanceof Error ? errorValue.message : "falha ao cadastrar CNPJ/alias."}`);
    }
  }

  const selectedXmlFile = xmlQueue.find((file) => file.token === selectedXmlToken) ?? xmlQueue[0] ?? null;
  const selectedXmlPreview = parseNfeExtractedPreview(selectedXmlFile?.extractedData ?? null);
  const selectedXmlParties = resolveOwnAndCounterparty(selectedXmlPreview, data.legalEntities);
  const selectedXmlItem = selectedXmlPreview?.items[0] ?? null;
  const selectedXmlSacks = xmlQuantityInSacks(
    selectedXmlItem?.commercialQuantity,
    selectedXmlItem?.commercialUnit
  );
  const selectedXmlInferredScope = inferXmlOperationScope(selectedXmlPreview);
  const selectedXmlScope = selectedXmlFile ? xmlScopeOverrides[selectedXmlFile.token] ?? selectedXmlInferredScope ?? scope : scope;
  const selectedXmlOwnMismatch = Boolean(
    selectedXmlParties.ownEntityLabel &&
    ownLegalEntity &&
    selectedXmlParties.ownEntityLabel !== (ownLegalEntity.legalName || ownLegalEntity.tradeName)
  );
  const hasValidXmlSelection = xmlQueue.some((file) => file.status !== "ERROR");
  const xmlBatchRows = xmlQueue.map((file) => {
    const preview = parseNfeExtractedPreview(file.extractedData ?? null);
    const parties = resolveOwnAndCounterparty(preview, data.legalEntities);
    const firstItem = preview?.items[0] ?? null;
    const inferredScope = inferXmlOperationScope(preview);
    return {
      file,
      preview,
      parties,
      firstItem,
      operationScope: xmlScopeOverrides[file.token] ?? inferredScope ?? scope
    };
  });
  const validXmlBatchRows = xmlBatchRows.filter((row) => row.file.status !== "ERROR");

  const xmlJobStatus = xmlJob?.job.status;
  const visibleXmlJobFiles = xmlJob?.files.filter((file) => !xmlImportFileIsVisuallyDeleted(file)) ?? [];
  const visibleXmlJob = xmlJob && !xmlImportIsVisuallyDeleted(xmlJob.job) && visibleXmlJobFiles.length > 0
    ? { ...xmlJob, files: visibleXmlJobFiles }
    : null;
  const visibleXmlHistory = xmlHistory.filter((job) => !xmlImportIsVisuallyDeleted(job));
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
  // Nota triangulada: a mesma nota gerou uma operacao de compra (fornecedor)
  // e uma de venda (corretor/cliente) a partir da mesma remessa.
  const allKnownPartners = [...partners, ...secondaryPartners];
  const partnerName = (id: string | null | undefined): string => (id ? allKnownPartners.find((partner) => partner.id === id)?.displayName ?? id : "-");
  const isTriangulatedDetail = Boolean(detail?.document.secondaryResponsiblePartnerId);
  const purchaseLeg = detail?.operations.find((op) => op.operationType === "PURCHASE") ?? null;
  const saleLeg = detail?.operations.find((op) => op.operationType === "SALE") ?? null;

  const documentClientName = (document: FiscalDocument): string =>
    partners.find((partner) => partner.id === document.responsiblePartnerId)?.displayName ??
    document.responsiblePartnerId ??
    "";

  function toggleDocumentSort(key: DocumentSortKey): void {
    setDocumentSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc"
    }));
  }

  function documentSortIndicator(key: DocumentSortKey): string {
    if (documentSort.key !== key) return "↕";
    return documentSort.direction === "asc" ? "↑" : "↓";
  }

  const normalizeDocumentSearch = (value: string | null | undefined): string =>
    (value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]/gi, "")
      .toUpperCase();

  const documentMatchesSearch = (document: FiscalDocument): boolean => {
    const term = normalizeDocumentSearch(documentSearch);
    if (!term) return true;

    const clientName = documentClientName(document);
    const ownEntity = data.legalEntities.find((entity) => entity.id === document.ownLegalEntityId);
    const partnerEntity = partnerLegalEntities.find((entity) => entity.id === document.partnerLegalEntityId);

    const searchableValues = [
      document.documentNumber,
      document.series,
      document.accessKey,
      clientName,
      ownEntity?.legalName,
      ownEntity?.tradeName,
      ownEntity?.cnpj,
      partnerEntity?.legalName,
      partnerEntity?.tradeName,
      partnerEntity?.cnpj
    ];

    return searchableValues.some((value) => normalizeDocumentSearch(value).includes(term));
  };

  const filteredDocuments = documents.filter(documentMatchesSearch);

  const sortedDocuments = [...filteredDocuments].sort((left, right) => {
    if (!documentSort.key) return 0;

    let comparison = 0;
    if (documentSort.key === "client") {
      comparison = documentClientName(left).localeCompare(documentClientName(right), "pt-BR", {
        sensitivity: "base",
        numeric: true
      });
    } else {
      const leftNumber = Number(left.documentNumber);
      const rightNumber = Number(right.documentNumber);
      comparison =
        Number.isFinite(leftNumber) && Number.isFinite(rightNumber)
          ? leftNumber - rightNumber
          : left.documentNumber.localeCompare(right.documentNumber, "pt-BR", {
              sensitivity: "base",
              numeric: true
            });
    }

    if (comparison === 0) {
      comparison = left.issueDate.localeCompare(right.issueDate);
    }

    return documentSort.direction === "asc" ? comparison : -comparison;
  });

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
          <strong>{ownLegalEntity ? (ownLegalEntity.legalName || ownLegalEntity.tradeName) : "Nao selecionado"}</strong>
          <small>{ownLegalEntity?.cnpj ?? "CNPJ pendente"} - a lista abaixo mostra somente notas desse CNPJ.</small>
        </div>
        <div className="operation-context-note">
          <span>Empresa emissora (opcional)</span>
          <strong>{manualIssuerPartnerLegalEntityId ? (() => { const selected = partnerLegalEntities.find((entity) => entity.id === manualIssuerPartnerLegalEntityId); return selected ? (selected.legalName || selected.tradeName) : "Selecionada"; })() : "Nenhuma -- emissora e' o CNPJ proprio ativo acima"}</strong>
          {manualIssuerPartnerLegalEntityId ? (
            <small>Nota triangulada: nem emitente nem destinatario e' sua empresa. Informe abaixo o fornecedor (emissor) e o cliente da revenda -- cada item lancado ja cria as duas operacoes (compra e venda) automaticamente.</small>
          ) : (
            <small>Deixe vazio se a nota foi emitida pela sua propria empresa. Escolha outra empresa aqui quando a nota e' de terceiro (nem emitente nem destinatario e' sua empresa).</small>
          )}
          {manualIssuerPartnerLegalEntityId ? (
            <button type="button" onClick={() => { setManualIssuerPartnerLegalEntityId(null); setManualIssuerSearchTerm(""); setManualSecondaryPartnerId(""); }}>Remover empresa emissora</button>
          ) : (
            <>
              <TextField label="Buscar empresa emissora por nome ou CNPJ" value={manualIssuerSearchTerm} onChange={setManualIssuerSearchTerm} />
              {manualIssuerSearchTerm.trim() ? (
                <div className="confirmation-company-results">
                  {partnerLegalEntities
                    .filter((entity) => {
                      const term = manualIssuerSearchTerm.trim().toUpperCase();
                      const digitsTerm = term.replace(/\D/g, "");
                      return entity.tradeName.toUpperCase().includes(term) || entity.legalName.toUpperCase().includes(term) || (digitsTerm.length > 0 && (entity.cnpj?.includes(digitsTerm) ?? false));
                    })
                    .slice(0, 8)
                    .map((entity) => (
                      <div key={entity.id} className="confirmation-company-result-row">
                        <button type="button" className="partner-action-button" onClick={() => { setManualIssuerPartnerLegalEntityId(entity.id); setManualIssuerSearchTerm(""); setOperationType("PURCHASE"); }}>{entity.legalName || entity.tradeName} — {entity.cnpj ?? "CNPJ nao informado"}</button>
                      </div>
                    ))}
                </div>
              ) : null}
            </>
          )}
        </div>
        <div className="cards">
          <article><span>Notas deste CNPJ</span><strong>{documents.length}</strong></article>
          <article><span>Pendencias</span><strong>{documents.filter((doc) => doc.status === "PENDING" || doc.hasPendingIssues).length}</strong></article>
          <article><span>Servico calculado</span><strong>{formatCurrencyFromCents(visibleServiceCents)}</strong></article>
        </div>
        <FormGrid>
          {manualIssuerPartnerLegalEntityId ? (
            <>
              <PartnerQuickSearch label="Fornecedor (emissor)" value={partnerId} onChange={setPartnerId} partners={partners} legalEntities={partnerLegalEntities} />
              <PartnerQuickSearch label="Cliente (revenda)" value={manualSecondaryPartnerId} onChange={setManualSecondaryPartnerId} partners={secondaryPartners} legalEntities={partnerLegalEntities} />
            </>
          ) : (
            <>
              <SelectField label="Compra/venda" value={operationType} onChange={(value) => setOperationType(value as "PURCHASE" | "SALE")} options={[["PURCHASE", "Compra"], ["SALE", "Venda"]]} />
              <PartnerQuickSearch label={operationType === "PURCHASE" ? "Fornecedor responsavel" : "Cliente/corretor responsavel"} value={partnerId} onChange={setPartnerId} partners={partners} legalEntities={partnerLegalEntities} />
            </>
          )}
          <TextField label="Numero da nota" value={number} onChange={setNumber} />
          <TextField label="Chave de acesso" value={accessKey} onChange={setAccessKey} />
          <DateInput label="Data de emissão" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
          <TextField label="Valor total" value={total} onChange={setTotal} />
          <button
            className="primary"
            disabled={Boolean(manualIssuerPartnerLegalEntityId) && (!partnerId || !manualSecondaryPartnerId || partnerId === manualSecondaryPartnerId)}
            onClick={() => void createDocument()}
          >
            Criar nota
          </button>
        </FormGrid>
        {manualIssuerPartnerLegalEntityId && partnerId && manualSecondaryPartnerId && partnerId === manualSecondaryPartnerId ? (
          <p className="feedback" role="status" aria-live="polite">Fornecedor e cliente da nota triangulada precisam ser parceiros diferentes.</p>
        ) : null}
        <div className="toolbar document-search-toolbar">
          <TextField
            label="Pesquisar notas por numero, cliente, empresa ou CNPJ"
            value={documentSearch}
            onChange={setDocumentSearch}
          />
          {documentSearch ? (
            <button type="button" onClick={() => setDocumentSearch("")}>Limpar</button>
          ) : null}
          <span className="muted">
            {filteredDocuments.length} de {documents.length} nota(s)
          </span>
        </div>
        <div className="table"><div className="table-head invoice-grid"><button type="button" className={`table-sort-button${documentSort.key === "number" ? " active" : ""}`} onClick={() => toggleDocumentSort("number")} aria-label={`Ordenar notas por numero ${documentSort.key === "number" && documentSort.direction === "asc" ? "do maior para o menor" : "do menor para o maior"}`}><span>Numero</span><span className="table-sort-indicator" aria-hidden="true">{documentSortIndicator("number")}</span></button><button type="button" className={`table-sort-button${documentSort.key === "client" ? " active" : ""}`} onClick={() => toggleDocumentSort("client")} aria-label={`Ordenar notas por cliente ${documentSort.key === "client" && documentSort.direction === "asc" ? "de Z a A" : "de A a Z"}`}><span>Cliente/corretor</span><span className="table-sort-indicator" aria-hidden="true">{documentSortIndicator("client")}</span></button><span>Emissao</span><span>Status</span><span>Valor NF</span><span>Servico</span><span>Alerta</span><span>Acoes</span></div>{sortedDocuments.map((doc) => {
          const info = documentServiceInfo[doc.id];
          const serviceLabel = info ? `${formatCurrencyFromCents(info.serviceCents)}${info.rateCents !== null ? ` (${formatCurrencyFromCents(info.rateCents)}/saca)` : ""}` : "-";
          const alertLabel = info?.missingRate ? "Sem valor por saca" : doc.hasPendingIssues && doc.pendingNotes ? doc.pendingNotes : doc.duplicateWarning ?? "-";
          // Nota terceirizada aparece aqui mesmo com CNPJ emissor diferente do
          // ativo no topo (ver listFiscalDocuments) -- mostra a empresa
          // emissora real pra nao parecer que a nota e' do CNPJ ativo.
          const isThirdPartyRow = doc.ownLegalEntityId !== ownLegalEntityId;
          const docOwnEntity = isThirdPartyRow ? data.legalEntities.find((entity) => entity.id === doc.ownLegalEntityId) : null;
          const docOwnEntityName = docOwnEntity ? (docOwnEntity.legalName || docOwnEntity.tradeName) : null;
          return <div key={doc.id} className="table-row invoice-grid"><span>{doc.documentNumber}{docOwnEntityName ? <small>Emitida por {docOwnEntityName}</small> : null}</span><span>{documentClientName(doc)}</span><span>{formatDateOnlyBr(doc.issueDate)}</span><span><StatusBadge status={doc.status} /></span><span>{formatCurrencyFromCents(doc.totalAmountCents)}</span><span>{serviceLabel}</span><span title={alertLabel !== "-" ? alertLabel : undefined}>{alertLabel}</span><span className="row-actions"><button onClick={() => window.operationsCafe.getFiscalDocument(doc.id).then((opened) => { setDetail(opened); scrollTo(manualDetailRef); })}>Abrir</button><button className="danger" onClick={() => void deleteDocument(doc)}>Excluir</button></span></div>;
        })}
        {sortedDocuments.length === 0 ? (
          <EmptyState
            title="Nenhuma nota encontrada"
            description={documentSearch ? "Tente pesquisar por outro numero, cliente, empresa ou CNPJ." : "Nenhuma nota cadastrada para este CNPJ."}
          />
        ) : null}
        </div>
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
            <p className="muted">Compra/venda: <strong>{operationType === "PURCHASE" ? "Compra" : "Venda"}</strong> (definido na criacao da nota, mesmo para todos os itens dela).</p>
            <FormGrid>
              <SelectField label="Produto" value={productId} onChange={setProductId} options={products.map((item) => [item.id, item.name])} />
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
          <section className="invoice-action-card">
            <header><span>Empresa da nota</span><strong>Necessaria para Confirmacoes</strong></header>
            <p className="muted">Nota lancada manualmente (sem XML) nao vem com empresa/CNPJ vinculado. Sem isso ela nao aparece nas buscas de Confirmacoes por empresa ou por numero.</p>
            {(() => {
              const linkedCompany = partnerLegalEntities.find((entity) => entity.id === detail.document.partnerLegalEntityId);
              if (linkedCompany) return <p><strong>Vinculada:</strong> {linkedCompany.legalName || linkedCompany.tradeName} ({linkedCompany.cnpj ?? "CNPJ nao informado"})</p>;
              const term = detailCompanySearchTerm.trim().toUpperCase();
              const digitsTerm = term.replace(/\D/g, "");
              const matches = term ? partnerLegalEntities.filter((entity) =>
                entity.tradeName.toUpperCase().includes(term) ||
                entity.legalName.toUpperCase().includes(term) ||
                (digitsTerm && entity.cnpj?.includes(digitsTerm))
              ).slice(0, 8) : [];
              return (
                <>
                  <TextField label="Buscar empresa por nome ou CNPJ" value={detailCompanySearchTerm} onChange={setDetailCompanySearchTerm} />
                  {matches.length ? (
                    <div className="confirmation-company-results">
                      {matches.map((entity) => (
                        <div key={entity.id} className="confirmation-company-result-row">
                          <button type="button" className="partner-action-button" onClick={() => void linkCompanyToDocument(entity.id)}>{entity.legalName || entity.tradeName} — {entity.cnpj ?? "CNPJ nao informado"}</button>
                        </div>
                      ))}
                    </div>
                  ) : term ? <p className="muted">Nenhuma empresa encontrada.</p> : null}
                </>
              );
            })()}
          </section>
        </div>
        <div className="cards">
          <article><span>Itens</span><strong>{detail.items.map((item) => `${item.description}: ${item.quantity} ${formatProductUnit(item.unit)}`).join(" | ") || "Nenhum"}</strong></article>
          <article><span>Operacoes</span><strong>{detail.operations.map((op) => `${op.operationType}/${formatOperationScope(op.operationScope)}: ${op.quantitySacks} sacas - ${formatCurrencyFromCents(op.serviceAmountCents)}`).join(" | ") || "Nenhuma"}</strong></article>
          <article><span>Status</span><strong>{formatStatusLabel(detail.document.status)}</strong></article>
        </div>
        {isTriangulatedDetail ? (
          <div className="operation-warning-card operation-warning-card--neutral">
            <strong>Nota triangulada</strong>
            <span>
              Compra: {partnerName(purchaseLeg?.responsiblePartnerId)}
              {purchaseLeg ? ` — ${formatCurrencyFromCents(purchaseLeg.appliedRateValueCents)}/saca (${formatCurrencyFromCents(purchaseLeg.serviceAmountCents)})` : " — sem operacao ainda"}
              {" | "}
              Venda: {partnerName(saleLeg?.responsiblePartnerId)}
              {saleLeg ? ` — ${formatCurrencyFromCents(saleLeg.appliedRateValueCents)}/saca (${formatCurrencyFromCents(saleLeg.serviceAmountCents)})` : " — sem operacao ainda"}
            </span>
          </div>
        ) : detail.operations.length ? (
          <div className="operation-warning-card operation-warning-card--neutral">
            <strong>Completar nota triangulada</strong>
            <span>
              Use quando a nota ja foi importada antes do cadastro do outro lado do negocio. O sistema cria a operacao oposta
              para o parceiro/corretor escolhido, sem duplicar a chave da NF-e.
            </span>
            <div className="toolbar">
              <PartnerQuickSearch
                label={detailMainOperation?.operationType === "PURCHASE" ? "Cliente/corretor para cobranca" : "Fornecedor para acerto"}
                value={detailSecondaryPartnerId}
                onChange={setDetailSecondaryPartnerId}
                partners={secondaryPartners}
                legalEntities={partnerLegalEntities}
              />
              <button className="primary" disabled={!detailSecondaryPartnerId} onClick={() => void completeDetailTriangulation()}>Completar nota</button>
            </div>
          </div>
        ) : null}
        {detail.rateHistory && detail.rateHistory.length > 0 ? (
          <div className="cards">
            <article className="rate-history-card">
              <span>Historico de tarifa</span>
              <strong>
                {detail.rateHistory.map((entry) => (
                  <span key={entry.id} className="rate-history-entry">
                    {formatDateOnlyBr(entry.changedAt)}: {entry.previousRateValueCents !== null ? formatCurrencyFromCents(entry.previousRateValueCents) : "sem valor"} → {entry.newRateValueCents !== null ? formatCurrencyFromCents(entry.newRateValueCents) : "sem valor"}{entry.reason ? ` (${entry.reason})` : ""}
                  </span>
                ))}
              </strong>
            </article>
          </div>
        ) : null}
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
              <button onClick={() => void validateXmlImport()} disabled={xmlQueue.length === 0 || !hasValidXmlSelection || !partnerId}>Validar fila</button>
            </div>
          </div>

          <div className="import-column">
            <h3>Dados extraidos</h3>
            {selectedXmlPreview ? (
              <>
                {selectedXmlOwnMismatch ? (
                  <div className="operation-warning-card">
                    <strong>Atencao: XML de outro CNPJ</strong>
                    <span>O XML parece ser de {selectedXmlParties.ownEntityLabel}, mas o topo esta operando em {ownLegalEntity ? (ownLegalEntity.legalName || ownLegalEntity.tradeName) : "-"}. A nota sera salva na empresa correta do XML para entrar nas cobrancas.</span>
                  </div>
                ) : null}
                {selectedXmlParties.isThirdPartyOrigin ? (
                  <div className="operation-warning-card operation-warning-card--neutral">
                    <strong>Nota de empresa externa/terceirizada</strong>
                    <span>Este XML nao pertence aos CNPJs Villa ou Grao cadastrados como proprios. Ele pode ser salvo para entrar nas cobrancas do cliente/corretor responsavel. Se o emitente e o destinatario ja estiverem cadastrados como empresas vinculadas (um a um fornecedor, outro a um cliente/corretor), o sistema reconhece automaticamente e gera as duas operacoes — compra e venda — a partir da mesma remessa. Se nao reconhecer sozinho, associe o segundo parceiro manualmente na tabela de revisao abaixo apos validar a fila.</span>
                  </div>
                ) : null}
                <dl className="kv-list">
                  <div><dt>Origem reconhecida</dt><dd>{selectedXmlParties.originLabel}</dd></div>
                  <div><dt>Emitente da nota</dt><dd>{selectedXmlParties.issuerLabel ?? "Nao identificado"}</dd></div>
                  <div><dt>Destinatario da nota</dt><dd>{selectedXmlParties.recipientLabel ?? "Nao identificado"}</dd></div>
                  <div><dt>Produto</dt><dd>{selectedXmlItem?.description ?? "-"}</dd></div>
                  <div>
                    <dt>Quantidade</dt>
                    <dd>
                      {decimalTextBr(selectedXmlSacks)} sacas
                      {selectedXmlItem?.commercialQuantity && selectedXmlItem?.commercialUnit
                        ? ` (${decimalTextBr(selectedXmlItem.commercialQuantity)} ${selectedXmlItem.commercialUnit})`
                        : ""}
                    </dd>
                  </div>
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
              <PartnerQuickSearch label={operationType === "PURCHASE" ? "Fornecedor responsavel pela nota" : "Cliente/corretor responsavel pela cobranca"} value={partnerId} onChange={setPartnerId} partners={partners} legalEntities={partnerLegalEntities} />
              <SelectField label="Compra/venda" value={operationType} onChange={(value) => setOperationType(value as "PURCHASE" | "SALE")} options={[["PURCHASE", "Compra"], ["SALE", "Venda"]]} />
              <SelectField
                label="UF da venda"
                value={selectedXmlScope}
                onChange={(value) => {
                  const nextScope = value as OperationScope;
                  if (selectedXmlFile) setXmlScopeOverrides((current) => ({ ...current, [selectedXmlFile.token]: nextScope }));
                  setScope(nextScope);
                }}
                options={OPERATION_SCOPE_OPTIONS}
              />
            </FormGrid>
            <div className="toolbar">
              <button onClick={() => { setXmlSelections([]); setXmlQueue([]); setXmlJob(null); setXmlScopeOverrides({}); setSelectedXmlToken(null); }} disabled={xmlQueue.length === 0}>Cancelar importacao</button>
              <button className="primary" onClick={() => void executeXmlImport()} disabled={!xmlJob || !partnerId}>Salvar nota</button>
            </div>
          </div>
        </div>
        {xmlQueue.length ? (
          <div className="xml-batch-review">
            <div className="section-title-row">
              <div>
                <h3>Revisao da fila</h3>
                <p className="muted">Confira todos os XMLs antes de validar e salvar. Clique em uma linha para ver os detalhes completos ao lado.</p>
              </div>
              <span className="summary-pill">{validXmlBatchRows.length} de {xmlQueue.length} pronto(s)</span>
            </div>
            <div className="table">
              <div className="table-head xml-batch-grid"><span>Arquivo / NF</span><span>Origem</span><span>Cliente da nota</span><span>Produto</span><span>Sacas</span><span>UF</span><span>Status</span></div>
              {xmlBatchRows.map((row) => (
                <button
                  key={row.file.token}
                  type="button"
                  className={`table-row xml-batch-grid xml-batch-row ${row.file.token === selectedXmlFile?.token ? "active" : ""}`}
                  onClick={() => setSelectedXmlToken(row.file.token)}
                >
                  <span><strong>{row.file.originalFileName}</strong><small>NF {row.preview?.number ?? "-"} · {row.preview?.issuedAt ? formatDateBr(row.preview.issuedAt) : "data nao lida"}</small></span>
                  <span><strong>{row.parties.originLabel}</strong><small>{row.parties.isThirdPartyOrigin ? "Terceirizada/externa" : "CNPJ proprio"}</small></span>
                  <span>{row.parties.recipientLabel ?? row.parties.issuerLabel ?? "Nao identificado"}</span>
                  <span>{row.firstItem?.description ?? "-"}</span>
                  <span>
                    {decimalTextBr(
                      xmlQuantityInSacks(
                        row.firstItem?.commercialQuantity,
                        row.firstItem?.commercialUnit
                      )
                    )}
                  </span>
                  <span>{formatOperationScope(row.operationScope)}</span>
                  <span><StatusBadge status={row.file.status} /></span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div ref={xmlResultRef}>
        {visibleXmlJob ? (
          <div className="section-title-row xml-result-actions">
            <div>
              <h3>Resultado da importacao XML</h3>
              <p className="muted">Use o historico para revisar importacoes anteriores. Se o XML ainda nao virou nota, exclua a importacao inteira.</p>
            </div>
            <div className="actions">
              <button onClick={() => scrollTo(xmlHistoryRef)}>Ver historico</button>
              <button className="danger" disabled={!xmlImportCanBeReverted(visibleXmlJob.job)} onClick={() => void removeXmlImportJob()}>Excluir/Reverter importacao</button>
            </div>
          </div>
        ) : null}
        {visibleXmlJob ? <div className="cards"><article><span>Arquivos</span><strong>{visibleXmlJob.files.length}</strong></article><article><span>Validos</span><strong>{visibleXmlJob.files.filter((file) => file.status === "VALID" || file.status === "IMPORTED").length}</strong></article><article><span>Eventos</span><strong>{visibleXmlJob.job.importedEvents}</strong></article><article><span>Notas</span><strong>{visibleXmlJob.files.filter((file) => file.fiscalDocumentId).length}</strong></article><article><span>Erros</span><strong>{visibleXmlJob.files.filter((file) => file.status === "ERROR").length}</strong></article><article><span>Itens sem operacao</span><strong>{visibleXmlJob.job.itemsWithoutOperation}</strong></article></div> : null}
        {visibleXmlJob ? (
          <div className="table">
            <div className="table-head xml-files-grid"><span>Arquivo</span><span>Status</span><span>Tipo</span><span>Chave</span><span>Detalhe</span><span>Acoes</span></div>
            {visibleXmlJob.files.map((file) => (
              <div key={file.id} className="table-row xml-files-grid">
                <span>{file.originalFileName}</span>
                <span><StatusBadge status={file.status} label={xmlFileStatusLabel(file)} /></span>
                <span>{file.xmlType}</span>
                <span>{file.accessKey ?? "-"}</span>
                <span>{xmlFileDetailMessage(file)}</span>
                <span className="row-actions">
                  {file.fiscalDocumentId ? <button onClick={() => void window.operationsCafe.getFiscalDocument(file.fiscalDocumentId as string).then((opened) => { setDetail(opened); setPageTab("documents"); scrollTo(manualDetailRef); })}>Abrir nota</button> : <small className="muted">Nota ainda nao salva</small>}
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
        {visibleXmlJob && visibleXmlJob.files.some((file) => file.status === "PENDING_REVIEW") ? (
          <div className="table">
            <div className="table-head xml-resolution-grid"><span>Arquivo</span><span>Status</span><span>Emitente</span><span>Destinatario</span><span>Associar cliente/corretor</span><span>Segundo parceiro (nota triangulada)</span><span>Acoes</span></div>
            {visibleXmlJob.files.filter((file) => file.status === "PENDING_REVIEW").map((file) => {
              const { issuer, recipient } = xmlFileParty(file);
              return (
                <div key={file.id} className="table-row xml-resolution-grid">
                  <span>{file.originalFileName}</span>
                  <span>Pendente</span>
                  <span>{issuer?.legalName ?? issuer?.tradeName ?? "-"}</span>
                  <span>{recipient?.legalName ?? recipient?.tradeName ?? "-"}</span>
                  <span>
                    <PartnerQuickSearch label="Cliente/corretor" value={xmlResolutionSelections[file.id] ?? ""} onChange={(value) => setXmlResolutionSelections((current) => ({ ...current, [file.id]: value }))} partners={partners} legalEntities={partnerLegalEntities} />
                  </span>
                  <span>
                    <PartnerQuickSearch
                      label={operationType === "PURCHASE" ? "Corretor/cliente (venda)" : "Fornecedor (compra)"}
                      placeholder="So' se essa nota tambem gerar a outra ponta (compra + venda)"
                      value={xmlSecondaryResolutionSelections[file.id] ?? ""}
                      onChange={(value) => setXmlSecondaryResolutionSelections((current) => ({ ...current, [file.id]: value }))}
                      partners={secondaryPartners}
                    />
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
        <div className="table"><div className="table-head xml-history-grid"><span>Data</span><span>Status</span><span>Arquivos</span><span>Notas</span><span>Operacoes</span><span>Sem operacao</span><span>Eventos</span><span>Erros</span><span>Acoes</span></div>{visibleXmlHistory.map((job) => <div key={job.id} className="table-row xml-history-grid"><span>{formatDateBr(job.createdAt)}</span><span><StatusBadge status={job.status} /></span><span>{job.totalFiles}</span><span>{job.importedNotes}</span><span>{job.createdOperations}</span><span>{job.itemsWithoutOperation}</span><span>{job.importedEvents}</span><span>{job.errorFiles}</span><span className="row-actions"><button onClick={() => void openXmlImportJob(job.id)}>Detalhar</button><button className="danger" disabled={!xmlImportCanBeReverted(job)} onClick={() => void removeXmlImportJob(job.id)}>Excluir/Reverter</button></span></div>)}</div>
      </AdminBlock></div>
      </>}
      <Feedback message={message} />
    </section>
  );
}
