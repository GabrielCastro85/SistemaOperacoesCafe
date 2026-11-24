import React, { useCallback, useEffect, useRef, useState } from "react";
import type { BootstrapData, BusinessPartner, BusinessPartnerLegalEntity, FiscalDocument, FiscalDocumentDetail, OperationScope, Product, SheetPreview, SpreadsheetImportJob, SpreadsheetImportRow, WorkbookInspection, XmlFileInspection, XmlImportFile, XmlImportJob } from "../../../shared/types/domain";
import { formatCurrencyFromCents, formatDateBr, formatDateOnlyBr, formatSacks, onlyDigits, parseCurrencyToCents } from "../../../shared/utils/format";
import { DateInput, EmptyState, FileDropzone, ListStepsIcon, PageHeader, StatusBadge, Stepper, Tabs } from "../../design-system";
import type { StepperStep } from "../../design-system";
import { SelectField, TextField } from "../../components/forms/LegacyFields";
import { PartnerQuickSearch } from "../../components/forms/PartnerQuickSearch";
import { Feedback } from "../../components/feedback/Feedback";
import { AdminBlock, FormGrid } from "../../components/layout/SectionPrimitives";
import { useAutoScroll } from "../../hooks/useAutoScroll";
import { useCentralDataRefresh } from "../../hooks/useCentralDataRefresh";
import { requestDecision, requestTextInput } from "../../utils/dialogs";
import { isPackagingDocument, PACKAGING_OVERRIDE_PREFIX } from "../../../shared/utils/packagingBilling";
import { NumberingAudit } from "./NumberingAudit";
import { CollectorStatusList } from "./components/CollectorStatusList";
import { useManualFiscalDocumentForm } from "./hooks/useManualFiscalDocumentForm";
import { useXmlImportState } from "./hooks/useXmlImportState";
import { XmlImportHistory } from "./components/XmlImportHistory";
import { XmlImportQueue } from "./components/XmlImportQueue";
import { XmlImportDataColumn } from "./components/XmlImportDataColumn";
import { ManualFiscalDocumentForm } from "./components/ManualFiscalDocumentForm";
import { FiscalDocumentDetailPanel } from "./components/FiscalDocumentDetailPanel";
import { NotesSearchPanel } from "./components/NotesSearchPanel";
import { useFiscalDocumentDetailState } from "./hooks/useFiscalDocumentDetailState";
import { FiscalDocumentsTable, type FiscalDocumentRowView } from "./components/FiscalDocumentsTable";
import { classifyWarehouseXml, inferXmlOperationType, parseNfeExtractedPreview, resolveOwnAndCounterparty } from "./xmlPreview";
import { formatOperationScope, OPERATION_SCOPE_OPTIONS } from "../../../shared/utils/operationLabels";
import { formatProductUnit } from "../../../shared/utils/productLabels";
import { formatStatusLabel } from "../../../shared/utils/statusLabels";

import { buildSelectedXmlView, decimalTextBr, xmlQuantityInSacks, formatFileSize, formatCnpjCompact, xmlQueueSummaryLine, xmlPartySummary, inferXmlOperationScope, xmlInspectionIsWarehouse, xmlImportIsVisuallyDeleted, xmlImportFileIsVisuallyDeleted, DocumentSortKey, SortDirection, OperationsPageTab, VulpeDevScanResult, VulpeDevStatusResult, CollectorMonitorStatus, collectorCommandLabel, brazilDateValue } from "./operationsFormatters";

