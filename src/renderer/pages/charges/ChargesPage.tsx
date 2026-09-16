import { chargePeriodLabel } from "../../../shared/utils/chargeLabel";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { BillingPeriodicity, BillingSummary, BootstrapData, BusinessPartner, BusinessPartnerLegalEntity, ClientCharge, ClientChargeDetail, ClientChargeOperation, ClientLedgerEntry, ClientPayment, FiscalDocument, LegalEntity, Operation, PartnerRateSummaryRow } from "../../../shared/types/domain";
import { formatCurrencyFromCents, formatCurrencyInput, formatDateOnlyBr, formatDateTimeBr, parseCurrencyToCents } from "../../../shared/utils/format";
import { DateInput, EmptyState, Input, PageHeader, Tabs } from "../../design-system";
import { Feedback } from "../../components/feedback/Feedback";
import { PartnerQuickSearch } from "../../components/forms/PartnerQuickSearch";
import { AdminBlock, FormGrid } from "../../components/layout/SectionPrimitives";
import { requestDecision, requestTextInput } from "../../utils/dialogs";
import { useAutoScroll } from "../../hooks/useAutoScroll";
import { formatOperationScope } from "../../../shared/utils/operationLabels";
import { fiscalDocumentCounterpartyNameFromSnapshot } from "../../../shared/utils/fiscalDocumentLabels";
import { formatCombinedStatusLabel, formatStatusLabel } from "../../../shared/utils/statusLabels";
import { sumDecimalTexts } from "../../../shared/utils/decimal";
import { adjustedChargeTotal } from "../../../shared/utils/chargePeriodTotal";
import { chargeCompanyClass } from "../../../shared/utils/chargeCompanyClass";

function decimalTextBr(value: string | null | undefined): string {
  return value ? value.replace(".", ",") : "0";
}

const PERIODICITY_ITEMS: Array<{ id: BillingPeriodicity; label: string }> = [
  { id: "WEEKLY", label: "Semanal" },
  { id: "MONTHLY", label: "Mensal" },
  { id: "BIWEEKLY", label: "Quinzenal" }
];

const INCLUDE_ALL_COMPANIES_IN_CHARGES = true;

function localDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentBillingRange(periodicity: BillingPeriodicity): { periodStart: string; periodEnd: string; label: string } {
  const today = new Date();
  const start = new Date(today);
  if (periodicity === "WEEKLY") {
    const daysSinceMonday = (today.getDay() + 6) % 7;
    start.setDate(today.getDate() - daysSinceMonday);
    const end = new Date(start);
    end.setDate(start.getDate() + 4);
    return { periodStart: localDateInputValue(start), periodEnd: localDateInputValue(end), label: "semana atual" };
  }
  if (periodicity === "BIWEEKLY") {
    start.setDate(today.getDate() <= 15 ? 1 : 16);
    return { periodStart: localDateInputValue(start), periodEnd: localDateInputValue(today), label: "quinzena atual" };
  }
  start.setDate(1);
  return { periodStart: localDateInputValue(start), periodEnd: localDateInputValue(today), label: "mes atual" };
}

