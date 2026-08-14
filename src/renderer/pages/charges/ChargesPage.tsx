import React, { useCallback, useEffect, useRef, useState } from "react";
import type { BillingPeriodicity, BillingSummary, BootstrapData, BusinessPartner, BusinessPartnerLegalEntity, ClientCharge, ClientChargeDetail, ClientChargeOperation, ClientLedgerEntry, FiscalDocument, LegalEntity, Operation, PartnerRateSummaryRow } from "../../../shared/types/domain";
import { formatCurrencyFromCents, formatCurrencyInput, formatDateOnlyBr, parseCurrencyToCents } from "../../../shared/utils/format";
import { DateInput, EmptyState, PageHeader, Tabs } from "../../design-system";
import { Feedback } from "../../components/feedback/Feedback";
import { PartnerQuickSearch } from "../../components/forms/PartnerQuickSearch";
import { AdminBlock, FormGrid } from "../../components/layout/SectionPrimitives";
import { requestDecision, requestTextInput } from "../../utils/dialogs";
import { useAutoScroll } from "../../hooks/useAutoScroll";
import { formatOperationScope } from "../../../shared/utils/operationLabels";
import { fiscalDocumentCounterpartyNameFromSnapshot } from "../../../shared/utils/fiscalDocumentLabels";
import { formatCombinedStatusLabel, formatStatusLabel } from "../../../shared/utils/statusLabels";
import { sumDecimalTexts } from "../../../shared/utils/decimal";

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
  const [eligible, setEligible] = useState<Operation[]>([]);
  const [clientPeriodOperations, setClientPeriodOperations] = useState<Operation[]>([]);
  const [operationDocuments, setOperationDocuments] = useState<Record<string, FiscalDocument>>({});
  const [detail, setDetail] = useState<ClientChargeDetail | null>(null);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [partnerSummary, setPartnerSummary] = useState<PartnerRateSummaryRow[]>([]);
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
    setSummary(await window.operationsCafe.getBillingSummary({ organizationId, includeAllCompanies }));
  }, [organizationId, includeAllCompanies]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (detail?.charge.clientPartnerId === clientId) return;
    setEligible([]);
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

  async function findOperationsForRange(nextPeriodStart: string, nextPeriodEnd: string): Promise<void> {
    setDetail(null);
    const found = await window.operationsCafe.findEligibleChargeOperations({ organizationId, ownLegalEntityId, clientPartnerId: clientId, periodStart: nextPeriodStart, periodEnd: nextPeriodEnd, includeAllCompanies });
    const related = await window.operationsCafe.listOperations({ responsiblePartnerId: clientId, periodStart: nextPeriodStart, periodEnd: nextPeriodEnd, status: "all", billingStatus: "all" });
    await loadOperationDocuments([...found, ...related]);
    setLegalEntities(await window.operationsCafe.listLegalEntities({ status: "all" }));
    setEligible(found);
    setClientPeriodOperations(related);
    setSummary(await window.operationsCafe.getBillingSummary({ organizationId, includeAllCompanies }));
    setPartnerSummary(await window.operationsCafe.getPartnerRateSummary({ organizationId, ownLegalEntityId, periodStart: nextPeriodStart, periodEnd: nextPeriodEnd, includeAlreadyBilled, includeAllCompanies }));
    setSearchedOperations(true);
    setMessage(found.length > 0 ? `${found.length} operacao(oes) elegivel(is) encontrada(s) no periodo.` : "Nenhuma operacao elegivel encontrada nesse periodo para esse cliente/corretor.");
    scrollTo(operationsRef);
  }

  async function applyPeriodicityFilter(nextPeriodicity: BillingPeriodicity): Promise<void> {
    const range = currentBillingRange(nextPeriodicity);
    const today = localDateInputValue(new Date());
    setPeriodicity(nextPeriodicity);
    setPeriodStart(range.periodStart);
    setPeriodEnd(range.periodEnd);
    setDueDate(today);
    setDetail(null);
    setEligible([]);
    setClientPeriodOperations([]);
    setSearchedOperations(false);
    setMessage(`Filtro ajustado para ${range.label}: ${formatDateOnlyBr(range.periodStart)} a ${formatDateOnlyBr(range.periodEnd)}.`);
    if (clientId) {
      await findOperationsForRange(range.periodStart, range.periodEnd);
    }
  }

  async function loadOperationDocuments(operations: Operation[]): Promise<void> {
    const fiscalDocumentIds = Array.from(new Set(operations.map((operation) => operation.fiscalDocumentId).filter(Boolean)));
    const entries = await Promise.all(fiscalDocumentIds.map(async (id) => {
      const detailDoc = await window.operationsCafe.getFiscalDocument(id);
      return [id, detailDoc.document] as const;
    }));
    setOperationDocuments(Object.fromEntries(entries));
  }

  function legalEntityLabel(id: string): string {
    const entity = legalEntities.find((item) => item.id === id) ?? data.legalEntities.find((item) => item.id === id);
    return entity?.legalName || entity?.tradeName || id;
  }

  function chargeCompanyClass(value: string | null | undefined): string {
    const normalized = (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (normalized.includes("grao")) return "charge-row--grao";
    if (normalized.includes("villa")) return "charge-row--villa";
    return "charge-row--third-party";
  }

  function operationBillingReason(operation: Operation): string {
    if (operation.status !== "CONFIRMED") return "Nota ainda nao confirmada";
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
    if (!document?.secondaryResponsiblePartnerId || !document.partnerLegalEntityId) return null;
    const entity = partnerLegalEntities.find((item) => item.id === document.partnerLegalEntityId);
    return entity ? (entity.legalName || entity.tradeName) : null;
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
    return `${charge.chargeNumber ?? "Rascunho"} em aberto: ${formatCurrencyFromCents(charge.openAmountCents)}`;
  }

  const diagnosticOperations = clientPeriodOperations.filter((operation) => !eligible.some((item) => item.id === operation.id));
  const openBilledOperations = diagnosticOperations.filter((operation) => isOperationInOpenCharge(operation));
  const openBilledChargeIds = Array.from(new Set(openBilledOperations.map((operation) => operation.clientChargeId).filter(Boolean)));
  const openBilledChargesCents = openBilledChargeIds.reduce((total, chargeId) => {
    const charge = charges.find((item) => item.id === chargeId);
    return total + (charge?.openAmountCents ?? 0);
  }, 0);
  const advanceCents = parseCurrencyToCents(advanceInput);
  const discountCents = parseCurrencyToCents(discountInput);
  const surchargeCents = parseCurrencyToCents(surchargeInput);
  const eligibleSubtotalCents = eligible.reduce((total, operation) => total + operation.serviceAmountCents, 0);
  const clientPeriodSacks = clientPeriodOperations.length ? sumDecimalTexts(clientPeriodOperations.map((operation) => operation.quantitySacks)) : "0";
  const eligibleSacks = eligible.length ? sumDecimalTexts(eligible.map((operation) => operation.quantitySacks)) : "0";
  const openBilledSacks = openBilledOperations.length ? sumDecimalTexts(openBilledOperations.map((operation) => operation.quantitySacks)) : "0";
  const chargeBaseCents = detail?.charge.finalAmountCents ?? eligibleSubtotalCents + openBilledChargesCents;
  const previewFinalCents = Math.max(0, chargeBaseCents + surchargeCents - advanceCents - discountCents);
  const hasPendingAdjustments = advanceCents > 0 || discountCents > 0 || surchargeCents > 0;
  const visibleFinalCents = previewFinalCents;
  const draftDisabledReason = draftGenerationBlockedReason();
  const receivedOrClosedOperations = diagnosticOperations.filter((operation) => !isOperationInOpenCharge(operation) && operation.billingStatus !== "UNBILLED");
  const missingRateOperations = diagnosticOperations.filter((operation) => operation.status === "CONFIRMED" && operation.billingStatus === "UNBILLED" && !isOperationInOpenCharge(operation) && (operation.appliedRateValueCents === 0 || operation.serviceAmountCents === 0));
  const missingRateScopes = Array.from(new Set(missingRateOperations.map((operation) => formatOperationScope(operation.operationScope))));
  const detailSacks = detail?.operations.length ? sumDecimalTexts(detail.operations.map((operation) => operation.quantitySacksDecimalSnapshot)) : "0";

  function draftGenerationBlockedReason(): string | null {
    if (detail) return null;
    if (!clientId) return "Selecione um cliente/corretor antes de gerar a cobranca.";
    if (!periodStart || !periodEnd || !dueDate) return "Informe inicio, fim e vencimento para gerar a cobranca.";
    if (!searchedOperations) return "Clique em 'Buscar operacoes' para localizar as notas elegiveis desse periodo.";
    if (eligible.length > 0) return null;
    if (openBilledChargesCents > 0) {
      return "Nao ha operacoes novas para gerar outro rascunho. As notas desse periodo ja estao em uma cobranca aberta; abra essa cobranca existente para salvar PDF ou imagem.";
    }
    return "Nenhuma nota elegivel foi encontrada. Confira se as notas foram confirmadas, se pertencem ao cliente/corretor selecionado e se ainda nao foram cobradas.";
  }

  function summaryDraftBlockedReason(row: PartnerRateSummaryRow): string | null {
    if (row.operationCount > 0) return null;
    return `Nenhuma operacao nao cobrada encontrada para ${row.partnerDisplayName} nesse periodo. Confira as datas ou se as notas ja estao em outra cobranca.`;
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
    try {
      const draft = await window.operationsCafe.createClientChargeDraft({ organizationId, ownLegalEntityId, clientPartnerId: clientId, billingProfileId: null, periodicity, periodStart, periodEnd, dueDate, notes: null, internalNotes: null, operationIds: eligible.map((item) => item.id) });
      setDetail(draft);
      setMessage("Rascunho gerado e operacoes reservadas.");
      await load();
      await loadPartnerSummary();
      scrollTo(detailRef);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao gerar cobranca."}`);
    }
  }

  async function generateDraftForPartner(row: PartnerRateSummaryRow): Promise<void> {
    try {
      const operations = await window.operationsCafe.findEligibleChargeOperations({ organizationId, ownLegalEntityId, clientPartnerId: row.partnerId, periodStart, periodEnd, includeAllCompanies });
      if (operations.length === 0) { setMessage(`Nenhuma operacao em aberto para ${row.partnerDisplayName} no periodo.`); return; }
      const draft = await window.operationsCafe.createClientChargeDraft({ organizationId, ownLegalEntityId, clientPartnerId: row.partnerId, billingProfileId: null, periodicity, periodStart, periodEnd, dueDate, notes: null, internalNotes: null, operationIds: operations.map((item) => item.id) });
      setClientId(row.partnerId);
      setDetail(draft);
      setChargesTab("gerar");
      setMessage(`Rascunho gerado para ${row.partnerDisplayName}.`);
      await load();
      await loadPartnerSummary();
      scrollTo(detailRef);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao gerar rascunho."}`);
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

    const value = await requestTextInput({
      title: "Registrar recebimento",
      label: "Valor recebido (R$)"
    });

    if (!value) return;

    const amountCents = parseCurrencyToCents(value);

    const payment = await window.operationsCafe.createClientPayment({
      organizationId,
      ownLegalEntityId,
      clientPartnerId: detail.charge.clientPartnerId,
      paymentDate: new Date().toISOString().slice(0, 10),
      amountCents,
      paymentMethod: "PIX",
      bankAccountDescription: null,
      transactionReference: null,
      notes: null,
      attachmentPath: null
    });

    setDetail(
      await window.operationsCafe.allocateClientPayment({
        clientPaymentId: payment.id,
        clientChargeId: detail.charge.id,
        amountCents
      })
    );

    await load();
    scrollTo(detailRef);
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
      setDetail(paid);
      setMessage(`${operationNoteLabel(operation)} recebida como paga. As demais notas permanecem em aberto.`);
      await load();
      await findOperations();
      scrollTo(detailRef);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao baixar a nota."}`);
    }
  }

  async function generateInternalPreview(kind: "pdf" | "image"): Promise<void> {
    if (!clientId || eligible.length === 0) {
      setMessage("Selecione o cliente e encontre notas elegiveis antes de gerar a previa.");
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
        operationIds: eligible.map((item) => item.id)
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
      message: `Excluir a cobranca ${charge.chargeNumber ?? "rascunho"} para sempre? Ela some do historico e nao pode ser recuperada. As notas vinculadas voltarao a ficar disponiveis para nova cobranca.`
    });
    if (!confirmed) return;
    try {
      await window.operationsCafe.deleteClientCharge(charge.id);
      if (detail?.charge.id === charge.id) setDetail(null);
      await load();
      setSummary(await window.operationsCafe.getBillingSummary({ organizationId, includeAllCompanies }));
      setMessage("Cobranca excluida definitivamente. As notas foram liberadas para nova cobranca.");
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao excluir cobranca."}`);
    }
  }

  return (
    <section className="content-section settings">
      <PageHeader eyebrow="Cobrancas" title="Cobranca por periodo" description="Fechamentos semanais, quinzenais e mensais por cliente/corretor, com ajustes e documentos prontos." />
      <div className="cards">
        <article><span>Total a receber</span><strong>{formatCurrencyFromCents(summary?.openCents ?? 0)}</strong></article>
        <article><span>Recebido</span><strong>{formatCurrencyFromCents(summary?.receivedCents ?? 0)}</strong></article>
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
          <PartnerQuickSearch label="Cliente/corretor" value={clientId} onChange={setClientId} partners={partners} legalEntities={partnerLegalEntities} />
          <DateInput label="Inicio" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
          <DateInput label="Fim" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
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
                <strong>{eligible.length}</strong>
                <small>{decimalTextBr(eligibleSacks)} sacas · {formatCurrencyFromCents(eligibleSubtotalCents)}</small>
              </article>
              <article>
                <span>Ja em cobranca aberta</span>
                <strong>{openBilledOperations.length}</strong>
                <small>{decimalTextBr(openBilledSacks)} sacas · {formatCurrencyFromCents(openBilledChargesCents)}</small>
              </article>
              <article>
                <span>Pagas/canceladas no periodo</span>
                <strong>{receivedOrClosedOperations.length}</strong>
                <small>Apenas referencia</small>
              </article>
            </div>
            {draftDisabledReason ? <p className="charge-blocked-note">{draftDisabledReason}</p> : null}
            {missingRateOperations.length > 0 ? (
              <p className="charge-rate-alert">
                {missingRateOperations.length} nota(s) ficaram fora da cobranca porque falta regra por saca para {missingRateScopes.join(" e ")} desse cliente/corretor. Cadastre a regra e clique em "Buscar operacoes" novamente.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="charges-columns" ref={operationsRef}>
          <div className="charges-column">
            <h3>Operacoes incluidas no periodo</h3>
            {eligible.length ? (
              <div className="table">
                <div className="table-head charge-operation-grid"><span>Nota</span><span>Empresa</span><span>Operacao</span><span>Valor</span><span>Status</span><span>Acoes</span></div>
                {eligible.map((op) => {
                  const companyLabel = legalEntityLabel(op.ownLegalEntityId);
                  const issuerLabel = triangulatedIssuerLabel(op);
                  return (
                    <div key={op.id} className={`table-row charge-operation-grid ${chargeCompanyClass(companyLabel)}`}>
                      <span><strong>{operationNoteLabel(op)}</strong><small>{formatDateOnlyBr(op.operationDate)}</small>{issuerLabel ? <small>Emitida por {issuerLabel}</small> : null}</span>
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
                description={searchedOperations ? "Esse cliente/corretor nao tem operacoes confirmadas e nao cobradas nesse periodo. Confira as datas ou se as notas dele ja foram confirmadas em 'Notas e operacoes'." : "Clique em 'Buscar operacoes' para listar as operacoes elegiveis do cliente/corretor no periodo."}
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
                      <div key={op.id} className={`table-row charge-diagnostic-grid ${chargeCompanyClass(companyLabel)}`}>
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
              <strong>{formatCurrencyFromCents(visibleFinalCents)}</strong>
              {!detail && eligible.length > 0 && (advanceCents > 0 || discountCents > 0 || surchargeCents > 0) ? <small>Soma das notas elegiveis com ajustes da conta-corrente.</small> : null}
              {!detail && eligible.length > 0 && advanceCents === 0 && discountCents === 0 && surchargeCents === 0 ? <small>Soma das notas elegiveis encontradas.</small> : null}
              {!detail && openBilledChargesCents > 0 ? <small>Inclui cobrancas abertas: {formatCurrencyFromCents(openBilledChargesCents)}</small> : null}
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
        <p className="muted">Sacas e valor de servico por cliente/corretor, separado entre vendas na mesma UF e em outra UF. Clientes sem movimento no periodo aparecem zerados.</p>
        <label className="inline-check"><input type="checkbox" checked={includeAlreadyBilled} onChange={(event) => setIncludeAlreadyBilled(event.target.checked)} /> Incluir operacoes ja cobradas</label>
        <div className="table">
          <div className="table-head partner-summary-grid"><span>Cliente/corretor</span><span>Sacas mesma UF</span><span>Sacas outra UF</span><span>Valor mesma UF</span><span>Valor outra UF</span><span>Total</span><span>Acoes</span></div>
          {partnerSummary.map((row) => (
            <div key={row.partnerId} className="table-row partner-summary-grid">
              <span>{row.partnerDisplayName}</span>
              <span>{decimalTextBr(row.internalSacks)}</span>
              <span>{decimalTextBr(row.externalSacks)}</span>
              <span>{formatCurrencyFromCents(row.internalAmountCents)}</span>
              <span>{formatCurrencyFromCents(row.externalAmountCents)}</span>
              <span>{formatCurrencyFromCents(row.totalAmountCents)}</span>
              <span>
                <span className="disabled-action-tip" tabIndex={summaryDraftBlockedReason(row) ? 0 : -1}>
                  <button disabled={Boolean(summaryDraftBlockedReason(row))} onClick={() => void generateDraftForPartner(row)}>Gerar rascunho</button>
                  {summaryDraftBlockedReason(row) ? <span className="disabled-action-tip__card" role="tooltip">{summaryDraftBlockedReason(row)}</span> : null}
                </span>
              </span>
            </div>
          ))}
        </div>
      </AdminBlock>
      )}

      {chargesTab === "gerar" && detail ? <div ref={detailRef}><AdminBlock title={`Detalhe ${detail.charge.chargeNumber ?? "Rascunho"}`}>
        <div className="cards">
          <article><span>Subtotal</span><strong>{formatCurrencyFromCents(detail.charge.subtotalServicesCents)}</strong></article>
          <article><span>Ajustes +</span><strong>{formatCurrencyFromCents(detail.charge.additionsCents)}</strong></article>
          <article><span>Ajustes -</span><strong>{formatCurrencyFromCents(detail.charge.deductionsCents)}</strong></article>
          <article><span>Sacas cobradas</span><strong>{decimalTextBr(detailSacks)}</strong></article>
          <article><span>Total</span><strong>{formatCurrencyFromCents(detail.charge.finalAmountCents)}</strong></article>
          <article><span>Aberto</span><strong>{formatCurrencyFromCents(detail.charge.openAmountCents)}</strong></article>
        </div>
        <div className="table">
          <div className="table-head charge-detail-operation-grid"><span>Nota fiscal</span><span>Empresa</span><span>Data</span><span>Produto</span><span>Sacas</span><span>Servico</span><span>Situação</span></div>
          {detail.operations.map((operation) => {
            const companyLabel = operation.ownLegalEntityNameSnapshot ?? "Empresa nao registrada";
            const noteCompanyLabel = chargeDetailCompanyLabel(operation);
            return (
              <div key={operation.id} className={`table-row charge-detail-operation-grid ${chargeCompanyClass(noteCompanyLabel)}`}>
                <span>{operation.fiscalDocumentNumberSnapshot ? `NF ${operation.fiscalDocumentNumberSnapshot}` : "NF -"}</span>
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
        <div className="toolbar"><button onClick={() => void registerPayment()}>Registrar pagamento</button></div>
      </AdminBlock></div> : null}

      {chargesTab === "historico" && (
      <div ref={historyRef}><AdminBlock title="Historico de cobrancas">
        <div className="table">
          <div className="table-head charge-grid"><span>Numero</span><span>Cliente/corretor</span><span>Periodo</span><span>Total</span><span>Pago</span><span>Aberto</span><span>Status</span><span>Acoes</span></div>
          {charges.map((charge) => {
            const deleteBlockedReason = deleteChargeBlockedReason(charge);
            return (
              <div key={charge.id} className="table-row charge-grid">
                <span>{charge.chargeNumber ?? "Rascunho"}</span>
                <span>{partners.find((item) => item.id === charge.clientPartnerId)?.displayName ?? charge.clientPartnerId}</span>
                <span>{formatDateOnlyBr(charge.periodStart)} a {formatDateOnlyBr(charge.periodEnd)}</span>
                <span>{formatCurrencyFromCents(charge.finalAmountCents)}</span>
                <span>{formatCurrencyFromCents(charge.paidAmountCents)}</span>
                <span>{formatCurrencyFromCents(charge.openAmountCents)}</span>
                <span>{formatStatusLabel(charge.status)}</span>
                <span className="row-actions">
                  <button onClick={() => window.operationsCafe.getClientCharge(charge.id).then((opened) => { setDetail(opened); setChargesTab("gerar"); scrollTo(detailRef, 120); })}>Abrir</button>
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