export function OperationsPage({ data }: { data: BootstrapData }): JSX.Element {

  function currentBrazilMonthRange(): { start: string; end: string } {
    const today = brazilDateValue();
    const year = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7));
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      start: `${today.slice(0, 7)}-01`,
      end: `${today.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`
    };
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
  const [showCanceledDocuments, setShowCanceledDocuments] = useState(false);
  const [documentLimit, setDocumentLimit] = useState(20);
  const [documentSort, setDocumentSort] = useState<{ key: DocumentSortKey | null; direction: SortDirection }>({
    key: null,
    direction: "asc"
  });
  const [documentServiceInfo, setDocumentServiceInfo] = useState<Record<string, { sacks: string; rateCents: number | null; serviceCents: number; missingRate: boolean }>>({});
  const detailState = useFiscalDocumentDetailState();
  const {
    detailCompanySearchTerm, setDetailCompanySearchTerm,
    detailSecondaryPartnerId, setDetailSecondaryPartnerId,
    financialServiceEnabled, setFinancialServiceEnabled,
    freightDaeAmount, setFreightDaeAmount,
    freightDaeEnabled, setFreightDaeEnabled,
    freightDaeReference, setFreightDaeReference,
    invoiceDaeAmount, setInvoiceDaeAmount,
    invoiceDaeEnabled, setInvoiceDaeEnabled,
    invoiceDaeReference, setInvoiceDaeReference,
    packagingUnitValue, setPackagingUnitValue,
    productId, setProductId,
    quantity, setQuantity,
    replacementPartnerId, setReplacementPartnerId,
    returnDate, setReturnDate,
    returnQuantity, setReturnQuantity,
    returnReason, setReturnReason,
    returnUnit, setReturnUnit,
    sacks, setSacks,
    scope, setScope,
    unitPrice, setUnitPrice
  } = detailState;
  const [reviewBeforeConfirm, setReviewBeforeConfirm] = useState(false);
  const manualForm = useManualFiscalDocumentForm();
  const {
    billingObservations, setBillingObservations,
    partnerId, setPartnerId,
    number, setNumber,
    contractNumber, setContractNumber,
    accessKey, setAccessKey,
    total, setTotal,
    issueDate, setIssueDate,
    operationType, setOperationType,
    manualIssuerSearchTerm, setManualIssuerSearchTerm,
    manualIssuerPartnerLegalEntityId, setManualIssuerPartnerLegalEntityId,
    manualCounterpartyLegalEntityId, setManualCounterpartyLegalEntityId,
    manualSecondaryPartnerId, setManualSecondaryPartnerId
  } = manualForm;
  const [detail, setDetail] = useState<FiscalDocumentDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pageTab, setPageTab] = useState<OperationsPageTab>("issued");
  const [workbook, setWorkbook] = useState<WorkbookInspection | null>(null);
  const [preview, setPreview] = useState<SheetPreview | null>(null);
  const [importJob, setImportJob] = useState<{ job: SpreadsheetImportJob; rows: SpreadsheetImportRow[] } | null>(null);
  const [importHistory, setImportHistory] = useState<SpreadsheetImportJob[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [headerRow, setHeaderRow] = useState("1");
  const xmlState = useXmlImportState();
  const {
    xmlSelections, setXmlSelections,
    xmlQueue, setXmlQueue,
    xmlJob, setXmlJob,
    xmlHistory, setXmlHistory,
    xmlHistoryLimit, setXmlHistoryLimit,
    includeXmlSubfolders, setIncludeXmlSubfolders,
    xmlSelectionSource, setXmlSelectionSource,
    xmlResolutionSelections, setXmlResolutionSelections,
    xmlSecondaryResolutionSelections, setXmlSecondaryResolutionSelections,
    xmlScopeOverrides, setXmlScopeOverrides,
    xmlOperationTypeOverrides, setXmlOperationTypeOverrides,
    xmlManualRates, setXmlManualRates,
    xmlManualReasons, setXmlManualReasons,
    xmlPartnerOverrides, setXmlPartnerOverrides,
    xmlIgnoredSelections, setXmlIgnoredSelections,
    xmlDeferredSelections, setXmlDeferredSelections,
    xmlContractNumbers, setXmlContractNumbers,
    xmlBillingObservations, setXmlBillingObservations,
    xmlFreightDaeEnabled, setXmlFreightDaeEnabled,
    xmlFreightDaeReferences, setXmlFreightDaeReferences,
    xmlFreightDaeAmounts, setXmlFreightDaeAmounts,
    xmlFinancialServiceEnabled, setXmlFinancialServiceEnabled,
    xmlInvoiceDaeEnabled, setXmlInvoiceDaeEnabled,
    xmlInvoiceDaeReferences, setXmlInvoiceDaeReferences,
    xmlInvoiceDaeAmounts, setXmlInvoiceDaeAmounts,
    selectedXmlToken, setSelectedXmlToken,
    xmlDetailTab, setXmlDetailTab
  } = xmlState;
  // Compra/venda por nota: o XML define (empresa propria emitente = venda, destinataria = compra); o usuario pode trocar.
  // Valor por saca so desta nota (texto digitado e motivo); vazio = usa a regra do cliente.
  const [vulpeDevAvailable, setVulpeDevAvailable] = useState(false);
  const [vulpeDevSources, setVulpeDevSources] = useState<Array<{ source: "VILLA_MG" | "VILLA_ES" | "VILLA_SP" | "GRAO_MG" | "GRAO_SP" | "ALL"; label: string; available: boolean }>>([]);
  const [collectorStatuses, setCollectorStatuses] = useState<CollectorMonitorStatus[]>([]);
  const [collectorMonitorError, setCollectorMonitorError] = useState<string | null>(null);
  const [collectorCommandBusy, setCollectorCommandBusy] = useState<string | null>(null);
  const [vulpeScan, setVulpeScan] = useState<VulpeDevScanResult | null>(null);
  const [vulpePeriodStart, setVulpePeriodStart] = useState(() => currentBrazilMonthRange().start);
  const [vulpePeriodEnd, setVulpePeriodEnd] = useState(() => currentBrazilMonthRange().end);
  // Nota terceirizada lancada manualmente: nem emitente nem destinatario e' a
  // empresa propria ativa no topo -- ver resolveIssuerLegalEntityFromPartner.
  // Vazio = comportamento de sempre (emissora = CNPJ proprio ativo).
  // Cliente da revenda numa nota triangulada lancada manualmente -- so' usado
  // quando manualIssuerPartnerLegalEntityId esta preenchido (ver createDocument).
  const scrollTo = useAutoScroll();
  const manualDetailRef = useRef<HTMLDivElement | null>(null);
  const spreadsheetResultRef = useRef<HTMLDivElement | null>(null);
  const spreadsheetHistoryRef = useRef<HTMLDivElement | null>(null);
  const xmlDataRef = useRef<HTMLDivElement | null>(null);
  const xmlResultRef = useRef<HTMLDivElement | null>(null);
  // Rola so se a secao nao estiver visivel na tela; nao leva a pagina para o topo.
  function scrollXmlIntoView(target: { current: HTMLElement | null }): void {
    const element = target.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (rect.top >= 0 && rect.bottom <= window.innerHeight) return;
    element.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  const xmlHistoryRef = useRef<HTMLDivElement | null>(null);

  const sendCollectorCommand = async (collector: CollectorMonitorStatus, command: "SCAN_NOW" | "UPDATE_NOW" | "RESTART" | "BACKFILL") => {
    const key = `${collector.sourceCode}-${collector.machineId}-${command}`;
    setCollectorCommandBusy(key);
    try {
      await window.operationsCafe.sendCollectorCommand({
        sourceCode: collector.sourceCode,
        machineId: collector.machineId,
        command,
        ...(command === "BACKFILL" ? { periodStart: vulpePeriodStart, periodEnd: vulpePeriodEnd } : {})
      });
      const action = command === "BACKFILL"
        ? `Pedido de envio das notas de ${formatDateOnlyBr(vulpePeriodStart)} a ${formatDateOnlyBr(vulpePeriodEnd)}`
        : collectorCommandLabel(command);
      setMessage(`${action} enviado ao coletor. ${collector.online ? "Ele deve executar em ate 30 segundos." : "O comando sera executado assim que o coletor voltar a conectar."}`);
      const status = await window.operationsCafe.getVulpeDevStatus();
      setCollectorStatuses(status.collectors);
      setCollectorMonitorError(status.collectorMonitorError);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel enviar o comando ao coletor.");
    } finally {
      setCollectorCommandBusy(null);
    }
  };

  useEffect(() => { setXmlJob(null); }, [partnerId, operationType, scope, productId, ownLegalEntityId]);
  useEffect(() => { setReplacementPartnerId(""); }, [detail?.document.id]);
  useEffect(() => { setReturnDate(brazilDateValue()); setReturnUnit("SACKS"); setReturnQuantity(""); setReturnReason(""); }, [detail?.document.id]);
  useEffect(() => {
    const amount = detail?.document.freightDaeAmountCents ?? 0;
    setFreightDaeEnabled(amount > 0);
    setFreightDaeReference(detail?.document.freightDaeReference ?? "");
    setFreightDaeAmount(amount > 0 ? formatCurrencyFromCents(amount) : "");
  }, [
    detail?.document.id,
    detail?.document.freightDaeAmountCents,
    detail?.document.freightDaeReference,
  ]);
  useEffect(() => {
    const amount = detail?.document.invoiceDaeAmountCents ?? 0;
    setInvoiceDaeEnabled(amount > 0);
    setInvoiceDaeReference(detail?.document.invoiceDaeReference ?? "");
    setInvoiceDaeAmount(amount > 0 ? formatCurrencyFromCents(amount) : "");
  }, [detail?.document.id, detail?.document.invoiceDaeAmountCents, detail?.document.invoiceDaeReference]);
  useEffect(() => {
    setFinancialServiceEnabled(detail?.document.hasFinancialService ?? false);
  }, [detail?.document.id, detail?.document.hasFinancialService]);
  useEffect(() => {
    if (typeof window.operationsCafe.getVulpeDevStatus !== "function") return;
    const refresh = () => window.operationsCafe.getVulpeDevStatus()
      .then((status) => {
        setVulpeDevAvailable(status.available);
        setVulpeDevSources(status.sources);
        setCollectorStatuses(status.collectors);
        setCollectorMonitorError(status.collectorMonitorError);
      })
      .catch(() => {
        setVulpeDevAvailable(false);
        setVulpeDevSources([]);
        setCollectorStatuses([]);
        setCollectorMonitorError("Nao foi possivel consultar o servidor agora. Uma nova tentativa sera feita em 30 segundos.");
      });
    // O status do coletor espera a lista de notas carregar (antes saia na frente
    // e atrasava a tela em ~0,7 s).
    const first = window.setTimeout(() => void refresh(), 1_500);
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, []);

  const load = useCallback(async () => {
    const roleForOperationType = operationType === "PURCHASE" ? "SUPPLIER" : "CLIENT";
    // Nota triangulada: o segundo parceiro (a outra perna, compra ou venda)
    // precisa ter o papel OPOSTO ao do parceiro principal selecionado acima.
    const secondaryRole = roleForOperationType === "SUPPLIER" ? "CLIENT" : "SUPPLIER";
    // Primeira rodada: tudo que nao depende de nada sai junto (o site agrupa
    // as consultas numa ida so ao servidor). Antes era uma fila de 8 esperas.
    const [rolePartners, oppositeRolePartners, unlinkedLegalEntities, activeProducts, fiscalDocuments, importJobs, xmlJobs] = await Promise.all([
      window.operationsCafe.listBusinessPartners({ role: roleForOperationType, status: "active" }),
      window.operationsCafe.listBusinessPartners({ role: secondaryRole, status: "active" }),
      organizationId ? window.operationsCafe.listUnlinkedPartnerLegalEntities(organizationId) : Promise.resolve([]),
      window.operationsCafe.listProducts({ organizationId, status: "active" }),
      window.operationsCafe.listFiscalDocuments({ organizationId, ownLegalEntityId, status: "all", includeThirdParty: true }),
      window.operationsCafe.listSpreadsheetImportJobs(organizationId),
      window.operationsCafe.listXmlImportJobs(organizationId)
    ]);
    setPartners(rolePartners);
    setSecondaryPartners(oppositeRolePartners);
    const searchablePartners = [...rolePartners, ...oppositeRolePartners];
    // Empresas/CNPJs sem cliente/corretor dono (cadastradas direto em
    // "Empresas e CNPJs") nao aparecem percorrendo os parceiros -- precisa
    // buscar as soltas separadamente e juntar, senao elas nunca aparecem nas
    // buscas desta tela (responsavel da nota, empresa da nota, resolucao de
    // XML), mesmo depois de cadastradas (ver mesmo padrao em PartnersPage).
    // Segunda rodada: o que depende da primeira.
    const [linkedLegalEntities, serviceSummaries] = await Promise.all([
      window.operationsCafe.listPartnerLegalEntitiesForPartners(searchablePartners.map((partner) => partner.id)).then((rows) => [rows]),
      // Uma chamada para todas as notas (antes abria nota por nota).
      window.operationsCafe.listFiscalDocumentServiceSummaries(fiscalDocuments.map((doc) => doc.id))
    ]);
    setPartnerLegalEntities([...linkedLegalEntities.flat(), ...unlinkedLegalEntities]);
    setPartnerId((current) => (rolePartners.some((partner) => partner.id === current) ? current : ""));
    setManualCounterpartyLegalEntityId((current) => {
      if (!current) return "";
      const selected = [...linkedLegalEntities.flat(), ...unlinkedLegalEntities].find((entity) => entity.id === current);
      return selected && rolePartners.some((partner) => partner.id === selected.businessPartnerId) ? current : "";
    });
    setProducts(activeProducts);
    setProductId((current) => current || activeProducts[0]?.id || "");
    setDocuments(fiscalDocuments);
    setDocumentServiceInfo(serviceSummaries);
    setImportHistory(importJobs);
    setXmlHistory(xmlJobs.filter((job) => !xmlImportIsVisuallyDeleted(job)));
  }, [organizationId, ownLegalEntityId, operationType]);

  useEffect(() => { void load(); }, [load]);

  // Recebe notas e alteracoes feitas em outro computador sem desmontar a
  // tela nem limpar a aba, a pesquisa ou um formulario em andamento.
  useCentralDataRefresh(load);

  useEffect(() => {
    if (manualIssuerPartnerLegalEntityId || !partnerId) {
      setManualCounterpartyLegalEntityId("");
      return;
    }
    const options = partnerLegalEntities.filter((entity) => entity.businessPartnerId === partnerId && entity.isActive);
    setManualCounterpartyLegalEntityId((current) => {
      if (options.some((entity) => entity.id === current)) return current;
      return options.length === 1 ? options[0].id : "";
    });
  }, [manualIssuerPartnerLegalEntityId, partnerId, partnerLegalEntities]);

  const parseCurrency = (value: string): number => parseCurrencyToCents(value);

  async function createDocument(): Promise<void> {
    try {
      const selectedCounterpartyEntity = partnerLegalEntities.find((entity) => entity.id === manualCounterpartyLegalEntityId) ?? null;
      if (!manualIssuerPartnerLegalEntityId && partnerId && !selectedCounterpartyEntity) {
        throw new Error(`Selecione o CNPJ exato ${operationType === "PURCHASE" ? "do fornecedor" : "do cliente"}.`);
      }
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
        partnerLegalEntityId: manualIssuerPartnerLegalEntityId ? null : selectedCounterpartyEntity?.id ?? null,
        operationType,
        secondaryResponsiblePartnerId: isTriangulated ? manualSecondaryPartnerId : null,
        secondaryOperationType: isTriangulated ? (operationType === "PURCHASE" ? "SALE" : "PURCHASE") : null,
        accessKey: onlyDigits(accessKey),
        documentNumber: number,
        billingObservations: billingObservations.trim() || null,
        contractNumber: contractNumber.trim() || null,
        series: null,
        issueDate,
        totalAmountCents: parseCurrency(total),
        hasPendingIssues: false,
        pendingNotes: null,
        notes
      });
      setDetail(created);
      setBillingObservations("");
      setMessage(created.document.duplicateWarning ?? (isTriangulated ? "Nota triangulada criada -- cada item lancado abaixo ja gera compra e venda automaticamente." : "Nota criada."));
      setManualIssuerSearchTerm("");
      setManualIssuerPartnerLegalEntityId(null);
      setManualCounterpartyLegalEntityId("");
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

  async function savePackagingUnitValue(): Promise<void> {
    const operation = detail?.operations[0];
    if (!detail || !operation) return;
    const unitValueCents = parseCurrency(packagingUnitValue);
    if (!packagingUnitValue.trim() || !Number.isFinite(unitValueCents) || unitValueCents < 0) {
      setMessage("Erro: informe o valor a cobrar por unidade, por exemplo 30,00.");
      return;
    }
    try {
      await window.operationsCafe.updateOperationManualRate(operation.id, unitValueCents, "Valor por unidade da remessa de sacaria");
      setDetail(await window.operationsCafe.getFiscalDocument(detail.document.id));
      setPackagingUnitValue("");
      await load();
      setMessage(`Remessa de sacaria: ${formatCurrencyFromCents(unitValueCents)} por unidade. A nota nao soma sacas.`);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao salvar o valor por unidade."}`);
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
      if (visibleFiles.length && !xmlImportIsVisuallyDeleted(openedJob.job)) scrollXmlIntoView(xmlResultRef);
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
        hasFinancialService: detail.document.hasFinancialService,
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
      setVulpeScan(null);
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

  async function prepareVulpeDevImport(source: "VILLA_MG" | "VILLA_ES" | "VILLA_SP" | "GRAO_MG" | "GRAO_SP" | "ALL"): Promise<void> {
    try {
      if (!vulpePeriodStart || !vulpePeriodEnd) throw new Error("Informe as datas inicial e final.");
      if (vulpePeriodStart > vulpePeriodEnd) throw new Error("A data inicial nao pode ser posterior a data final.");
      const direction = pageTab === "issued" ? "OUTBOUND" : "INBOUND";
      const result = await window.operationsCafe.scanVulpeDevXml({ source, direction, periodStart: vulpePeriodStart, periodEnd: vulpePeriodEnd });
      setVulpeScan(result);
      if (result.files.length === 0) {
        setXmlSelections([]);
        setXmlQueue([]);
        setXmlJob(null);
        setSelectedXmlToken(null);
        setMessage(`${result.label}: nenhuma NF-e nova aguardando revisao entre ${formatDateOnlyBr(result.periodStart)} e ${formatDateOnlyBr(result.periodEnd)}.`);
        return;
      }
      await inspectSelectedXmlFiles(result.files, "FOLDER");
      setMessage(`${result.label}: ${result.pendingReview} NF-e nova(s) carregada(s) para classificacao.`);
    } catch (errorValue) {
      setMessage(`Erro Vulpe: ${errorValue instanceof Error ? errorValue.message : "falha ao buscar notas."}`);
    }
  }

  async function prepareDroppedXmlImport(files: File[]): Promise<void> {
    try {
      // A extensao vem do nome do arquivo: no site o "caminho" e um token (web-file:...), sem .xml.
      const droppedXml = files.filter((file) => file.name.toLowerCase().endsWith(".xml"));
      if (droppedXml.length === 0) {
        setMessage(files.length === 0 ? "Nao foi possivel ler o arquivo arrastado. Tente arrastar o arquivo direto do Explorador do Windows." : "Arraste somente arquivos XML da NF-e para importar.");
        return;
      }
      const xmlPaths = window.operationsCafe.getDroppedFilePaths(droppedXml);
      if (xmlPaths.length === 0) {
        setMessage("Nao foi possivel ler o arquivo arrastado. Tente arrastar o arquivo direto do Explorador do Windows.");
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
    setXmlOperationTypeOverrides({});
    setXmlManualRates({});
    setXmlManualReasons({});
    setXmlPartnerOverrides({});
    setXmlIgnoredSelections({}); setXmlDeferredSelections({});
    setXmlContractNumbers({});
    setXmlBillingObservations({});
    setXmlFreightDaeEnabled({});
    setXmlFreightDaeReferences({});
    setXmlFreightDaeAmounts({});
    setXmlFinancialServiceEnabled({});
    setXmlInvoiceDaeEnabled({});
    setXmlInvoiceDaeReferences({});
    setXmlInvoiceDaeAmounts({});
    setSelectedXmlToken(inspections.find((file) => file.status !== "ERROR")?.token ?? inspections[0]?.token ?? null);
    setMessage(
      invalidCount
        ? `${inspections.length} XML(s) inspecionado(s). ${invalidCount} arquivo(s) com erro.`
        : `${inspections.length} XML(s) inspecionado(s).`
    );
  }

  async function validateXmlImport(): Promise<void> {
    if (xmlSelections.length === 0) return;
    if (vulpeScan) {
      const missingPartner = xmlQueue.find((file) =>
        file.status !== "ERROR"
        && !file.xmlType.startsWith("EVENT_")
        && !xmlInspectionIsWarehouse(file)
        && !xmlIgnoredSelections[file.token]
        && !xmlDeferredSelections[file.token]
        && !xmlPartnerOverrides[file.token]
      );
      if (missingPartner) {
        setSelectedXmlToken(missingPartner.token);
        setMessage("Escolha o cliente/corretor desta nota ou marque 'Não cadastrar'. Cada nota precisa de uma decisão própria.");
        setXmlDetailTab("cliente");
        scrollXmlIntoView(xmlDataRef);
        return;
      }
    }
    const requiresCommercialPartner = xmlQueue.some((file) =>
      file.status !== "ERROR"
      && !file.xmlType.startsWith("EVENT_")
      && !xmlInspectionIsWarehouse(file)
      && !xmlDeferredSelections[file.token]
    );
    if (!partnerId && !vulpeScan && requiresCommercialPartner) {
      setMessage(operationType === "PURCHASE" ? "Selecione o fornecedor responsável antes de validar o XML." : "Selecione o cliente/corretor responsável pela cobrança antes de validar o XML.");
      setXmlDetailTab("cliente");
      scrollXmlIntoView(xmlDataRef);
      return;
    }
    try {
      const job = await window.operationsCafe.createXmlImportDraft({
        organizationId,
        sourceType: xmlSelectionSource,
        selectedFolder: null,
        includeSubfolders: includeXmlSubfolders,
        settings: { ownLegalEntityId, clientPartnerId: partnerId || null, operationType, operationScope: scope, productId: productId || null, createOperations: true, reviewBeforeConfirm }
      });
      const added = await window.operationsCafe.addXmlImportFiles({ jobId: job.id, tokens: xmlSelections.map((file) => file.token) });
      for (const file of added.files) {
        const inspected = xmlQueue.find((candidate) => candidate.originalFileName === file.originalFileName)
          ?? xmlQueue.find((candidate) => candidate.accessKey && candidate.accessKey === file.accessKey);
        if (!inspected) continue;
        const contractNumber = xmlContractNumbers[inspected.token]?.trim() || null;
        const billingObservations = xmlBillingObservations[inspected.token]?.trim() || null;
        const selectedPartnerId = vulpeScan ? xmlPartnerOverrides[inspected.token] || null : null;
        const ignore = vulpeScan ? xmlIgnoredSelections[inspected.token] === true : false;
        const deferred = xmlDeferredSelections[inspected.token] === true;
        const freightDaeEnabled = xmlFreightDaeEnabled[inspected.token] === true;
        const freightDaeAmountCents = freightDaeEnabled ? parseCurrency(xmlFreightDaeAmounts[inspected.token] ?? "") : 0;
        const freightDaeReference = freightDaeEnabled ? xmlFreightDaeReferences[inspected.token]?.trim() || null : null;
        const hasFinancialService = xmlFinancialServiceEnabled[inspected.token] === true;
        const invoiceDaeEnabled = xmlInvoiceDaeEnabled[inspected.token] === true;
        const invoiceDaeAmountCents = invoiceDaeEnabled ? parseCurrency(xmlInvoiceDaeAmounts[inspected.token] ?? "") : 0;
        const invoiceDaeReference = invoiceDaeEnabled ? xmlInvoiceDaeReferences[inspected.token]?.trim() || null : null;
        if (!ignore && freightDaeEnabled && freightDaeAmountCents <= 0) {
          setSelectedXmlToken(inspected.token);
          setMessage(`Informe um valor de DAE de frete maior que zero para a NF ${inspected.extractedData?.number ?? inspected.originalFileName}.`);
          scrollXmlIntoView(xmlDataRef);
          return;
        }
        if (!ignore && invoiceDaeEnabled && invoiceDaeAmountCents <= 0) {
          setSelectedXmlToken(inspected.token);
          setMessage(`Informe um valor de DAE da nota maior que zero para a NF ${inspected.extractedData?.number ?? inspected.originalFileName}.`);
          scrollXmlIntoView(xmlDataRef);
          return;
        }
        const fileOperationType = xmlFileOperationType(inspected.token, inspected.extractedData);
        const manualRateText = xmlManualRates[inspected.token];
        // O campo guarda so os digitos, em centavos (ex.: "150000" = R$ 1.500,00).
        const parsedManualRate = manualRateText?.trim() ? Number(manualRateText) : NaN;
        // Zero e um valor valido (ex.: nota sem cobranca); so vazio conta como "usar a regra do cliente".
        const manualRateValueCents = Number.isFinite(parsedManualRate) && parsedManualRate >= 0 ? parsedManualRate : null;
        const manualOverrideReason = manualRateValueCents !== null ? xmlManualReasons[inspected.token]?.trim() || null : null;
        if (contractNumber || billingObservations || selectedPartnerId || ignore || deferred || freightDaeAmountCents > 0 || invoiceDaeAmountCents > 0 || hasFinancialService || fileOperationType !== operationType || manualRateText !== undefined) {
          await window.operationsCafe.updateXmlImportFileResolution(file.id, {
            operationType: fileOperationType,
            manualRateValueCents,
            manualOverrideReason,
            contractNumber,
            billingObservations,
            freightDaeReference,
            freightDaeAmountCents,
            invoiceDaeReference,
            invoiceDaeAmountCents,
            hasFinancialService,
            // Sem associacao por nota, a nota usa o cliente escolhido no painel (nao grava null por cima).
            clientPartnerId: selectedPartnerId ?? (vulpeScan ? null : partnerId || null),
            ignore,
            deferred
          });
        }
      }
      const validated = await window.operationsCafe.validateXmlImportJob(added.job.id);
      setXmlJob(validated);
      setMessage("Fila XML validada.");
      await load();
      scrollXmlIntoView(xmlResultRef);
    } catch (errorValue) {
      setMessage(`Erro XML: ${errorValue instanceof Error ? errorValue.message : "falha ao validar XML."}`);
    }
  }

  // Nota adiada por enquanto (fica fora da importacao, sem ser ignorada de forma permanente).
  function xmlFileDeferredSelected(file: { token: string }): boolean {
    return xmlDeferredSelections[file.token] === true;
  }

  function xmlFileDeferred(file: XmlImportFile): boolean {
    if (!file.resolutionDataJson) return false;
    try { return (JSON.parse(file.resolutionDataJson) as { deferred?: boolean }).deferred === true; } catch { return false; }
  }

  async function setXmlFileDeferred(file: XmlImportFile, deferred: boolean): Promise<void> {
    if (!xmlJob) return;
    try {
      const updated = await window.operationsCafe.setXmlImportFileDeferred({ jobId: xmlJob.job.id, fileId: file.id, deferred });
      setXmlJob(updated);
      setMessage(deferred ? `${file.originalFileName} ignorada por enquanto. Restaure quando quiser lançar.` : `${file.originalFileName} voltou para a fila de lançamento.`);
    } catch (errorValue) {
      setMessage(`Erro XML: ${errorValue instanceof Error ? errorValue.message : "falha ao adiar a nota."}`);
    }
  }

  async function executeXmlImport(): Promise<void> {
    if (!xmlJob) return;
    const requiresCommercialPartner = xmlQueue.some((file) =>
      file.status !== "ERROR"
      && !file.xmlType.startsWith("EVENT_")
      && !xmlInspectionIsWarehouse(file)
      && !xmlDeferredSelections[file.token]
    );
    if (!partnerId && !vulpeScan && requiresCommercialPartner) {
      setMessage(operationType === "PURCHASE" ? "Selecione o fornecedor responsável antes de salvar a nota." : "Selecione o cliente/corretor responsável pela cobrança antes de salvar a nota.");
      setXmlDetailTab("cliente");
      scrollXmlIntoView(xmlDataRef);
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
      const importFile = xmlJob?.files.find((file) => file.id === fileId);
      const inspected = importFile
        ? (xmlQueue.find((candidate) => candidate.accessKey && candidate.accessKey === importFile.accessKey)
          ?? xmlQueue.find((candidate) => candidate.originalFileName === importFile.originalFileName))
        : null;
      await window.operationsCafe.updateXmlImportFileResolution(fileId, {
        clientPartnerId,
        secondaryPartnerId,
        operationType: inspected ? xmlFileOperationType(inspected.token, inspected.extractedData) : null,
        contractNumber: inspected ? xmlContractNumbers[inspected.token]?.trim() || null : null,
        billingObservations: inspected ? xmlBillingObservations[inspected.token]?.trim() || null : null,
        freightDaeReference: inspected && xmlFreightDaeEnabled[inspected.token] ? xmlFreightDaeReferences[inspected.token]?.trim() || null : null,
        freightDaeAmountCents: inspected && xmlFreightDaeEnabled[inspected.token] ? parseCurrency(xmlFreightDaeAmounts[inspected.token] ?? "") : 0,
        invoiceDaeReference: inspected && xmlInvoiceDaeEnabled[inspected.token] ? xmlInvoiceDaeReferences[inspected.token]?.trim() || null : null,
        invoiceDaeAmountCents: inspected && xmlInvoiceDaeEnabled[inspected.token] ? parseCurrency(xmlInvoiceDaeAmounts[inspected.token] ?? "") : 0,
        hasFinancialService: inspected ? xmlFinancialServiceEnabled[inspected.token] === true : false
      });
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
        const existingCompany = partnerLegalEntities.find((entity) => entity.cnpj === cnpjDigits);
        if (existingCompany) await window.operationsCafe.linkPartnerLegalEntity(existingCompany.id, clientPartnerId);
        else await window.operationsCafe.createPartnerLegalEntity({
          organizationId,
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
      setMessage("Cliente/corretor associado e empresa/apelido cadastrado. Notas de empresas com varios clientes continuarao exigindo a escolha do responsavel.");
    } catch (errorValue) {
      setMessage(`Erro XML: ${errorValue instanceof Error ? errorValue.message : "falha ao cadastrar CNPJ/alias."}`);
    }
  }

  const selectedXmlFile = xmlQueue.find((file) => file.token === selectedXmlToken) ?? xmlQueue[0] ?? null;
  // Tipo da nota: escolha do usuario > o que o XML indica > o botao geral.
  const xmlFileOperationType = (token: string, extractedData: XmlFileInspection["extractedData"]): "PURCHASE" | "SALE" =>
    xmlOperationTypeOverrides[token] ?? inferXmlOperationType(parseNfeExtractedPreview(extractedData ?? null), data.legalEntities) ?? operationType;
  const selectedXmlView = buildSelectedXmlView({ selectedXmlFile, partnerId, vulpeScan, xmlPartnerOverrides, legalEntities: data.legalEntities, ownLegalEntity, xmlScopeOverrides, scope, operationType, resolveOperationType: xmlFileOperationType });
  const { selectedXmlIsEvent, selectedXmlEvent, selectedXmlPartnerId, selectedXmlPreview, selectedWarehouseMovement, selectedXmlExtractedContract, selectedXmlParties, selectedXmlItem, selectedXmlSacks, selectedXmlInferredScope, selectedXmlScope, selectedXmlOperationType, selectedXmlOwnMismatch } = selectedXmlView;
  const hasValidXmlSelection = xmlQueue.some((file) => file.status !== "ERROR");
  const xmlQueueRequiresCommercialPartner = xmlQueue.some((file) =>
    file.status !== "ERROR"
    && !file.xmlType.startsWith("EVENT_")
    && !xmlInspectionIsWarehouse(file)
    && !xmlDeferredSelections[file.token]
  );
  const xmlQueueHasWarehouseMovement = xmlQueue.some((file) => file.status !== "ERROR" && xmlInspectionIsWarehouse(file));
  const xmlBatchRows = xmlQueue.map((file) => {
    const preview = parseNfeExtractedPreview(file.extractedData ?? null);
    const parties = resolveOwnAndCounterparty(preview, data.legalEntities);
    const firstItem = preview?.items[0] ?? null;
    const inferredScope = inferXmlOperationScope(preview);
    const assignedPartner = partners.find((partner) => partner.id === xmlPartnerOverrides[file.token]);
    const warehouseMovement = classifyWarehouseXml(preview);
    return {
      file,
      preview,
      parties,
      firstItem,
      operationScope: inferredScope ?? xmlScopeOverrides[file.token] ?? scope,
      classificationLabel: file.xmlType.startsWith("EVENT_")
        ? "Cancelamento"
        : xmlIgnoredSelections[file.token] && warehouseMovement
          ? "Não cadastrar"
        : warehouseMovement
          ? `${warehouseMovement.movementType === "RETURN" ? "Retorno" : "Remessa"} ${warehouseMovement.movementKind === "SYMBOLIC" ? "simbolica" : "fisica"}`
        : xmlIgnoredSelections[file.token]
          ? "Não cadastrar"
          : assignedPartner?.displayName ?? "Escolher cliente"
    };
  });
  const validXmlBatchRows = xmlBatchRows.filter((row) => row.file.status !== "ERROR");
  // Remessas/retornos simbolicos de armazem: so movimentam estoque no papel e
  // muitas vezes nao interessam. Podem ser marcadas para nao cadastrar.
  const symbolicWarehouseTokens = xmlQueue
    .filter((file) => file.status !== "ERROR" && classifyWarehouseXml(parseNfeExtractedPreview(file.extractedData ?? null))?.movementKind === "SYMBOLIC")
    .map((file) => file.token);
  const allSymbolicIgnored = symbolicWarehouseTokens.length > 0 && symbolicWarehouseTokens.every((token) => xmlIgnoredSelections[token] === true);
  function setSymbolicWarehouseIgnored(ignored: boolean): void {
    setXmlJob(null);
    setXmlIgnoredSelections((current) => ({ ...current, ...Object.fromEntries(symbolicWarehouseTokens.map((token) => [token, ignored])) }));
  }

  const xmlJobStatus = xmlJob?.job.status;
  const visibleXmlJobFiles = xmlJob?.files.filter((file) => !xmlImportFileIsVisuallyDeleted(file)) ?? [];
  const visibleXmlJob = xmlJob && !xmlImportIsVisuallyDeleted(xmlJob.job) && visibleXmlJobFiles.length > 0
    ? { ...xmlJob, files: visibleXmlJobFiles }
    : null;
  const visibleXmlHistory = xmlHistory.filter((job) => !xmlImportIsVisuallyDeleted(job));
  const xmlImportSteps: StepperStep[] = [
    { id: "import", label: "Importar arquivo", status: xmlQueue.length > 0 ? "complete" : "current" },
    { id: "read", label: "Leitura automatica", status: xmlQueue.length > 0 ? "complete" : "pending" },
    { id: "rule", label: xmlQueueHasWarehouseMovement && !xmlQueueRequiresCommercialPartner ? "Reconhecer armazem" : "Aplicar regra", status: xmlJob ? "complete" : xmlQueue.length > 0 ? "current" : "pending" },
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
  // Nota triangulada: a mesma nota gerou uma operacao de compra (fornecedor)
  // e uma de venda (corretor/cliente) a partir da mesma remessa.
  const allKnownPartners = [...partners, ...secondaryPartners];
  const partnerName = (id: string | null | undefined): string => (id ? allKnownPartners.find((partner) => partner.id === id)?.displayName ?? id : "-");

  // Procura nos clientes e nos fornecedores: nota de compra (ou com o responsavel
  // trocado para fornecedor) mostrava o id do parceiro em vez do nome.
  const documentClientName = (document: FiscalDocument): string =>
    allKnownPartners.find((partner) => partner.id === document.responsiblePartnerId)?.displayName ??
    document.responsiblePartnerId ??
    "";
  // Diferencia na lista nota de cliente (venda) e de fornecedor (compra).
  const documentPartyKind = (document: FiscalDocument): { label: string; tone: "client" | "supplier" | "both" } | null => {
    if (document.secondaryResponsiblePartnerId) return { label: "Triangulada", tone: "both" };
    if (document.direction === "INBOUND") return { label: "Fornecedor", tone: "supplier" };
    if (document.direction === "OUTBOUND") return { label: "Cliente", tone: "client" };
    return null;
  };

  // Dados de exibicao de uma linha da tabela de notas lancadas (regras de sempre).
  function documentRowView(doc: FiscalDocument): FiscalDocumentRowView {
        const info = documentServiceInfo[doc.id];
        const serviceLabel = info ? `${formatCurrencyFromCents(info.serviceCents)}${info.rateCents !== null ? ` (${formatCurrencyFromCents(info.rateCents)}/saca)` : ""}` : "-";
        const alertLabel = info?.missingRate ? "Sem valor por saca" : doc.hasPendingIssues && doc.pendingNotes ? doc.pendingNotes : doc.duplicateWarning ?? "-";
        // Nota terceirizada aparece aqui mesmo com CNPJ emissor diferente do
        // ativo no topo (ver listFiscalDocuments) -- mostra a empresa
        // emissora real pra nao parecer que a nota e' do CNPJ ativo.
        const isThirdPartyRow = doc.ownLegalEntityId !== ownLegalEntityId;
        const docOwnEntity = isThirdPartyRow ? data.legalEntities.find((entity) => entity.id === doc.ownLegalEntityId) : null;
        // Nota triangulada de verdade (secondaryResponsiblePartnerId
        // preenchido): a compra e a venda pertencem mesmo a nossa empresa
        // ativa (e' assim que ela entra na cobranca certinho), mas o papel
        // fisico da NF nunca passou pelo nosso CNPJ -- entao mesmo sem cair
        // no caso "terceirizada" acima, ainda mostra quem emitiu de
        // verdade (o fornecedor por tras da ponta de compra).
        const triangulatedIssuer = !isThirdPartyRow && doc.secondaryResponsiblePartnerId
          ? partnerLegalEntities.find((entity) => entity.id === doc.partnerLegalEntityId)
          : null;
        const docOwnEntityName = docOwnEntity
          ? (docOwnEntity.legalName || docOwnEntity.tradeName)
          : triangulatedIssuer
            ? (triangulatedIssuer.legalName || triangulatedIssuer.tradeName)
            : null;
        const partyKind = documentPartyKind(doc);
        // Estado visual da linha: cancelada > duplicada > pendente.
        const rowState = doc.status === "CANCELED" ? "canceled" : doc.duplicateWarning ? "duplicate" : (doc.hasPendingIssues || info?.missingRate) ? "pending" : null;
    return { ownEntityName: docOwnEntityName, partyKind, clientName: documentClientName(doc), serviceLabel, alertLabel, rowState };
  }
  function toggleDocumentSort(key: DocumentSortKey): void {
    setDocumentLimit(20);
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
      document.contractNumber ?? "",
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

  const canceledDocumentsCount = documents.filter((document) => document.status === "CANCELED").length;
  const filteredDocuments = documents
    .filter((document) => showCanceledDocuments || document.status !== "CANCELED")
    .filter(documentMatchesSearch);

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
  const visibleDocuments = sortedDocuments.slice(0, documentLimit);

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
          { id: "received", label: "Notas recebidas" },
          { id: "issued", label: "Notas emitidas" },
          { id: "documents", label: "Lancamento manual" },
          { id: "spreadsheets", label: "Planilhas" }
        ]}
        onChange={(nextTab) => {
          const next = nextTab as OperationsPageTab;
          if (next === "documents" && (pageTab === "received" || pageTab === "issued")) {
            setOperationType(pageTab === "received" ? "PURCHASE" : "SALE");
            setPartnerId("");
            setManualCounterpartyLegalEntityId("");
          }
          const changedDirection = (pageTab === "received" || pageTab === "issued") && (next === "received" || next === "issued") && pageTab !== next;
          if (changedDirection) {
            setVulpeScan(null);
            setXmlSelections([]);
            setXmlQueue([]);
            setXmlJob(null);
            setSelectedXmlToken(null);
          }
          setPageTab(next);
        }}
      />
      {pageTab === "documents" && <>
      <AdminBlock title="Lancamento manual de nota">
      <ManualFiscalDocumentForm form={manualForm} documents={documents} ownLegalEntity={ownLegalEntity} partners={partners} secondaryPartners={secondaryPartners} partnerLegalEntities={partnerLegalEntities} visibleServiceCents={visibleServiceCents} onCreate={() => void createDocument()} />
        <div className="toolbar document-search-toolbar">
          <TextField
            label="Pesquisar notas por numero, contrato, cliente, empresa ou CNPJ"
            value={documentSearch}
            onChange={(value) => { setDocumentSearch(value); setDocumentLimit(20); }}
          />
          {documentSearch ? (
            <button type="button" onClick={() => setDocumentSearch("")}>Limpar</button>
          ) : null}
          {canceledDocumentsCount > 0 ? (
            <button type="button" onClick={() => { setShowCanceledDocuments((current) => !current); setDocumentLimit(20); }}>
              {showCanceledDocuments ? "Ocultar canceladas" : `Ver ${canceledDocumentsCount} cancelada(s)`}
            </button>
          ) : null}
          <span className="muted">
            Exibindo {Math.min(visibleDocuments.length, filteredDocuments.length)} de {filteredDocuments.length} nota(s){!showCanceledDocuments && canceledDocumentsCount > 0 ? ` · ${canceledDocumentsCount} cancelada(s) oculta(s)` : filteredDocuments.length !== documents.length ? ` filtradas de ${documents.length}` : ""}
          </span>
        </div>
        <FiscalDocumentsTable
          rows={visibleDocuments.map((doc) => ({ doc, view: documentRowView(doc) }))}
          sort={documentSort}
          onSort={toggleDocumentSort}
          sortIndicator={documentSortIndicator}
          onOpen={(documentId) => { window.operationsCafe.getFiscalDocument(documentId).then((opened) => { setDetail(opened); scrollTo(manualDetailRef); }); }}
          onDelete={(doc) => { void deleteDocument(doc); }}
        >
        {sortedDocuments.length === 0 ? (
          <EmptyState
            title="Nenhuma nota encontrada"
            description={documentSearch ? "Tente pesquisar por outro numero, cliente, empresa ou CNPJ." : canceledDocumentsCount > 0 && !showCanceledDocuments ? "Nao ha notas ativas nesta lista. Use 'Ver canceladas' para consultar o historico." : "Nenhuma nota cadastrada para este CNPJ."}
          />
        ) : null}
        </FiscalDocumentsTable>
        {visibleDocuments.length < sortedDocuments.length ? <button type="button" className="documents-show-more" onClick={() => setDocumentLimit((current) => current + 20)}>Mostrar mais notas</button> : null}
      </AdminBlock>
      {detail ? <div ref={manualDetailRef}>
        <FiscalDocumentDetailPanel detail={detail} state={detailState} message={message} operationType={operationType} setMessage={setMessage} setDetail={setDetail} products={products} partners={partners} secondaryPartners={secondaryPartners} partnerLegalEntities={partnerLegalEntities} partnerName={partnerName} onReload={load} onAddItem={addItemAndOperation} onCompleteTriangulation={completeDetailTriangulation} onDelete={deleteCurrentDocument} onLinkCompany={linkCompanyToDocument} onOverrideFirstOperation={overrideFirstOperation} onSavePackagingUnitValue={savePackagingUnitValue} />
      </div> : null}
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
      {(pageTab === "received" || pageTab === "issued") && <>
      <AdminBlock title={pageTab === "received" ? "Notas recebidas de fornecedores" : "Notas emitidas para clientes"}>
        <div className={`notes-direction-hero notes-direction-hero--${pageTab}`}>
          <div className="notes-direction-hero__icon" aria-hidden="true">{pageTab === "received" ? "↓" : "↑"}</div>
          <div>
            <span>{pageTab === "received" ? "ENTRADAS / COMPRAS" : "SAIDAS / VENDAS"}</span>
            <strong>{pageTab === "received" ? "Localize as notas que fornecedores emitiram para cada uma das suas empresas." : "Localize as notas emitidas por cada uma das suas empresas."}</strong>
            <small>{pageTab === "received" ? "O nome e o CNPJ exato do fornecedor ficam visiveis antes do lancamento." : "O cliente e o CNPJ destinatario ficam visiveis antes do lancamento."}</small>
          </div>
        </div>
        <NotesSearchPanel available={vulpeDevAvailable} pageTab={pageTab} vulpeDevSources={vulpeDevSources} vulpePeriodStart={vulpePeriodStart} vulpePeriodEnd={vulpePeriodEnd} setVulpePeriodStart={setVulpePeriodStart} setVulpePeriodEnd={setVulpePeriodEnd} vulpeScan={vulpeScan} setVulpeScan={setVulpeScan} collectorStatuses={collectorStatuses} setCollectorStatuses={setCollectorStatuses} collectorMonitorError={collectorMonitorError} setCollectorMonitorError={setCollectorMonitorError} collectorCommandBusy={collectorCommandBusy} onCollectorCommand={sendCollectorCommand} setMessage={setMessage} onPrepareSource={prepareVulpeDevImport} />
        <div className="xml-stepper-top">
          <Stepper activeId={xmlImportSteps.find((step) => step.status === "current")?.id ?? "save"} steps={xmlImportSteps} />
        </div>
        <div className="import-columns">
          <div className="import-column import-column--queue" ref={xmlDataRef}>
            <XmlImportQueue pageTab={pageTab} partnerId={partnerId} includeXmlSubfolders={includeXmlSubfolders} setIncludeXmlSubfolders={setIncludeXmlSubfolders} xmlQueue={xmlQueue} xmlDeferredSelections={xmlDeferredSelections} setXmlDeferredSelections={setXmlDeferredSelections} selectedXmlFile={selectedXmlFile} setSelectedXmlToken={setSelectedXmlToken} xmlQueueHasWarehouseMovement={xmlQueueHasWarehouseMovement} xmlQueueRequiresCommercialPartner={xmlQueueRequiresCommercialPartner} hasValidXmlSelection={hasValidXmlSelection} vulpeScan={vulpeScan} onPrepareDropped={prepareDroppedXmlImport} onPrepare={prepareXmlImport} onValidate={validateXmlImport} />
          </div>

          <div className="import-column">
            <XmlImportDataColumn selectedXmlFile={selectedXmlFile} view={selectedXmlView} xml={xmlState} setMessage={setMessage} />
          </div>

          <div className="import-column">
            <h3><ListStepsIcon /> Cliente e operação</h3>
            {selectedWarehouseMovement ? (
              <p className="muted">Movimentações de armazém são registradas somente no controle de cafés armazenados e não passam pelas regras comerciais.</p>
            ) : (
              <>
                <label><input type="checkbox" checked={reviewBeforeConfirm} onChange={(event) => { setReviewBeforeConfirm(event.target.checked); setXmlJob(null); }} /> Revisar comissão e contrato antes de confirmar</label>
                <p className="muted">A revisão é opcional. Notas com cliente, tarifa e contrato exigido preenchidos entram na cobrança sem confirmação individual.</p>
              </>
            )}
            {selectedXmlIsEvent ? (
              <div className="operation-warning-card operation-warning-card--neutral">
                <strong>Evento de cancelamento</strong>
                <span>Ao concluir a fila, o sistema registra o evento e cancela automaticamente a nota e suas operacoes, quando a chave ja estiver cadastrada.</span>
              </div>
            ) : selectedWarehouseMovement ? (
              <div className="operation-warning-card operation-warning-card--neutral">
                <strong>{selectedWarehouseMovement.movementType === "RETURN" ? "Retorno de armazem reconhecido" : "Remessa para armazem reconhecida"}</strong>
                <span>
                  {selectedWarehouseMovement.movementType === "RETURN"
                    ? `Ao importar, o sistema descontara ${decimalTextBr(selectedXmlSacks)} sacas do estoque mantido em ${selectedXmlParties.issuerLabel ?? "armazem identificado no XML"}.`
                    : `Ao importar, o sistema acrescentara ${decimalTextBr(selectedXmlSacks)} sacas ao estoque mantido em ${selectedXmlParties.recipientLabel ?? "armazem identificado no XML"}.`}
                </span>
                <span>CFOP {selectedWarehouseMovement.cfops.join(", ")} · movimentacao {selectedWarehouseMovement.movementKind === "SYMBOLIC" ? "simbolica" : "fisica"}. Nao sera criada compra, venda ou cobranca.</span>
                {vulpeScan && selectedXmlFile ? (
                  <label className="inline-check">
                    <input
                      type="checkbox"
                      checked={xmlIgnoredSelections[selectedXmlFile.token] === true}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setXmlJob(null);
                        setXmlIgnoredSelections((current) => ({ ...current, [selectedXmlFile.token]: checked }));
                      }}
                    />
                    Não cadastrar esta nota (nao mexe no estoque do armazem) nem mostrar novamente nas buscas
                  </label>
                ) : null}
              </div>
            ) : (
              <>
                <FormGrid>
                  <PartnerQuickSearch
                    label={operationType === "PURCHASE" ? "Fornecedor responsável pela nota" : "Cliente/corretor responsável pela cobrança"}
                    value={selectedXmlPartnerId}
                    onChange={(value) => {
                      setXmlJob(null);
                      if (vulpeScan && selectedXmlFile) {
                        setXmlPartnerOverrides((current) => ({ ...current, [selectedXmlFile.token]: value }));
                        if (value) setXmlIgnoredSelections((current) => ({ ...current, [selectedXmlFile.token]: false }));
                      } else {
                        setPartnerId(value);
                      }
                    }}
                    partners={partners}
                    legalEntities={partnerLegalEntities}
                  />
                  <div className="xml-segment">
                    <span className="xml-segment__label">Compra/venda</span>
                    <div className="xml-segment__options" role="group" aria-label="Compra ou venda">
                      {(["PURCHASE", "SALE"] as const).map((value) => (
                        <button key={value} type="button" className={selectedXmlOperationType === value ? "active" : ""} onClick={() => { if (selectedXmlFile) setXmlOperationTypeOverrides((current) => ({ ...current, [selectedXmlFile.token]: value })); setOperationType(value); }}>{value === "PURCHASE" ? "Compra" : "Venda"}</button>
                      ))}
                    </div>
                  </div>
                  <div className="xml-segment">
                    <span className="xml-segment__label">UF da operação</span>
                    <div className="xml-segment__options" role="group" aria-label="UF da operação">
                      {OPERATION_SCOPE_OPTIONS.filter(([value]) => value !== "ALL").map(([value, label]) => (
                        <button key={value} type="button" className={selectedXmlScope === value ? "active" : ""} onClick={() => { if (selectedXmlFile) setXmlScopeOverrides((current) => ({ ...current, [selectedXmlFile.token]: value })); setScope(value); }}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="xml-segment xml-manual-rate">
                    <span className="xml-segment__label">Valor por saca desta nota</span>
                    <input inputMode="numeric" disabled={!selectedXmlFile} placeholder="Vazio = valor da regra do cliente" value={selectedXmlFile && xmlManualRates[selectedXmlFile.token] ? formatCurrencyFromCents(Number(xmlManualRates[selectedXmlFile.token])) : ""} onChange={(event) => { if (!selectedXmlFile) return; setXmlJob(null); const digits = event.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""); setXmlManualRates((current) => ({ ...current, [selectedXmlFile.token]: digits })); }} />
                    {selectedXmlFile && xmlManualRates[selectedXmlFile.token]?.trim() ? (
                      <input placeholder="Motivo (obrigatório), ex.: acordo com o cliente" value={xmlManualReasons[selectedXmlFile.token] ?? ""} onChange={(event) => { setXmlJob(null); setXmlManualReasons((current) => ({ ...current, [selectedXmlFile.token]: event.target.value })); }} />
                    ) : null}
                  </div>
                </FormGrid>
                {vulpeScan && selectedXmlFile ? (
                  <label className="inline-check">
                    <input
                      type="checkbox"
                      checked={xmlIgnoredSelections[selectedXmlFile.token] === true}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setXmlJob(null);
                        setXmlIgnoredSelections((current) => ({ ...current, [selectedXmlFile.token]: checked }));
                        if (checked) setXmlPartnerOverrides((current) => ({ ...current, [selectedXmlFile.token]: "" }));
                      }}
                    />
                    Não cadastrar esta nota nem mostrar novamente nas buscas da Vulpe
                  </label>
                ) : null}
              </>
            )}
          </div>
        </div>
            {xmlQueue.length ? (
            <div className="xml-action-footer">
              <span className="muted">{xmlQueue.length} nota(s) na fila{selectedXmlFile && xmlFileDeferredSelected(selectedXmlFile) ? " · nota selecionada adiada por enquanto" : ""}</span>
              <div className="xml-action-footer__buttons">
              <button onClick={() => { setXmlSelections([]); setXmlQueue([]); setXmlJob(null); setXmlScopeOverrides({}); setXmlManualRates({}); setXmlManualReasons({}); setXmlPartnerOverrides({}); setXmlIgnoredSelections({}); setXmlDeferredSelections({}); setXmlContractNumbers({}); setXmlBillingObservations({}); setXmlFreightDaeEnabled({}); setXmlFreightDaeReferences({}); setXmlFreightDaeAmounts({}); setXmlFinancialServiceEnabled({}); setXmlInvoiceDaeEnabled({}); setXmlInvoiceDaeReferences({}); setXmlInvoiceDaeAmounts({}); setSelectedXmlToken(null); setVulpeScan(null); }} disabled={xmlQueue.length === 0}>Cancelar importação</button>
              <button className="primary" onClick={() => void executeXmlImport()} disabled={!xmlJob || (!partnerId && !vulpeScan && xmlQueueRequiresCommercialPartner)}>
                {xmlQueueHasWarehouseMovement && !xmlQueueRequiresCommercialPartner ? "Importar movimentação" : "Importar XMLs"}
              </button>
              </div>
            </div>
            ) : null}
        {xmlQueue.length ? (
          <div className="xml-batch-review">
            <div className="section-title-row">
              <div>
                <h3>Revisão da fila</h3>
                <p className="muted">Confira todos os XMLs antes de validar e salvar. Clique em uma linha para ver os detalhes completos ao lado.</p>
              </div>
              <span className="summary-pill">{validXmlBatchRows.length} de {xmlQueue.length} pronto(s)</span>
            </div>
            {vulpeScan && symbolicWarehouseTokens.length > 0 ? (
              <div className="toolbar">
                <button type="button" onClick={() => setSymbolicWarehouseIgnored(!allSymbolicIgnored)}>
                  {allSymbolicIgnored
                    ? `Voltar a cadastrar as ${symbolicWarehouseTokens.length} remessa(s) simbolica(s)`
                    : `Não cadastrar as ${symbolicWarehouseTokens.length} remessa(s) simbolica(s)`}
                </button>
              </div>
            ) : null}
            <div className="table">
              <div className="table-head xml-batch-grid"><span>Arquivo / NF</span><span>Origem</span><span>Destinatário fiscal</span><span>Produto</span><span>Sacas</span><span>UF</span><span>Classificacao</span></div>
              {xmlBatchRows.map((row) => (
                <button
                  key={row.file.token}
                  type="button"
                  className={`table-row xml-batch-grid xml-batch-row ${row.file.token === selectedXmlFile?.token ? "active" : ""}`}
                  onClick={() => setSelectedXmlToken(row.file.token)}
                >
                  <span><strong>{row.file.originalFileName}</strong><small>NF {row.preview?.number ?? "-"} · {row.preview?.issuedAt ? formatDateBr(row.preview.issuedAt) : "data nao lida"}</small></span>
                  <span><strong>{row.parties.originLabel}</strong><small>{row.parties.isThirdPartyOrigin ? "Terceirizada/externa" : "CNPJ proprio"}</small></span>
                  <span>{row.parties.recipientLabel ?? row.parties.issuerLabel ?? "Não identificado"}</span>
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
                  <span><strong>{row.classificationLabel}</strong><small><StatusBadge status={row.file.status} /></small></span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div ref={xmlResultRef}>
        {visibleXmlJob ? (
          <div className="section-title-row xml-result-actions">
            <div>
              <h3>Resultado da importação XML</h3>
              <p className="muted">Use o historico para revisar importacoes anteriores. Se o XML ainda nao virou nota, exclua a importacao inteira.</p>
            </div>
            <div className="actions">
              <button onClick={() => scrollTo(xmlHistoryRef)}>Ver histórico</button>
              <button className="danger" disabled={!xmlImportCanBeReverted(visibleXmlJob.job)} onClick={() => void removeXmlImportJob()}>Excluir/Reverter importacao</button>
            </div>
          </div>
        ) : null}
        {visibleXmlJob ? <div className="cards"><article><span>Arquivos</span><strong>{visibleXmlJob.files.length}</strong></article><article><span>Validos</span><strong>{visibleXmlJob.files.filter((file) => file.status === "VALID" || file.status === "IMPORTED").length}</strong></article><article><span>Eventos</span><strong>{visibleXmlJob.job.importedEvents}</strong></article><article><span>Notas</span><strong>{visibleXmlJob.files.filter((file) => file.fiscalDocumentId).length}</strong></article><article><span>Erros</span><strong>{visibleXmlJob.files.filter((file) => file.status === "ERROR").length}</strong></article><article><span>Itens sem operacao</span><strong>{visibleXmlJob.job.itemsWithoutOperation}</strong></article></div> : null}
        {visibleXmlJob ? (
          <div className="table">
            <div className="table-head xml-files-grid"><span>Arquivo</span><span>Status</span><span>Tipo</span><span>Chave</span><span>Detalhe</span><span>Acoes</span></div>
            {visibleXmlJob.files.filter((file) => !xmlFileDeferred(file)).map((file) => (
              <div key={file.id} className="table-row xml-files-grid">
                <span>{file.originalFileName}</span>
                <span><StatusBadge status={file.status} label={xmlFileStatusLabel(file)} /></span>
                <span>{file.xmlType}</span>
                <span>{file.accessKey ?? "-"}</span>
                <span>{xmlFileDetailMessage(file)}</span>
                <span className="row-actions">
                  {["VALID", "WARNING", "PENDING_REVIEW", "DUPLICATE"].includes(file.status) ? <button onClick={() => void setXmlFileDeferred(file, true)}>Ignorar por enquanto</button> : null}
                  {file.fiscalDocumentId ? <button onClick={() => void window.operationsCafe.getFiscalDocument(file.fiscalDocumentId as string).then((opened) => { setDetail(opened); setPageTab("documents"); scrollTo(manualDetailRef); })}>Abrir nota</button> : <small className="muted">Nota ainda não salva</small>}
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
        {visibleXmlJob && visibleXmlJob.files.some((file) => xmlFileDeferred(file)) ? (
          <div className="table xml-deferred-block">
            <p className="muted">Ignoradas por enquanto ({visibleXmlJob.files.filter((file) => xmlFileDeferred(file)).length}). Restaure para voltar à fila de lançamento.</p>
            <div className="table-head xml-files-grid"><span>Arquivo</span><span>Status</span><span>Tipo</span><span>Chave</span><span>Detalhe</span><span>Acoes</span></div>
            {visibleXmlJob.files.filter((file) => xmlFileDeferred(file)).map((file) => (
              <div key={file.id} className="table-row xml-files-grid xml-row--deferred">
                <span>{file.originalFileName}</span>
                <span><StatusBadge status={file.status} label={xmlFileStatusLabel(file)} /></span>
                <span>{file.xmlType}</span>
                <span>{file.accessKey ?? "-"}</span>
                <span>{xmlFileDetailMessage(file)}</span>
                <span className="row-actions"><button onClick={() => void setXmlFileDeferred(file, false)}>Restaurar</button></span>
              </div>
            ))}
          </div>
        ) : null}
        {visibleXmlJob && visibleXmlJob.files.some((file) => file.status === "PENDING_REVIEW" && !xmlFileDeferred(file)) ? (
          <div className="table">
            <div className="table-head xml-resolution-grid"><span>Arquivo</span><span>Status</span><span>Emitente</span><span>Destinatário</span><span>Associar cliente/corretor</span><span>Segundo parceiro (nota triangulada)</span><span>Acoes</span></div>
            {visibleXmlJob.files.filter((file) => file.status === "PENDING_REVIEW" && !xmlFileDeferred(file)).map((file) => {
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
      {pageTab === "issued" ? <NumberingAudit legalEntities={data.legalEntities} periodStart={vulpePeriodStart} periodEnd={vulpePeriodEnd} onPeriodChange={(start, end) => { setVulpePeriodStart(start); setVulpePeriodEnd(end); setVulpeScan(null); }} /> : null}
      <div ref={xmlHistoryRef}>
        <XmlImportHistory jobs={visibleXmlHistory} limit={xmlHistoryLimit} canRevert={xmlImportCanBeReverted} onShowMore={() => setXmlHistoryLimit((current) => current + 15)} onDetail={(jobId) => void openXmlImportJob(jobId)} onRevert={(jobId) => void removeXmlImportJob(jobId)} />
      </div>
      </>}
      <Feedback message={message} />
    </section>
  );
}