export function ChargesPage({ data }: { data: BootstrapData }): JSX.Element {
  const organizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "";
  const ownLegalEntityId = data.profile?.defaultLegalEntityId ?? data.legalEntities.find((item) => item.organizationId === organizationId)?.id ?? "";
  const includeAllCompanies = INCLUDE_ALL_COMPANIES_IN_CHARGES;
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [partnerLegalEntities, setPartnerLegalEntities] = useState<BusinessPartnerLegalEntity[]>([]);
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>(data.legalEntities);
  const [charges, setCharges] = useState<ClientCharge[]>([]);
  const [bankEditor, setBankEditor] = useState<LegalEntity | null>(null);
  const [savingBank, setSavingBank] = useState(false);
  useEffect(() => { setBankEditor(null); }, [ownLegalEntityId]);
  async function saveBankDetails(): Promise<void> {
    if (!bankEditor) return;
    setSavingBank(true);
    try {
      await window.operationsCafe.updateLegalEntity(bankEditor.id, bankEditor);
      setLegalEntities(await window.operationsCafe.listLegalEntities({ status: "all" }));
      setBankEditor(null);
      setMessage("Dados para pagamento salvos para esta empresa. Serao usados nos proximos PDFs gerados.");
    } catch (error) { setMessage(`Erro ao salvar dados bancarios: ${error instanceof Error ? error.message : "Falha inesperada"}`); }
    finally { setSavingBank(false); }
  }
  const [eligible, setEligible] = useState<Operation[]>([]);
  const [exportingPartnerId, setExportingPartnerId] = useState<string | null>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const selectedOperations = eligible.filter((operation) => selectedNoteIds.has(operation.fiscalDocumentId));
  const availableNoteIds = Array.from(new Set(eligible.map((operation) => operation.fiscalDocumentId)));
  const selectedNoteCount = new Set(selectedOperations.map((operation) => operation.fiscalDocumentId)).size;
  function toggleNote(documentId: string): void {
    setSelectedNoteIds((current) => {
      const next = new Set(current);
      if (next.has(documentId)) next.delete(documentId); else next.add(documentId);
      return next;
    });
  }

  const [clientPeriodOperations, setClientPeriodOperations] = useState<Operation[]>([]);
  const [operationDocuments, setOperationDocuments] = useState<Record<string, FiscalDocument>>({});
  const [detail, setDetail] = useState<ClientChargeDetail | null>(null);
  const [selectedPaymentOperationIds, setSelectedPaymentOperationIds] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [partnerSummary, setPartnerSummary] = useState<PartnerRateSummaryRow[]>([]);
  const [partnerSummarySearch, setPartnerSummarySearch] = useState("");
  const [includeAlreadyBilled, setIncludeAlreadyBilled] = useState(false);
  const [clientId, setClientId] = useState("");
  const [periodicity, setPeriodicity] = useState<BillingPeriodicity>("MONTHLY");
  const [periodStart, setPeriodStart] = useState(() => currentBillingRange("MONTHLY").periodStart);
  const [periodEnd, setPeriodEnd] = useState(() => localDateInputValue(new Date()));
  const [dueDate, setDueDate] = useState(() => localDateInputValue(new Date()));
  const [advanceInput, setAdvanceInput] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [surchargeInput, setSurchargeInput] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [clientCredits, setClientCredits] = useState<ClientLedgerEntry[]>([]);
  const [clientSurcharges, setClientSurcharges] = useState<ClientLedgerEntry[]>([]);
  const ledgerAutofillChargeIdRef = useRef<string | null>(null);
  const ledgerAutofillClientIdRef = useRef<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<ClientPayment | null>(null);
  const [chargeReceipts, setChargeReceipts] = useState<ClientPayment[]>([]);
  const [searchedOperations, setSearchedOperations] = useState(false);
  const [chargesTab, setChargesTab] = useState<"gerar" | "resumo" | "historico">("gerar");
  const scrollTo = useAutoScroll();
  const operationsRef = useRef<HTMLDivElement | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const clients = await window.operationsCafe.listBusinessPartners({ role: "CLIENT", status: "active" });
    setPartners(clients);
    // Empresas/CNPJs sem cliente/corretor dono (cadastradas direto em
    // "Empresas e CNPJs") nao aparecem percorrendo os parceiros -- precisa
    // buscar as soltas separadamente e juntar, senao a coluna "Empresa" desta
    // tela mostra "Nao identificado" mesmo pra nota ja vinculada a uma dessas
    // empresas (ver mesmo padrao em PartnersPage/OperationsPage).
    const [linkedLegalEntities, unlinkedLegalEntities] = await Promise.all([
      Promise.all(clients.map((partner) => window.operationsCafe.listPartnerLegalEntities(partner.id))),
      organizationId ? window.operationsCafe.listUnlinkedPartnerLegalEntities(organizationId) : Promise.resolve([])
    ]);
    setPartnerLegalEntities([...linkedLegalEntities.flat(), ...unlinkedLegalEntities]);
    setLegalEntities(await window.operationsCafe.listLegalEntities({ status: "all" }));
    setCharges(await window.operationsCafe.listClientCharges({ status: "all" }));
  }, [organizationId, includeAllCompanies]);

  useEffect(() => { void load(); }, [load]);
  const summaryRequestRef = useRef(0);
  useEffect(() => {
    const request = ++summaryRequestRef.current;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) || periodStart > periodEnd) {
      setSummary(null);
      return;
    }
    setSummary(null);
    void window.operationsCafe.getBillingSummary({ organizationId, includeAllCompanies, periodStart, periodEnd })
      .then((nextSummary) => { if (request === summaryRequestRef.current) setSummary(nextSummary); })
      .catch((error) => { if (request === summaryRequestRef.current) setMessage(`Erro ao calcular os totais do periodo: ${error instanceof Error ? error.message : "Falha inesperada"}`); });
  }, [organizationId, includeAllCompanies, periodStart, periodEnd]);
  useEffect(() => {
    // Uma cobranca aberta exige uma escolha explicita das notas que estao
    // sendo recebidas. Evita reaproveitar a selecao de outra cobranca.
    setSelectedPaymentOperationIds(new Set());
  }, [detail?.charge.id]);
  useEffect(() => {
    if (detail?.charge.clientPartnerId === clientId) return;
    setEligible([]); setSelectedNoteIds(new Set());
    setClientPeriodOperations([]);
    setSearchedOperations(false);
    setDetail(null);
    setClientCredits([]);
    setClientSurcharges([]);
    setAdvanceInput("");
    setDiscountInput("");
    setSurchargeInput("");
    setAdjustmentReason("");
    ledgerAutofillChargeIdRef.current = null;
    ledgerAutofillClientIdRef.current = null;
  }, [clientId, detail?.charge.clientPartnerId]);

  const refreshClientLedgerAvailability = useCallback(async (clientPartnerId: string) => {
    const entries = await window.operationsCafe.listLedgerEntries({ organizationId, ownLegalEntityId, clientPartnerId });
    const available = entries.filter((entry) => entry.status === "CONFIRMED" && (entry.availableAmountCents ?? 0) > 0);
    const credits = available.filter((entry) => entry.effect === "REDUCE_RECEIVABLE");
    const surcharges = available.filter((entry) => entry.effect === "INCREASE_RECEIVABLE");
    setClientCredits(credits);
    setClientSurcharges(surcharges);
    return { credits, surcharges };
  }, [organizationId, ownLegalEntityId]);

  // Antes mesmo de gerar o rascunho, mostra na tela de cobranca os
  // adiantamentos e acrescimos ja confirmados na conta-corrente do
  // cliente/corretor selecionado. Assim a previa do valor final bate com o
  // saldo que o usuario ja enxerga na aba Conta-corrente.
  useEffect(() => {
    if (!clientId || detail) return;
    if (ledgerAutofillClientIdRef.current === clientId) return;
    ledgerAutofillClientIdRef.current = clientId;
    void (async () => {
      const { credits, surcharges } = await refreshClientLedgerAvailability(clientId);
      const totalCreditCents = credits.reduce((sum, entry) => sum + (entry.availableAmountCents ?? 0), 0);
      const totalSurchargeCents = surcharges.reduce((sum, entry) => sum + (entry.availableAmountCents ?? 0), 0);
      if (totalCreditCents > 0) setAdvanceInput(formatCurrencyFromCents(totalCreditCents));
      if (totalSurchargeCents > 0) setSurchargeInput(formatCurrencyFromCents(totalSurchargeCents));
    })();
  }, [clientId, detail, refreshClientLedgerAvailability]);

  // Assim que um rascunho de cobranca e' aberto, pre-preenche Adiantamento e
  // Acrescimos com o que ja esta registrado (e confirmado, nao usado) na
  // conta-corrente do cliente -- o dono nao precisa mais digitar de novo o
  // que ja lancou la'. So' roda uma vez por rascunho (clientPartnerId nao
  // muda durante a visualizacao do mesmo rascunho), entao nao atropela edicao
  // manual depois de aplicar ajustes.
  useEffect(() => {
    if (!detail) {
      ledgerAutofillChargeIdRef.current = null;
      return;
    }
    if (ledgerAutofillChargeIdRef.current === detail.charge.id) return;
    ledgerAutofillChargeIdRef.current = detail.charge.id;
    void (async () => {
      const { credits, surcharges } = await refreshClientLedgerAvailability(detail.charge.clientPartnerId);
      const totalCreditCents = credits.reduce((sum, entry) => sum + (entry.availableAmountCents ?? 0), 0);
      const totalSurchargeCents = surcharges.reduce((sum, entry) => sum + (entry.availableAmountCents ?? 0), 0);
      if (totalCreditCents > 0) setAdvanceInput(formatCurrencyFromCents(Math.min(totalCreditCents, detail.charge.openAmountCents)));
      if (totalSurchargeCents > 0) setSurchargeInput(formatCurrencyFromCents(totalSurchargeCents));
    })();
  }, [detail, refreshClientLedgerAvailability]);

  const loadPartnerSummary = useCallback(async () => {
    setPartnerSummary(await window.operationsCafe.getPartnerRateSummary({ organizationId, ownLegalEntityId, periodStart, periodEnd, includeAlreadyBilled, includeAllCompanies }));
  }, [organizationId, ownLegalEntityId, periodStart, periodEnd, includeAlreadyBilled, includeAllCompanies]);

  useEffect(() => { void loadPartnerSummary(); }, [loadPartnerSummary]);

  async function suggestPeriod(): Promise<void> {
    if (!clientId) { setMessage("Selecione um cliente/corretor antes de sugerir o periodo."); return; }
    const [period] = await window.operationsCafe.suggestChargePeriods({ organizationId, ownLegalEntityId, clientPartnerId: clientId, periodicity, referenceDate: periodEnd });
    if (period) { setPeriodStart(period.periodStart); setPeriodEnd(period.periodEnd); setMessage(`Periodo sugerido: ${period.label}`); }
    else setMessage("Nao foi possivel sugerir um periodo para esse cliente/corretor.");
  }

  async function findOperations(): Promise<void> {
    await findOperationsForRange(periodStart, periodEnd);
  }

  const periodRequestRef = useRef(0);
  const [loadingPeriod, setLoadingPeriod] = useState(false);
  async function findOperationsForRange(nextPeriodStart: string, nextPeriodEnd: string, selectedClientId = clientId): Promise<void> {
    const request = ++periodRequestRef.current;
    setDetail(null);
    setEligible([]); setSelectedNoteIds(new Set()); setClientPeriodOperations([]); setSearchedOperations(false);
    setLoadingPeriod(false);
    if (!selectedClientId || !/^\d{4}-\d{2}-\d{2}$/.test(nextPeriodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(nextPeriodEnd) || nextPeriodStart > nextPeriodEnd) return;
    setLoadingPeriod(true);
    try {
    const found = await window.operationsCafe.findEligibleChargeOperations({ organizationId, ownLegalEntityId, clientPartnerId: selectedClientId, periodStart: nextPeriodStart, periodEnd: nextPeriodEnd, includeAllCompanies });
    const related = await window.operationsCafe.listOperations({ responsiblePartnerId: selectedClientId, periodStart: nextPeriodStart, periodEnd: nextPeriodEnd, status: "all", billingStatus: "all" });
    const [documents, entities, billingSummary, partnerRates, currentCharges] = await Promise.all([
      loadOperationDocuments([...found, ...related]),
      window.operationsCafe.listLegalEntities({ status: "all" }),
      window.operationsCafe.getBillingSummary({ organizationId, includeAllCompanies, periodStart: nextPeriodStart, periodEnd: nextPeriodEnd }),
      window.operationsCafe.getPartnerRateSummary({ organizationId, ownLegalEntityId, periodStart: nextPeriodStart, periodEnd: nextPeriodEnd, includeAlreadyBilled, includeAllCompanies }),
      window.operationsCafe.listClientCharges({ status: "all" })
    ]);
    if (request !== periodRequestRef.current) return;
    setOperationDocuments(documents);
    setLegalEntities(entities);
    setCharges(currentCharges);
    setEligible(found);
    setClientPeriodOperations(related);
    setSummary(billingSummary);
    setPartnerSummary(partnerRates);
    setSearchedOperations(true);
    setMessage("Marque as notas que deseja incluir na cobranca ou use Selecionar todos.");
    } catch (error) {
      if (request === periodRequestRef.current) setMessage(`Erro ao calcular o periodo: ${error instanceof Error ? error.message : "Falha inesperada"}`);
    } finally {
      if (request === periodRequestRef.current) setLoadingPeriod(false);
    }
  }

  async function applyPeriodicityFilter(nextPeriodicity: BillingPeriodicity): Promise<void> {
    const range = currentBillingRange(nextPeriodicity);
    const today = localDateInputValue(new Date());
    setPeriodicity(nextPeriodicity);
    setPeriodStart(range.periodStart);
    setPeriodEnd(range.periodEnd);
    setDueDate(today);
    setDetail(null);
    setEligible([]); setSelectedNoteIds(new Set());
    setClientPeriodOperations([]);
    setSearchedOperations(false);
    setMessage(`Filtro ajustado para ${range.label}: ${formatDateOnlyBr(range.periodStart)} a ${formatDateOnlyBr(range.periodEnd)}.`);
    if (clientId) {
      await findOperationsForRange(range.periodStart, range.periodEnd);
    }
  }

  async function loadOperationDocuments(operations: Operation[]): Promise<Record<string, FiscalDocument>> {
    const fiscalDocumentIds = Array.from(new Set(operations.map((operation) => operation.fiscalDocumentId).filter(Boolean)));
    const entries = await Promise.all(fiscalDocumentIds.map(async (id) => {
      const detailDoc = await window.operationsCafe.getFiscalDocument(id);
      return [id, detailDoc.document] as const;
    }));
    return Object.fromEntries(entries);
  }

  function legalEntityLabel(id: string): string {
    const entity = legalEntities.find((item) => item.id === id) ?? data.legalEntities.find((item) => item.id === id);
    return entity?.legalName || entity?.tradeName || id;
  }

  function visibleChargeLabel(charge: ClientCharge): string {
    const clientName = partners.find((item) => item.id === charge.clientPartnerId)?.displayName ?? "Cliente";
    return `${clientName} - ${chargePeriodLabel(charge)}`;
  }

  function operationBillingReason(operation: Operation): string {
    if (operation.status === "CANCELED") return "Nota cancelada";
    if (operationDocument(operation)?.hasPendingIssues) return "Nota com pendencias de cadastro";
    if (isOperationInOpenCharge(operation)) return "Ja esta em cobranca aberta";
    if (operation.billingStatus !== "UNBILLED") return operation.billingStatus === "RESERVED" ? "Ja reservada em rascunho" : "Ja cobrada";
    if (operation.appliedRateValueCents === 0 || operation.serviceAmountCents === 0) return `Falta regra por saca para ${formatOperationScope(operation.operationScope)}`;
    return "Elegivel";
  }

  function operationDocument(operation: Operation): FiscalDocument | null {
    return operationDocuments[operation.fiscalDocumentId] ?? null;
  }

  // A coluna "Empresa" das tabelas de cobranca mostra a CONTRAPARTE da nota
  // (a empresa do outro lado -- pra quem/de quem a nota foi emitida), nao a
  // nossa propria empresa (isso o dono ja sabe, ja que esta operando naquele
  // contexto). A propria entidade continua aparecendo, so que menor/em
  // segundo plano.
  function counterpartyLabel(operation: Operation): string {
    const document = operationDocument(operation);
    const entityId = document?.partnerLegalEntityId;
    if (entityId) {
      const entity = partnerLegalEntities.find((item) => item.id === entityId);
      if (entity) return entity.legalName || entity.tradeName;
    }
    if (document) {
      const ownCnpj = legalEntities.find((item) => item.id === operation.ownLegalEntityId)?.cnpj ?? null;
      const snapshotName = fiscalDocumentCounterpartyNameFromSnapshot(document, ownCnpj);
      if (snapshotName) return snapshotName;
    }
    return "Nao identificado";
  }

  // Numa nota triangulada de verdade (secondaryResponsiblePartnerId
  // preenchido), tanto a ponta de compra quanto a de venda pertencem mesmo a
  // empresa ativa pra fins de cobranca -- isso e' proposital, e' assim que a
  // gente intermedia o negocio. Mas o papel fisico da NF nunca passou pelo
  // nosso CNPJ, entao aqui indica quem emitiu de verdade (o fornecedor do
  // lado da compra), do mesmo jeito que a lista de Notas e operacoes ja
  // mostra, sem mudar a quem a cobranca pertence.
  function triangulatedIssuerLabel(operation: Operation): string | null {
    const document = operationDocument(operation);
    if (!document?.secondaryResponsiblePartnerId) return null;
    // partnerLegalEntities aqui so' cobre empresas ligadas a parceiros com
    // papel CLIENTE (ver load() acima) -- o emissor real de uma triangulada
    // costuma ser o lado FORNECEDOR, que nao esta nessa lista. Por isso cai
    // pro mesmo fallback via snapshot do XML que counterpartyLabel ja usa,
    // em vez de so' desistir quando o id nao bate com essa lista restrita.
    const entityId = document.partnerLegalEntityId;
    if (entityId) {
      const entity = partnerLegalEntities.find((item) => item.id === entityId);
      if (entity) return entity.legalName || entity.tradeName;
    }
    const ownCnpj = legalEntities.find((item) => item.id === operation.ownLegalEntityId)?.cnpj ?? null;
    return fiscalDocumentCounterpartyNameFromSnapshot(document, ownCnpj);
  }

  function chargeDetailCompanyLabel(operation: ClientChargeOperation): string {
    return operation.destinationNameSnapshot?.trim()
      || operation.issuerNameSnapshot?.trim()
      || operation.ownLegalEntityNameSnapshot?.trim()
      || "Nao identificado";
  }

  function operationNoteLabel(operation: Operation): string {
    const document = operationDocument(operation);
    return document?.documentNumber ? `NF ${document.documentNumber}` : "NF nao localizada";
  }

  function operationValueByNote(operation: Operation): string {
    return `${formatCurrencyFromCents(operation.serviceAmountCents)} x ${operationNoteLabel(operation)}`;
  }

  function isOperationInOpenCharge(operation: Operation): boolean {
    if (!operation.clientChargeId || operation.billingStatus === "UNBILLED") return false;
    const charge = charges.find((item) => item.id === operation.clientChargeId);
    return Boolean(charge && charge.openAmountCents > 0 && !["PAID", "CANCELLED", "REPLACED"].includes(charge.status));
  }

  function openChargeLabel(operation: Operation): string {
    if (!operation.clientChargeId) return "";
    const charge = charges.find((item) => item.id === operation.clientChargeId);
    if (!charge) return "Cobranca aberta";
    return `${visibleChargeLabel(charge)} em aberto: ${formatCurrencyFromCents(charge.openAmountCents)}`;
  }

  const diagnosticOperations = clientPeriodOperations.filter((operation) => !eligible.some((item) => item.id === operation.id));
  const openBilledOperations = diagnosticOperations.filter((operation) => isOperationInOpenCharge(operation));
  const openBilledChargeIds = Array.from(new Set(openBilledOperations.map((operation) => operation.clientChargeId).filter(Boolean)));
  const openBilledChargesCents = openBilledChargeIds.reduce((total, chargeId) => {
    const charge = charges.find((item) => item.id === chargeId);
    return total + (charge?.openAmountCents ?? 0);
  }, 0);
  const paidOperations = diagnosticOperations.filter((operation) => {
    const charge = charges.find((item) => item.id === operation.clientChargeId);
    return Boolean(charge && charge.status === "PAID" && charge.openAmountCents === 0);
  });
  const paidChargeIds = Array.from(new Set(paidOperations.map((operation) => operation.clientChargeId).filter(Boolean)));
  const paidReceivedCents = paidChargeIds.reduce((total, chargeId) => {
    const charge = charges.find((item) => item.id === chargeId);
    return total + (charge?.paidAmountCents ?? 0);
  }, 0);
  const advanceCents = parseCurrencyToCents(advanceInput);
  const discountCents = parseCurrencyToCents(discountInput);
  const surchargeCents = parseCurrencyToCents(surchargeInput);
  const eligibleSubtotalCents = selectedOperations.reduce((total, operation) => total + operation.serviceAmountCents, 0);
  const clientPeriodSacks = clientPeriodOperations.length ? sumDecimalTexts(clientPeriodOperations.map((operation) => operation.quantitySacks)) : "0";
  const eligibleSacks = selectedOperations.length ? sumDecimalTexts(selectedOperations.map((operation) => operation.quantitySacks)) : "0";
  const openBilledSacks = openBilledOperations.length ? sumDecimalTexts(openBilledOperations.map((operation) => operation.quantitySacks)) : "0";
  const paidSacks = paidOperations.length ? sumDecimalTexts(paidOperations.map((operation) => operation.quantitySacks)) : "0";
  const chargeBaseCents = detail?.charge.finalAmountCents ?? eligibleSubtotalCents;
  const previewFinalCents = adjustedChargeTotal(chargeBaseCents, surchargeCents, discountCents, advanceCents);
  const hasPendingAdjustments = advanceCents > 0 || discountCents > 0 || surchargeCents > 0;
  const visibleFinalCents = previewFinalCents;
  const draftDisabledReason = draftGenerationBlockedReason();
  const missingRateOperations = diagnosticOperations.filter((operation) => operation.status === "CONFIRMED" && operation.billingStatus === "UNBILLED" && !isOperationInOpenCharge(operation) && (operation.appliedRateValueCents === 0 || operation.serviceAmountCents === 0));
  const missingRateScopes = Array.from(new Set(missingRateOperations.map((operation) => formatOperationScope(operation.operationScope))));
  const detailSacks = detail?.operations.length ? sumDecimalTexts(detail.operations.map((operation) => operation.quantitySacksDecimalSnapshot)) : "0";
  const normalizedPartnerSummarySearch = partnerSummarySearch
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
  const visiblePartnerSummary = partnerSummary
    .filter((row) => row.partnerDisplayName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR")
      .includes(normalizedPartnerSummarySearch))
    .sort((left, right) => left.partnerDisplayName.localeCompare(right.partnerDisplayName, "pt-BR", { sensitivity: "base", numeric: true }));

  function draftGenerationBlockedReason(): string | null {
    if (detail) return null;
    if (!clientId) return "Selecione um cliente/corretor antes de gerar a cobranca.";
    if (!periodStart || !periodEnd || !dueDate) return "Informe inicio, fim e vencimento para gerar a cobranca.";
    if (!searchedOperations) return "Clique em 'Buscar operacoes' para localizar as notas elegiveis desse periodo.";
    if (selectedOperations.length > 0) return null;
    if (eligible.length > 0) return "Marque pelo menos uma nota para gerar a cobranca.";
    if (openBilledChargesCents > 0) {
      return "Nao ha operacoes novas para gerar outro rascunho. As notas desse periodo ja estao em uma cobranca aberta; abra essa cobranca existente para salvar PDF ou imagem.";
    }
    return "Nenhuma nota elegivel foi encontrada. Confira o cliente, a tarifa, o contrato exigido e se as notas ja foram cobradas.";
  }

  function summaryDraftBlockedReason(row: PartnerRateSummaryRow): string | null {
    if (row.operationCount > 0) return null;
    return `Nenhuma nota encontrada para ${row.partnerDisplayName} nesse periodo com os filtros selecionados.`;
  }

  function deleteChargeBlockedReason(charge: ClientCharge): string | null {
    if (charge.status === "CANCELLED") return "Essa cobranca ja foi cancelada.";
    if (charge.status === "PAID" || charge.paidAmountCents > 0) return "Cobranca com pagamento registrado nao pode ser excluida diretamente.";
    return null;
  }

  function formatMoneyState(value: string, setter: (next: string) => void): void {
    setter(formatCurrencyInput(value));
  }

  async function createDraft(): Promise<void> {
    if (!selectedOperations.length) { setMessage("Marque pelo menos uma nota."); return; }
    try {
      const draft = await window.operationsCafe.createClientChargeDraft({ organizationId, ownLegalEntityId, clientPartnerId: clientId, billingProfileId: null, periodicity, periodStart, periodEnd, dueDate, notes: null, internalNotes: null, operationIds: selectedOperations.map((item) => item.id) });
      setDetail(draft);
      setMessage("Rascunho gerado e operacoes reservadas.");
      await load();
      await loadPartnerSummary();
      scrollTo(detailRef);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao gerar cobranca."}`);
    }
  }

  async function exportReportForPartner(row: PartnerRateSummaryRow): Promise<void> {
    if (exportingPartnerId) return;
    setExportingPartnerId(row.partnerId);
    try {
      const saved = await window.operationsCafe.exportPartnerPeriodReport({ organizationId, ownLegalEntityId, clientPartnerId: row.partnerId, periodStart, periodEnd, includeAllCompanies, includeAlreadyBilled });
      setMessage(saved ? `Relatorio PDF de ${row.partnerDisplayName} salvo. Nenhuma cobranca foi criada.` : "Exportacao cancelada.");
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao gerar relatorio."}`);
    } finally {
      setExportingPartnerId(null);
    }
  }

  async function issue(): Promise<void> {
    if (!detail) return;

    if (hasPendingAdjustments && !adjustmentReason.trim()) {
      setMessage("Informe o motivo do acréscimo, desconto ou abatimento.");
      return;
    }

    try {
      const adjusted = hasPendingAdjustments
        ? await applyPendingAdjustmentsToCharge(detail, false)
        : detail;

      const issued = await window.operationsCafe.issueClientCharge(
        adjusted.charge.id
      );

      setDetail(issued);

      if (hasPendingAdjustments) {
        await refreshClientLedgerAvailability(
          issued.charge.clientPartnerId
        );

        setAdvanceInput("");
        setDiscountInput("");
        setSurchargeInput("");
        setAdjustmentReason("");
      }

      setMessage(
        "Cobranca emitida. Agora escolha PDF ou Imagem para salvar onde preferir."
      );

      await load();
      scrollTo(detailRef);
    } catch (errorValue) {
      setMessage(
        `Erro: ${
          errorValue instanceof Error
            ? errorValue.message
            : "falha ao gerar cobranca."
        }`
      );
    }
  }

  // Consome o saldo disponivel dos lancamentos da conta-corrente (adiantamentos
  // ou acrescimos/emprestimos, conforme a lista passada) ate cobrir o valor
  // pedido, mais antigo primeiro. O que sobrar sem lancamento correspondente
  // vira um ajuste manual solto (ledgerEntryId null), igual sempre foi.
  async function consumeLedgerEntries(entries: ClientLedgerEntry[], amountCentsRequested: number, chargeId: string, current: ClientChargeDetail): Promise<{ current: ClientChargeDetail; remainingCents: number }> {
    let remaining = amountCentsRequested;
    let latest = current;
    for (const entry of entries) {
      if (remaining <= 0) break;
      const take = Math.min(entry.availableAmountCents ?? 0, remaining);
      if (take <= 0) continue;
      latest = await window.operationsCafe.applyChargeCredit({ ledgerEntryId: entry.id, clientChargeId: chargeId, amountCents: take });
      remaining -= take;
    }
    return { current: latest, remainingCents: remaining };
  }

  async function applyPendingAdjustmentsToCharge(baseDetail: ClientChargeDetail, shouldRegenerateDocuments: boolean): Promise<ClientChargeDetail> {
    let current = baseDetail;
    if (advanceCents > 0) {
      const consumed = await consumeLedgerEntries(clientCredits, advanceCents, current.charge.id, current);
      current = consumed.current;
      if (consumed.remainingCents > 0) {
        current = await window.operationsCafe.addChargeAdjustment({ clientChargeId: current.charge.id, ledgerEntryId: null, adjustmentType: "ADVANCE", effect: "REDUCE_RECEIVABLE", description: "Adiantamento", amountCents: consumed.remainingCents, sortOrder: 10, reason: adjustmentReason.trim() || "Ajuste manual" });
      }
    }
    if (discountCents > 0) {
      current = await window.operationsCafe.addChargeAdjustment({ clientChargeId: current.charge.id, ledgerEntryId: null, adjustmentType: "DISCOUNT", effect: "REDUCE_RECEIVABLE", description: "Desconto", amountCents: discountCents, sortOrder: 20, reason: adjustmentReason.trim() || "Ajuste manual" });
    }
    if (surchargeCents > 0) {
      const consumed = await consumeLedgerEntries(clientSurcharges, surchargeCents, current.charge.id, current);
      current = consumed.current;
      if (consumed.remainingCents > 0) {
        current = await window.operationsCafe.addChargeAdjustment({ clientChargeId: current.charge.id, ledgerEntryId: null, adjustmentType: "SURCHARGE", effect: "INCREASE_RECEIVABLE", description: "Acrescimo", amountCents: consumed.remainingCents, sortOrder: 30, reason: adjustmentReason.trim() || "Ajuste manual" });
      }
    }
    return shouldRegenerateDocuments && hasPendingAdjustments ? window.operationsCafe.regenerateChargeDocuments(current.charge.id) : current;
  }

  async function applyAdjustments(): Promise<void> {
    if (!detail) {
      if (!hasPendingAdjustments) {
        setMessage("Informe ao menos um adiantamento, desconto ou acrescimo.");
        return;
      }
      if (!adjustmentReason.trim()) {
        setMessage("Informe o motivo do acrescimo, desconto ou abatimento.");
        return;
      }
      setMessage("Ajustes aplicados na previa. O valor final e os documentos internos ja consideram esses valores.");
      return;
    }
    if (hasPendingAdjustments && !adjustmentReason.trim()) {
      setMessage("Informe o motivo do acréscimo, desconto ou abatimento.");
      return;
    }
    try {
      const shouldRegenerateDocuments = !["DRAFT", "PENDING_REVIEW"].includes(detail.charge.status);
      const current = await applyPendingAdjustmentsToCharge(detail, shouldRegenerateDocuments);
      setDetail(current);
      await refreshClientLedgerAvailability(current.charge.clientPartnerId);
      setAdvanceInput("");
      setDiscountInput("");
      setSurchargeInput("");
      setAdjustmentReason("");
      setMessage(shouldRegenerateDocuments ? "Ajustes aplicados. Escolha PDF ou Imagem para salvar uma nova copia." : "Ajustes aplicados.");
      await load();
      scrollTo(detailRef);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao aplicar ajustes."}`);
    }
  }

  async function registerPayment(): Promise<void> {
    if (!detail) return;

    const selectedForPayment = detail.operations.filter((operation) => selectedPaymentOperationIds.has(operation.id));
    if (selectedForPayment.length === 0) {
      setMessage("Marque pelo menos uma nota da cobranca para registrar o pagamento.");
      return;
    }
    const selectedAmountCents = selectedForPayment.reduce((total, operation) => total + operation.serviceAmountCentsSnapshot, 0);
    const suggestedAmountCents = Math.min(selectedAmountCents, detail.charge.openAmountCents);

    const value = await requestTextInput({
      title: "Registrar recebimento",
      label: "Valor recebido (R$)",
      initialValue: formatCurrencyFromCents(suggestedAmountCents)
    });

    if (!value) return;

    const amountCents = parseCurrencyToCents(value);
    if (amountCents <= 0 || amountCents > suggestedAmountCents) {
      setMessage(`Informe um valor entre R$ 0,01 e ${formatCurrencyFromCents(suggestedAmountCents)} para as notas selecionadas.`);
      return;
    }

    // Pagamentos precisam ser vinculados a uma cobranca emitida. Versoes
    // anteriores aceitavam pagamento no rascunho, cujo status ficava preso em
    // DRAFT e aparecia como parcial mesmo quando o saldo chegava a zero.
    let payableDetail = detail;
    if (["DRAFT", "PENDING_REVIEW"].includes(payableDetail.charge.status)) {
      payableDetail = await window.operationsCafe.issueClientCharge(payableDetail.charge.id);
      setDetail(payableDetail);
    }

    const payment = await window.operationsCafe.createClientPayment({
      organizationId,
      ownLegalEntityId,
      clientPartnerId: payableDetail.charge.clientPartnerId,
      paymentDate: new Date().toISOString().slice(0, 10),
      amountCents,
      paymentMethod: "PIX",
      bankAccountDescription: null,
      transactionReference: selectedForPayment.map((operation) => `NF ${operation.fiscalDocumentNumberSnapshot ?? "-"}`).join(", "),
      notes: `Recebimento referente a ${selectedForPayment.length} nota(s) selecionada(s).`,
      attachmentPath: null
    });

    const updatedDetail = await window.operationsCafe.allocateClientPayment({
        clientPaymentId: payment.id,
        clientChargeId: payableDetail.charge.id,
        amountCents
      });
    const receipt = await window.operationsCafe.generateClientPaymentReceipt(payment.id);
    setLastReceipt(receipt);
    setChargeReceipts((current) => [...current.filter((item) => item.id !== receipt.id), receipt]);
    setDetail(updatedDetail);
    setSelectedPaymentOperationIds(new Set());
    setMessage(`Pagamento de ${formatCurrencyFromCents(amountCents)} registrado. O recibo em PDF e imagem esta pronto.`);

    await load();
    scrollTo(detailRef);
  }

  async function openCharge(charge: ClientCharge): Promise<void> {
    let opened = await window.operationsCafe.getClientCharge(charge.id);
    // Recupera automaticamente rascunhos que receberam pagamento em versoes
    // antigas. A emissao cria o numero/registro financeiro e o recálculo os
    // classifica como pagos quando não existe saldo aberto.
    if (["DRAFT", "PENDING_REVIEW"].includes(opened.charge.status) && opened.charge.paidAmountCents > 0) {
      opened = await window.operationsCafe.issueClientCharge(charge.id);
      await load();
    }
    setClientId(opened.charge.clientPartnerId);
    setPeriodStart(opened.charge.periodStart);
    setPeriodEnd(opened.charge.periodEnd);
    setDueDate(opened.charge.dueDate ?? opened.charge.periodEnd);
    setPeriodicity(opened.charge.periodicity);
    setDetail(opened);
    const paymentIds = Array.from(new Set(opened.payments.filter((item) => !item.cancelledAt).map((item) => item.clientPaymentId)));
    const generated = await Promise.allSettled(paymentIds.map((id) => window.operationsCafe.generateClientPaymentReceipt(id)));
    const receipts = generated
      .filter((result): result is PromiseFulfilledResult<ClientPayment> => result.status === "fulfilled")
      .map((result) => result.value);
    setChargeReceipts(receipts);
    setLastReceipt(receipts.at(-1) ?? null);
    setChargesTab("gerar");
    if (generated.some((result) => result.status === "rejected")) {
      setMessage("Cobranca aberta. Nao foi possivel recuperar um dos recibos antigos.");
    }
    window.setTimeout(() => scrollTo(detailRef, 120), 0);
  }

  async function settleSingleOperation(operation: Operation): Promise<void> {
    if (operation.serviceAmountCents <= 0) {
      setMessage("Essa nota nao tem valor de servico calculado para receber.");
      return;
    }
    const confirmed = await requestDecision({
      title: "Receber nota fiscal",
      message: `Registrar pagamento de ${formatCurrencyFromCents(operation.serviceAmountCents)} referente a ${operationNoteLabel(operation)}? Essa nota ficara como paga e as outras continuam em aberto.`
    });
    if (!confirmed) return;

    try {
      const draft = await window.operationsCafe.createClientChargeDraft({
        organizationId: operation.organizationId,
        ownLegalEntityId: operation.ownLegalEntityId,
        clientPartnerId: clientId,
        billingProfileId: null,
        periodicity,
        periodStart: operation.operationDate,
        periodEnd: operation.operationDate,
        dueDate,
        notes: `Baixa individual da ${operationNoteLabel(operation)}`,
        internalNotes: "Cobranca gerada automaticamente pela baixa individual de nota.",
        operationIds: [operation.id]
      });
      const issued = await window.operationsCafe.issueClientCharge(draft.charge.id);
      const payment = await window.operationsCafe.createClientPayment({
        organizationId: operation.organizationId,
        ownLegalEntityId: operation.ownLegalEntityId,
        clientPartnerId: clientId,
        paymentDate: new Date().toISOString().slice(0, 10),
        amountCents: operation.serviceAmountCents,
        paymentMethod: "PIX",
        bankAccountDescription: null,
        transactionReference: operationNoteLabel(operation),
        notes: `Pagamento individual referente a ${operationNoteLabel(operation)}`,
        attachmentPath: null
      });
      const paid = await window.operationsCafe.allocateClientPayment({ clientPaymentId: payment.id, clientChargeId: issued.charge.id, amountCents: operation.serviceAmountCents });
      const receipt = await window.operationsCafe.generateClientPaymentReceipt(payment.id);
      setLastReceipt(receipt);
      setChargeReceipts((current) => [...current.filter((item) => item.id !== receipt.id), receipt]);
      setDetail(paid);
      setMessage(`${operationNoteLabel(operation)} recebida como paga. O recibo em PDF e imagem esta pronto.`);
      await load();
      await findOperations();
      scrollTo(detailRef);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao baixar a nota."}`);
    }
  }

  async function generateInternalPreview(kind: "pdf" | "image"): Promise<void> {
    if (!clientId || selectedOperations.length === 0) {
      setMessage("Selecione o cliente e marque as notas antes de gerar a previa.");
      return;
    }
    if (hasPendingAdjustments && !adjustmentReason.trim()) {
      setMessage("Informe o motivo do acrescimo, desconto ou abatimento.");
      return;
    }

    let temporaryChargeId: string | null = null;
    try {
      const draft = await window.operationsCafe.createClientChargeDraft({
        organizationId,
        ownLegalEntityId,
        clientPartnerId: clientId,
        billingProfileId: null,
        periodicity,
        periodStart,
        periodEnd,
        dueDate,
        notes: "PREVIA INTERNA",
        internalNotes: "Rascunho temporario criado apenas para exportacao de previa interna.",
        operationIds: selectedOperations.map((item) => item.id)
      });
      temporaryChargeId = draft.charge.id;

      const adjusted = hasPendingAdjustments
        ? await applyPendingAdjustmentsToCharge(draft, false)
        : draft;

      const exported = await window.operationsCafe.openChargeDocument({
        chargeId: adjusted.charge.id,
        kind
      });

      setMessage(exported
        ? `${kind === "pdf" ? "PDF" : "Imagem"} de previa interna salvo. Nenhuma cobranca definitiva foi criada.`
        : "Exportacao cancelada. Nenhuma cobranca definitiva foi criada.");
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao gerar previa interna."}`);
    } finally {
      if (temporaryChargeId) {
        try {
          await window.operationsCafe.deleteClientCharge(temporaryChargeId);
        } catch (cleanupError) {
          setMessage(`A previa foi processada, mas o rascunho temporario nao pôde ser removido: ${cleanupError instanceof Error ? cleanupError.message : "erro desconhecido"}.`);
        }
      }
      await load();
      await findOperations();
    }
  }

  async function openDocument(kind: "pdf" | "image"): Promise<void> {
    if (!detail) return;
    try {
      const exported = await window.operationsCafe.openChargeDocument({ chargeId: detail.charge.id, kind });
      setMessage(exported ? `${kind === "pdf" ? "PDF" : "Imagem"} da cobranca salvo na pasta escolhida.` : "Exportacao cancelada. Nenhuma pasta foi escolhida.");
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao abrir documento."}`);
    }
  }

  async function deleteCharge(charge: ClientCharge): Promise<void> {
    const blockedReason = deleteChargeBlockedReason(charge);
    if (blockedReason) {
      setMessage(blockedReason);
      return;
    }
    const confirmed = await requestDecision({
      title: "Excluir cobranca definitivamente",
      message: `Excluir a cobranca ${visibleChargeLabel(charge)} para sempre? Ela some do historico e nao pode ser recuperada. As notas vinculadas voltarao a ficar disponiveis para nova cobranca.`
    });
    if (!confirmed) return;
    try {
      await window.operationsCafe.deleteClientCharge(charge.id);
      if (detail?.charge.id === charge.id) setDetail(null);
      await load();
      if (clientId) await findOperations();
      setSummary(await window.operationsCafe.getBillingSummary({ organizationId, includeAllCompanies, periodStart, periodEnd }));
      setMessage("Cobranca excluida definitivamente. As notas foram liberadas para nova cobranca.");
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao excluir cobranca."}`);
    }
  }

  return (
    <section className="content-section settings">
      {detail?.canceledInvoices?.length ? <div className="operation-warning-card" role="alert">
        <strong>Cobranca com nota cancelada: revise os ajustes</strong>
        <span>{detail.canceledInvoices.map((invoice) => `NF ${invoice.documentNumber}: ${formatCurrencyFromCents(invoice.amountCents)}`).join("; ")}. Os valores e pagamentos foram preservados. Confira os ajustes ja registrados; em rascunho, remova as notas canceladas. Se a cobranca foi emitida, registre o ajuste correspondente na conta-corrente.</span>
      </div> : null}
      <PageHeader eyebrow="Cobrancas" title="Cobranca por periodo" description="Fechamentos semanais, quinzenais e mensais por cliente/corretor, com ajustes e documentos prontos." />
      <div className="cards">
        <article><span>Total a receber no periodo</span><strong>{summary ? formatCurrencyFromCents(summary.openCents) : "Calculando..."}</strong></article>
        <article><span>Recebido no periodo</span><strong>{summary ? formatCurrencyFromCents(summary.receivedCents) : "Calculando..."}</strong></article>
        <article><span>Creditos</span><strong>{formatCurrencyFromCents(summary?.availableCreditsCents ?? 0)}</strong></article>
        <article><span>Operacoes nao cobradas</span><strong>{summary?.unbilledOperations ?? 0}</strong></article>
      </div>

      <div className="settings-tabs">
        <button className={chargesTab === "gerar" ? "active" : ""} onClick={() => setChargesTab("gerar")}>Gerar planilha da cobranca</button>
        <button className={chargesTab === "resumo" ? "active" : ""} onClick={() => setChargesTab("resumo")}>Resumo do periodo</button>
        <button className={chargesTab === "historico" ? "active" : ""} onClick={() => setChargesTab("historico")}>Historico</button>
      </div>

      {chargesTab === "gerar" && (
      <AdminBlock title="Gerar cobranca">
        <div className="charge-context-note">
          <span>Escopo da cobranca</span>
          <strong>Todas as empresas do sistema</strong>
          <small>Villa MG, Villa ES, Grao & Grao MG e Grao & Grao SP entram na mesma consulta. Cada nota mostra a empresa de origem.</small>
        </div>
        <FormGrid>
          <PartnerQuickSearch label="Cliente/corretor" value={clientId} onChange={(value) => { setClientId(value); void findOperationsForRange(periodStart, periodEnd, value); }} partners={partners} legalEntities={partnerLegalEntities} />
          <DateInput label="Inicio" value={periodStart} onChange={(event) => { setPeriodStart(event.target.value); void findOperationsForRange(event.target.value, periodEnd); }} />
          <DateInput label="Fim" value={periodEnd} onChange={(event) => { setPeriodEnd(event.target.value); void findOperationsForRange(periodStart, event.target.value); }} />
          <DateInput label="Vencimento" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </FormGrid>
        <div className="inline-actions" style={{ marginBottom: "var(--space-4)" }}>
          <span className="muted">Periodicidade:</span>
          <Tabs items={PERIODICITY_ITEMS} active={periodicity} onChange={(next) => void applyPeriodicityFilter(next as BillingPeriodicity)} />
        </div>
        <div className="toolbar">
          <button onClick={() => void suggestPeriod()}>Sugerir periodo</button>
          <button onClick={() => void findOperations()}>Buscar operacoes</button>
        </div>

        {searchedOperations ? (
          <div className="charge-review-panel">
            <div className="section-title-row">
              <div>
                <h3>Conferencia da cobranca</h3>
                <p className="muted">Resumo do que foi encontrado para o cliente/corretor no periodo selecionado.</p>
              </div>
              <span className="summary-pill">{formatCurrencyFromCents(previewFinalCents)}</span>
            </div>
            <div className="charge-review-cards">
              <article>
                <span>Sacas no periodo</span>
                <strong>{decimalTextBr(clientPeriodSacks)}</strong>
                <small>Todas as operacoes encontradas</small>
              </article>
              <article>
                <span>Notas novas para cobrar</span>
                <strong>{selectedNoteCount} nota(s) selecionada(s)</strong>
                <small>{decimalTextBr(eligibleSacks)} sacas · {formatCurrencyFromCents(eligibleSubtotalCents)}</small>
              </article>
              <article>
                <span>Ja em cobranca aberta</span>
                <strong>{openBilledOperations.length}</strong>
                <small>{decimalTextBr(openBilledSacks)} sacas · {formatCurrencyFromCents(openBilledChargesCents)}</small>
              </article>
              <article>
                <span>Notas pagas</span>
                <strong>{paidOperations.length}</strong>
                <small>{decimalTextBr(paidSacks)} sacas · {formatCurrencyFromCents(paidReceivedCents)} recebido</small>
              </article>
            </div>
            {paidOperations.length > 0 ? (
              <div className="charge-diagnostics">
                <h4>Notas pagas no periodo</h4>
                <p className="muted">Total recebido: {formatCurrencyFromCents(paidReceivedCents)} · Total de sacas pagas: {decimalTextBr(paidSacks)}</p>
                <div className="table">
                  <div className="table-head charge-diagnostic-grid"><span>Nota</span><span>Cliente/empresa</span><span>Operacao</span><span>Valor</span><span>Sacas</span><span>Status</span></div>
                  {paidOperations.map((op) => {
                    const companyLabel = legalEntityLabel(op.ownLegalEntityId);
                    const issuerLabel = triangulatedIssuerLabel(op);
                    return (
                      <div key={`paid-${op.id}`} className={`table-row charge-diagnostic-grid ${chargeCompanyClass(companyLabel, Boolean(issuerLabel))}`}>
                        <span><strong>{operationNoteLabel(op)}</strong><small>{formatDateOnlyBr(op.operationDate)}</small>{issuerLabel ? <small>Emitida por {issuerLabel}</small> : null}</span>
                        <span><strong>{counterpartyLabel(op)}</strong><small>{companyLabel}</small></span>
                        <span>{formatOperationScope(op.operationScope)}</span>
                        <span><strong>{formatCurrencyFromCents(op.serviceAmountCents)}</strong><small>{operationValueByNote(op)}</small></span>
                        <span><strong>{decimalTextBr(op.quantitySacks)}</strong></span>
                        <span>Paga</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {draftDisabledReason ? <p className="charge-blocked-note">{draftDisabledReason}</p> : null}
            {diagnosticOperations.some((op) => op.status === "DRAFT" && op.billingStatus === "UNBILLED" && op.operationType === "SALE") ? (
              <p className="charge-rate-alert" role="status">
                Incluido no total, em rascunho: {formatCurrencyFromCents(diagnosticOperations.filter((op) => op.status === "DRAFT" && op.billingStatus === "UNBILLED" && op.operationType === "SALE").reduce((sum, op) => sum + op.serviceAmountCents, 0))} em notas de venda em rascunho. Esse valor ja esta incluido no Valor final. Notas sem pendencias podem ser cobradas diretamente.
              </p>
            ) : null}
            {missingRateOperations.length > 0 ? (
              <p className="charge-rate-alert">
                {missingRateOperations.length} nota(s) ficaram fora da cobranca porque falta regra por saca para {missingRateScopes.join(" e ")} desse cliente/corretor. Cadastre a regra e clique em "Buscar operacoes" novamente.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="charge-diagnostics">
          <h3>Dados para pagamento</h3>
          <p>Conta da empresa que emite a cobranca. As alteracoes valem para os proximos documentos gerados desta empresa.</p>
          <button onClick={() => setBankEditor(legalEntities.find((entity) => entity.id === ownLegalEntityId) ?? null)}>Editar dados bancarios</button>
          {bankEditor ? <div>
            <strong>{bankEditor.tradeName}</strong>
            <FormGrid>
              {([
                ["defaultBankName", "Banco"], ["defaultBankCode", "Codigo do banco"], ["defaultBankAgency", "Agencia"],
                ["defaultBankAccount", "Conta"], ["defaultBankAccountType", "Tipo de conta"], ["defaultBankHolderName", "Titular"],
                ["defaultBankHolderDocument", "CPF/CNPJ do titular"], ["defaultPixKey", "Chave PIX"], ["defaultPixKeyType", "Tipo de chave PIX"]
              ] as const).map(([field, label]) => <label key={field}>{label}<input value={bankEditor[field] ?? ""} onChange={(event) => setBankEditor({ ...bankEditor, [field]: event.target.value || null })} /></label>)}
            </FormGrid>
            <button disabled={savingBank} onClick={() => void saveBankDetails()}>Salvar dados para pagamento</button>
            <button disabled={savingBank} onClick={() => setBankEditor(null)}>Cancelar</button>
          </div> : null}
        </div>

        <div className="charges-columns" ref={operationsRef}>
          <div className="charges-column">
            <h3>Selecione as notas da cobranca</h3>
            {eligible.length > 0 ? <div className="row-actions">
              <label><input type="checkbox" disabled={Boolean(detail) || loadingPeriod} checked={availableNoteIds.length > 0 && selectedNoteCount === availableNoteIds.length} onChange={(event) => setSelectedNoteIds(event.target.checked ? new Set(availableNoteIds) : new Set())} /> Selecionar todos</label>
              <span>{selectedNoteCount} de {availableNoteIds.length} nota(s) selecionada(s)</span>
            </div> : null}
            {eligible.length ? (
              <div className="table">
                <div className="table-head charge-operation-grid"><span>Nota</span><span>Empresa</span><span>Operacao</span><span>Valor</span><span>Status</span><span>Acoes</span></div>
                {eligible.map((op) => {
                  const companyLabel = legalEntityLabel(op.ownLegalEntityId);
                  const issuerLabel = triangulatedIssuerLabel(op);
                  return (
                    <div key={op.id} className={`table-row charge-operation-grid ${chargeCompanyClass(companyLabel, Boolean(issuerLabel))}`}>
                      <span><label><input type="checkbox" disabled={Boolean(detail) || loadingPeriod} checked={selectedNoteIds.has(op.fiscalDocumentId)} onChange={() => toggleNote(op.fiscalDocumentId)} aria-label={`Selecionar ${operationNoteLabel(op)}`} /> <strong>{operationNoteLabel(op)}</strong></label><small>{formatDateOnlyBr(op.operationDate)}</small>{issuerLabel ? <small>Emitida por {issuerLabel}</small> : null}</span>
                      <span><strong>{counterpartyLabel(op)}</strong><small>{companyLabel}</small></span>
                      <span><strong>{formatOperationScope(op.operationScope)}</strong><small>{decimalTextBr(op.quantitySacks)} sacas · {formatCurrencyFromCents(op.appliedRateValueCents)}/saca</small></span>
                      <span><strong>{formatCurrencyFromCents(op.serviceAmountCents)}</strong><small>{operationValueByNote(op)}</small></span>
                      <span>{formatStatusLabel(op.billingStatus)}</span>
                      <span className="row-actions"><button onClick={() => void settleSingleOperation(op)}>Receber NF</button></span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title={searchedOperations ? "Nenhuma operacao elegivel" : "Nenhuma operacao carregada"}
                description={searchedOperations ? "Nao ha notas sem pendencias disponiveis para cobrar nesse periodo. Confira cliente, tarifa e contrato exigido em Notas e operacoes." : "Clique em 'Buscar operacoes' para listar as operacoes elegiveis do cliente/corretor no periodo."}
              />
            )}
            {searchedOperations && diagnosticOperations.length > 0 ? (
              <div className="charge-diagnostics">
                <h4>Operacoes encontradas fora da cobranca atual</h4>
                <p className="muted">Notas em cobrancas abertas entram no total a receber do cliente/corretor. Notas pagas ou canceladas aparecem apenas como referencia do periodo.</p>
                <div className="table">
                  <div className="table-head charge-diagnostic-grid"><span>Nota</span><span>Empresa</span><span>Operacao</span><span>Valor</span><span>Status</span><span>Motivo</span></div>
                  {diagnosticOperations.map((op) => {
                    const companyLabel = legalEntityLabel(op.ownLegalEntityId);
                    const issuerLabel = triangulatedIssuerLabel(op);
                    return (
                      <div key={op.id} className={`table-row charge-diagnostic-grid ${chargeCompanyClass(companyLabel, Boolean(issuerLabel))}`}>
                        <span><strong>{operationNoteLabel(op)}</strong><small>{formatDateOnlyBr(op.operationDate)}</small>{issuerLabel ? <small>Emitida por {issuerLabel}</small> : null}</span>
                        <span><strong>{counterpartyLabel(op)}</strong><small>{companyLabel}</small></span>
                        <span><strong>{formatOperationScope(op.operationScope)}</strong><small>{decimalTextBr(op.quantitySacks)} sacas · {formatCurrencyFromCents(op.appliedRateValueCents)}/saca</small></span>
                        <span>
                          <strong>{formatCurrencyFromCents(op.serviceAmountCents)}</strong>
                          <small>{op.serviceAmountCents <= 0 ? "Nao entra no total ate ter regra" : isOperationInOpenCharge(op) ? openChargeLabel(op) : operationValueByNote(op)}</small>
                        </span>
                        <span>{formatCombinedStatusLabel(op.status, op.billingStatus)}</span>
                        <span>{operationBillingReason(op)}</span>
                      </div>
                    );
                  })}
                  {!detail && advanceCents > 0 ? (
                    <div className="table-row charge-operation-grid charge-row--adjustment">
                      <span><strong>Adiantamento</strong><small>{adjustmentReason.trim() || "Ajuste informado"}</small></span>
                      <span>AJUSTE</span><span>Abatimento</span>
                      <span>- {formatCurrencyFromCents(advanceCents)}</span>
                      <span>Previa</span><span>Reduz o valor final</span>
                    </div>
                  ) : null}
                  {!detail && discountCents > 0 ? (
                    <div className="table-row charge-operation-grid charge-row--adjustment">
                      <span><strong>Desconto</strong><small>{adjustmentReason.trim() || "Ajuste informado"}</small></span>
                      <span>AJUSTE</span><span>Desconto</span>
                      <span>- {formatCurrencyFromCents(discountCents)}</span>
                      <span>Previa</span><span>Reduz o valor final</span>
                    </div>
                  ) : null}
                  {!detail && surchargeCents > 0 ? (
                    <div className="table-row charge-operation-grid charge-row--adjustment">
                      <span><strong>Acrescimo</strong><small>{adjustmentReason.trim() || "Ajuste informado"}</small></span>
                      <span>AJUSTE</span><span>Acrescimo</span>
                      <span>+ {formatCurrencyFromCents(surchargeCents)}</span>
                      <span>Previa</span><span>Aumenta o valor final</span>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="charges-column">
            <h3>Ajustes e valores</h3>
            {(clientCredits.length > 0 || clientSurcharges.length > 0) ? (
              <p className="muted">Adiantamentos e acrescimos abaixo vieram da conta-corrente deste cliente/corretor. Eles ja entram na previa. Voce pode gerar PDF ou imagem interna antes da cobranca definitiva.</p>
            ) : null}
            <div className="kv-list">
              <div><dt>Adiantamento (R$)</dt><dd><input value={advanceInput} onChange={(event) => setAdvanceInput(event.target.value)} onBlur={() => formatMoneyState(advanceInput, setAdvanceInput)} placeholder="R$ 0,00" /></dd></div>
              <div><dt>Descontos (R$)</dt><dd><input value={discountInput} onChange={(event) => setDiscountInput(event.target.value)} onBlur={() => formatMoneyState(discountInput, setDiscountInput)} placeholder="R$ 0,00" /></dd></div>
              <div><dt>Acrescimos (R$)</dt><dd><input value={surchargeInput} onChange={(event) => setSurchargeInput(event.target.value)} onBlur={() => formatMoneyState(surchargeInput, setSurchargeInput)} placeholder="R$ 0,00" /></dd></div>
            </div>
            <label style={{ display: "grid", gap: "6px", marginTop: "12px" }}>
              <span>Motivo do ajuste</span>
              <textarea
                value={adjustmentReason}
                onChange={(event) => setAdjustmentReason(event.target.value)}
                placeholder="Ex.: diferença de frete, correção de valor ou acordo comercial"
                rows={3}
               
              />
            </label>
            <div className="toolbar">
              <button onClick={() => void applyAdjustments()}>Aplicar ajustes</button>
            </div>
            <div className="charges-final-card">
              <span>Valor final a cobrar</span>
              <strong aria-live="polite">{loadingPeriod ? "Calculando..." : formatCurrencyFromCents(visibleFinalCents)}</strong>
              {!detail && clientPeriodOperations.length > 0 && (advanceCents > 0 || discountCents > 0 || surchargeCents > 0) ? <small>Notas lancadas no periodo + acrescimos - descontos - adiantamentos.</small> : null}
              {!detail && clientPeriodOperations.length > 0 && advanceCents === 0 && discountCents === 0 && surchargeCents === 0 ? <small>Soma das notas lancadas no periodo, incluindo rascunhos.</small> : null}
              {!detail ? <small>Somente notas selecionadas, com os ajustes informados.</small> : null}
              {detail && (advanceCents > 0 || discountCents > 0 || surchargeCents > 0) ? <small>Apos ajustes digitados: {formatCurrencyFromCents(previewFinalCents)}</small> : null}
              {!detail ? (
                <>
                  <div className="inline-actions">
                    <button onClick={() => void generateInternalPreview("pdf")} disabled={Boolean(draftDisabledReason)}>Previa interna PDF</button>
                    <button onClick={() => void generateInternalPreview("image")} disabled={Boolean(draftDisabledReason)}>Previa interna imagem</button>
                  </div>
                  <span className="disabled-action-tip" tabIndex={draftDisabledReason ? 0 : -1}>
                    <button className="primary" onClick={() => void createDraft()} disabled={Boolean(draftDisabledReason)}>Preparar cobranca definitiva</button>
                    {draftDisabledReason ? <span className="disabled-action-tip__card" role="tooltip">{draftDisabledReason}</span> : null}
                  </span>
                </>
              ) : ["DRAFT", "PENDING_REVIEW"].includes(detail.charge.status) ? (
                <button className="primary" onClick={() => void issue()}>Gerar cobranca</button>
              ) : (
                <div className="inline-actions">
                  <button onClick={() => void openDocument("pdf")}>Salvar PDF</button>
                  <button onClick={() => void openDocument("image")}>Salvar imagem</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </AdminBlock>
      )}

      {chargesTab === "resumo" && (
        <AdminBlock title="Resumo do periodo por cliente/corretor">
          <FormGrid>
            <DateInput label="Inicio do periodo" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
            <DateInput label="Fim do periodo" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
          </FormGrid>
        <p className="muted">Sacas e valor de servico por cliente/corretor, separado entre vendas na mesma UF e em outra UF. Clientes sem movimento no periodo aparecem zerados.</p>
        <Input
          label="Pesquisar cliente/corretor"
          value={partnerSummarySearch}
          placeholder="Digite o nome do cliente ou corretor"
          onChange={(event) => setPartnerSummarySearch(event.target.value)}
        />
        <label className="inline-check"><input type="checkbox" checked={includeAlreadyBilled} onChange={(event) => setIncludeAlreadyBilled(event.target.checked)} /> Incluir operacoes ja cobradas</label>
        <div className="table">
          <div className="table-head partner-summary-grid"><span>Cliente/corretor</span><span>Sacas mesma UF</span><span>Sacas outra UF</span><span>Valor mesma UF</span><span>Valor outra UF</span><span>Total</span><span>Acoes</span></div>
          {visiblePartnerSummary.map((row) => (
            <div key={row.partnerId} className="table-row partner-summary-grid">
              <span>{row.partnerDisplayName}</span>
              <span>{decimalTextBr(row.internalSacks)}</span>
              <span>{decimalTextBr(row.externalSacks)}</span>
              <span>{formatCurrencyFromCents(row.internalAmountCents)}</span>
              <span>{formatCurrencyFromCents(row.externalAmountCents)}</span>
              <span>{formatCurrencyFromCents(row.totalAmountCents)}</span>
              <span>
                <span className="disabled-action-tip" tabIndex={summaryDraftBlockedReason(row) ? 0 : -1}>
                  <button disabled={Boolean(summaryDraftBlockedReason(row)) || exportingPartnerId !== null} onClick={() => void exportReportForPartner(row)}>{exportingPartnerId === row.partnerId ? "Gerando..." : "Gerar relatorio PDF"}</button>
                  {summaryDraftBlockedReason(row) ? <span className="disabled-action-tip__card" role="tooltip">{summaryDraftBlockedReason(row)}</span> : null}
                </span>
              </span>
            </div>
          ))}
          {visiblePartnerSummary.length === 0 ? <EmptyState title="Nenhum cliente encontrado" description="Tente pesquisar por outro nome." /> : null}
        </div>
      </AdminBlock>
      )}

      {chargesTab === "gerar" && detail ? <div ref={detailRef}><AdminBlock title={visibleChargeLabel(detail.charge)}>
        <div className="cards">
          <article><span>Subtotal</span><strong>{formatCurrencyFromCents(detail.charge.subtotalServicesCents)}</strong></article>
          <article><span>Ajustes +</span><strong>{formatCurrencyFromCents(detail.charge.additionsCents)}</strong></article>
          <article><span>Ajustes -</span><strong>{formatCurrencyFromCents(detail.charge.deductionsCents)}</strong></article>
          <article><span>Sacas cobradas</span><strong>{decimalTextBr(detailSacks)}</strong></article>
          <article><span>Total</span><strong>{formatCurrencyFromCents(detail.charge.finalAmountCents)}</strong></article>
          <article><span>Aberto</span><strong>{formatCurrencyFromCents(detail.charge.openAmountCents)}</strong></article>
        </div>
        <div className="row-actions charge-payment-selection">
          <label><input
            type="checkbox"
            disabled={detail.charge.openAmountCents <= 0}
            checked={detail.operations.length > 0 && selectedPaymentOperationIds.size === detail.operations.length}
            onChange={(event) => setSelectedPaymentOperationIds(event.target.checked ? new Set(detail.operations.map((operation) => operation.id)) : new Set())}
          /> Selecionar todas as notas</label>
          <span>{selectedPaymentOperationIds.size} de {detail.operations.length} nota(s) selecionada(s)</span>
        </div>
        <div className="table">
          <div className="table-head charge-detail-operation-grid"><span>Nota fiscal</span><span>Empresa</span><span>Data</span><span>Produto</span><span>Sacas</span><span>Servico</span><span>Situação</span></div>
          {detail.operations.map((operation) => {
            const companyLabel = operation.ownLegalEntityNameSnapshot ?? "Empresa nao registrada";
            const noteCompanyLabel = chargeDetailCompanyLabel(operation);
            return (
              <div key={operation.id} className={`table-row charge-detail-operation-grid ${chargeCompanyClass(operation.issuerNameSnapshot || operation.ownLegalEntityNameSnapshot)}`}>
                <span><label><input
                  type="checkbox"
                  disabled={detail.charge.openAmountCents <= 0}
                  checked={selectedPaymentOperationIds.has(operation.id)}
                  onChange={() => setSelectedPaymentOperationIds((current) => {
                    const next = new Set(current);
                    if (next.has(operation.id)) next.delete(operation.id); else next.add(operation.id);
                    return next;
                  })}
                  aria-label={`Selecionar NF ${operation.fiscalDocumentNumberSnapshot ?? "-"} para pagamento`}
                /> {operation.fiscalDocumentNumberSnapshot ? `NF ${operation.fiscalDocumentNumberSnapshot}` : "NF -"}</label></span>
                <span><strong>{noteCompanyLabel}</strong><small>{companyLabel}</small></span>
                <span>{formatDateOnlyBr(operation.operationDateSnapshot)}</span>
                <span>{operation.productNameSnapshot ?? "-"}</span>
                <span><strong>{decimalTextBr(operation.quantitySacksDecimalSnapshot)}</strong><small>{formatCurrencyFromCents(operation.serviceRateCentsSnapshot)}/saca</small></span>
                <span>{formatCurrencyFromCents(operation.serviceAmountCentsSnapshot)} x NF {operation.fiscalDocumentNumberSnapshot ?? "-"}</span>
                <span>{detail.charge.status === "PAID" ? "Paga" : detail.charge.paidAmountCents > 0 ? "Pagamento parcial" : "Em aberto"}</span>
              </div>
            );
          })}
        </div>
        {detail.payments.some((allocation) => !allocation.cancelledAt) ? (
          <div className="charge-payment-history">
            <h4>Pagamentos e recibos</h4>
            <div className="table">
              <div className="table-head payment-receipt-grid"><span>Data</span><span>Valor nesta cobranca</span><span>Valor recebido</span><span>Recibo</span></div>
              {Array.from(new Set(detail.payments.filter((allocation) => !allocation.cancelledAt).map((allocation) => allocation.clientPaymentId))).map((paymentId) => {
                const receipt = chargeReceipts.find((item) => item.id === paymentId);
                const allocatedCents = detail.payments
                  .filter((allocation) => allocation.clientPaymentId === paymentId && !allocation.cancelledAt)
                  .reduce((total, allocation) => total + allocation.amountCents, 0);
                return (
                  <div key={paymentId} className="table-row payment-receipt-grid">
                    <span>{receipt ? formatDateOnlyBr(receipt.paymentDate) : "-"}</span>
                    <span>{formatCurrencyFromCents(allocatedCents)}</span>
                    <span>{receipt ? formatCurrencyFromCents(receipt.amountCents) : "-"}</span>
                    <span className="row-actions">
                      <button disabled={!receipt?.receiptPdfFilePath} onClick={() => receipt && void window.operationsCafe.openClientPaymentReceipt({ paymentId: receipt.id, kind: "pdf" })}>Salvar PDF</button>
                      <button disabled={!receipt?.receiptImageFilePath} onClick={() => receipt && void window.operationsCafe.openClientPaymentReceipt({ paymentId: receipt.id, kind: "image" })}>Salvar imagem</button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="toolbar">
          <button disabled={selectedPaymentOperationIds.size === 0 || detail.charge.openAmountCents <= 0} onClick={() => void registerPayment()}>Registrar pagamento das notas selecionadas</button>
          {lastReceipt ? <><button onClick={() => void window.operationsCafe.openClientPaymentReceipt({ paymentId: lastReceipt.id, kind: "pdf" })}>Salvar recibo PDF</button><button onClick={() => void window.operationsCafe.openClientPaymentReceipt({ paymentId: lastReceipt.id, kind: "image" })}>Salvar recibo em imagem</button></> : null}
        </div>
      </AdminBlock></div> : null}

      {chargesTab === "historico" && (
      <div ref={historyRef}><AdminBlock title="Historico de cobrancas">
        <div className="table">
          <div className="table-head charge-grid"><span>Criada em</span><span>Cliente/corretor</span><span>Periodo</span><span>Total</span><span>Pago</span><span>Aberto</span><span>Status</span><span>Acoes</span></div>
          {charges.map((charge) => {
            const deleteBlockedReason = deleteChargeBlockedReason(charge);
            return (
              <div key={charge.id} className="table-row charge-grid">
                <span>{formatDateTimeBr(charge.createdAt)}</span>
                <span>{partners.find((item) => item.id === charge.clientPartnerId)?.displayName ?? charge.clientPartnerId}</span>
                <span>{formatDateOnlyBr(charge.periodStart)} a {formatDateOnlyBr(charge.periodEnd)}</span>
                <span>{formatCurrencyFromCents(charge.finalAmountCents)}</span>
                <span>{formatCurrencyFromCents(charge.paidAmountCents)}</span>
                <span>{formatCurrencyFromCents(charge.openAmountCents)}</span>
                <span>{formatStatusLabel(charge.status)}</span>
                <span className="row-actions">
                  <button onClick={() => void openCharge(charge)}>Abrir</button>
                  <span className="disabled-action-tip" tabIndex={deleteBlockedReason ? 0 : -1}>
                    <button className="danger-action" disabled={Boolean(deleteBlockedReason)} onClick={() => void deleteCharge(charge)}>Excluir</button>
                    {deleteBlockedReason ? <span className="disabled-action-tip__card" role="tooltip">{deleteBlockedReason}</span> : null}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </AdminBlock>
      </div>
      )}
      <Feedback message={message} />
    </section>
  );
}
