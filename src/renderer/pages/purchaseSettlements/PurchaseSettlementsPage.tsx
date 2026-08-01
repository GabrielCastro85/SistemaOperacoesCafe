import React, { useCallback, useEffect, useRef, useState } from "react";
import type { AccountPayable, AccountPayableDetail, AccountPayableOperation, BillingPeriodicity, BootstrapData, BusinessPartner, BusinessPartnerLegalEntity, ExpenseCategory, FiscalDocument, LegalEntity, Operation, PartnerRateSummaryRow } from "../../../shared/types/domain";
import { sumDecimalTexts } from "../../../shared/utils/decimal";
import { formatCurrencyFromCents, formatDateOnlyBr } from "../../../shared/utils/format";
import { formatOperationScope } from "../../../shared/utils/operationLabels";
import { formatStatusLabel } from "../../../shared/utils/statusLabels";
import { Feedback } from "../../components/feedback/Feedback";
import { PartnerQuickSearch } from "../../components/forms/PartnerQuickSearch";
import { SelectField } from "../../components/forms/LegacyFields";
import { AdminBlock, FormGrid } from "../../components/layout/SectionPrimitives";
import { DateInput, EmptyState, PageHeader, Tabs } from "../../design-system";
import { useAutoScroll } from "../../hooks/useAutoScroll";

const INCLUDE_ALL_COMPANIES_IN_PURCHASES = true;

const PERIODICITY_ITEMS: Array<{ id: BillingPeriodicity; label: string }> = [
  { id: "WEEKLY", label: "Semanal" },
  { id: "MONTHLY", label: "Mensal" },
  { id: "BIWEEKLY", label: "Quinzenal" }
];

function decimalTextBr(value: string | null | undefined): string {
  return value ? value.replace(".", ",") : "0";
}

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

export function PurchaseSettlementsPage({ data }: { data: BootstrapData }): JSX.Element {
  const organizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "";
  const ownLegalEntityId = data.profile?.defaultLegalEntityId ?? data.legalEntities.find((item) => item.organizationId === organizationId)?.id ?? "";
  const includeAllCompanies = INCLUDE_ALL_COMPANIES_IN_PURCHASES;
  const [suppliers, setSuppliers] = useState<BusinessPartner[]>([]);
  const [partnerLegalEntities, setPartnerLegalEntities] = useState<BusinessPartnerLegalEntity[]>([]);
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>(data.legalEntities);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [periodicity, setPeriodicity] = useState<BillingPeriodicity>("MONTHLY");
  const [periodStart, setPeriodStart] = useState(() => currentBillingRange("MONTHLY").periodStart);
  const [periodEnd, setPeriodEnd] = useState(() => localDateInputValue(new Date()));
  const [dueDate, setDueDate] = useState(() => localDateInputValue(new Date()));
  const [eligible, setEligible] = useState<Operation[]>([]);
  const [operationDocuments, setOperationDocuments] = useState<Record<string, FiscalDocument>>({});
  const [summary, setSummary] = useState<PartnerRateSummaryRow[]>([]);
  const [detail, setDetail] = useState<AccountPayableDetail | null>(null);
  const [searchedOperations, setSearchedOperations] = useState(false);
  const [tab, setTab] = useState<"gerar" | "resumo" | "historico">("gerar");
  const [settlements, setSettlements] = useState<AccountPayable[]>([]);
  const [expandedSettlementId, setExpandedSettlementId] = useState<string | null>(null);
  const [expandedSettlementOperations, setExpandedSettlementOperations] = useState<AccountPayableOperation[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const scrollTo = useAutoScroll();
  const operationsRef = useRef<HTMLDivElement | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const supplierPartners = await window.operationsCafe.listBusinessPartners({ role: "SUPPLIER", status: "active" });
    const expenseCategories = await window.operationsCafe.listExpenseCategories(organizationId);
    setSuppliers(supplierPartners);
    setPartnerLegalEntities((await Promise.all(supplierPartners.map((partner) => window.operationsCafe.listPartnerLegalEntities(partner.id)))).flat());
    setLegalEntities(await window.operationsCafe.listLegalEntities({ status: "all" }));
    setCategories(expenseCategories.filter((category) => category.isActive));
    setCategoryId((current) => current || expenseCategories.find((category) => category.isActive)?.id || expenseCategories[0]?.id || "");
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  const loadSettlements = useCallback(async () => {
    const payables = await window.operationsCafe.listAccountsPayable({ organizationId, status: "all" });
    setSettlements(payables.filter((payable) => payable.source === "IMPORT"));
  }, [organizationId]);

  useEffect(() => { void loadSettlements(); }, [loadSettlements]);

  async function toggleSettlementOperations(payableId: string): Promise<void> {
    if (expandedSettlementId === payableId) {
      setExpandedSettlementId(null);
      setExpandedSettlementOperations([]);
      return;
    }
    setExpandedSettlementId(payableId);
    setExpandedSettlementOperations(await window.operationsCafe.listAccountPayableOperations(payableId));
  }

  function openSettlementInPayables(payableId: string): void {
    window.location.hash = `#/finance/payables/${payableId}`;
  }

  const loadSummary = useCallback(async () => {
    setSummary(await window.operationsCafe.getSupplierPurchaseSummary({ organizationId, ownLegalEntityId, periodStart, periodEnd, includeAllCompanies }));
  }, [organizationId, ownLegalEntityId, periodStart, periodEnd, includeAllCompanies]);

  useEffect(() => { void loadSummary(); }, [loadSummary]);
  useEffect(() => { setEligible([]); setSearchedOperations(false); setDetail(null); }, [supplierId]);

  async function loadOperationDocuments(operations: Operation[]): Promise<void> {
    const fiscalDocumentIds = Array.from(new Set(operations.map((operation) => operation.fiscalDocumentId).filter(Boolean)));
    const entries = await Promise.all(fiscalDocumentIds.map(async (id) => {
      const documentDetail = await window.operationsCafe.getFiscalDocument(id);
      return [id, documentDetail.document] as const;
    }));
    setOperationDocuments(Object.fromEntries(entries));
  }

  function legalEntityLabel(id: string): string {
    return legalEntities.find((entity) => entity.id === id)?.tradeName ?? data.legalEntities.find((entity) => entity.id === id)?.tradeName ?? id;
  }

  function operationDocument(operation: Operation): FiscalDocument | null {
    return operationDocuments[operation.fiscalDocumentId] ?? null;
  }

  function operationNoteLabel(operation: Operation): string {
    const document = operationDocument(operation);
    return document?.documentNumber ? `NF ${document.documentNumber}` : "NF nao localizada";
  }

  async function findOperations(): Promise<void> {
    await findOperationsForRange(periodStart, periodEnd);
  }

  async function findOperationsForRange(nextPeriodStart: string, nextPeriodEnd: string): Promise<Operation[]> {
    setDetail(null);
    const found = await window.operationsCafe.findEligiblePurchaseOperations({ organizationId, ownLegalEntityId, supplierPartnerId: supplierId, periodStart: nextPeriodStart, periodEnd: nextPeriodEnd, includeAllCompanies });
    await loadOperationDocuments(found);
    setEligible(found);
    setSearchedOperations(true);
    setMessage(found.length > 0 ? `${found.length} nota(s) de entrada encontrada(s) para acerto.` : "Nenhuma nota de entrada elegivel encontrada nesse periodo para o fornecedor.");
    await loadSummary();
    scrollTo(operationsRef);
    return found;
  }

  async function applyPeriodicityFilter(nextPeriodicity: BillingPeriodicity): Promise<void> {
    const range = currentBillingRange(nextPeriodicity);
    setPeriodicity(nextPeriodicity);
    setPeriodStart(range.periodStart);
    setPeriodEnd(range.periodEnd);
    setDueDate(localDateInputValue(new Date()));
    setDetail(null);
    setEligible([]);
    setSearchedOperations(false);
    setMessage(`Filtro ajustado para ${range.label}: ${formatDateOnlyBr(range.periodStart)} a ${formatDateOnlyBr(range.periodEnd)}.`);
    if (supplierId) await findOperationsForRange(range.periodStart, range.periodEnd);
  }

  const totalSacks = eligible.length ? sumDecimalTexts(eligible.map((operation) => operation.quantitySacks)) : "0";
  const totalCents = eligible.reduce((total, operation) => total + operation.serviceAmountCents, 0);
  const blockedReason = settlementBlockedReason();

  function settlementBlockedReason(): string | null {
    if (!supplierId) return "Selecione um fornecedor antes de gerar o acerto.";
    if (!categoryId) return "Cadastre ou selecione uma categoria financeira para a conta a pagar.";
    if (!periodStart || !periodEnd || !dueDate) return "Informe inicio, fim e vencimento para gerar o acerto.";
    if (!searchedOperations) return "Clique em 'Buscar notas de entrada' para localizar as notas elegiveis.";
    if (eligible.length === 0) return "Nenhuma nota de entrada elegivel foi encontrada para esse fornecedor no periodo.";
    return null;
  }

  async function createSettlement(nextSupplierId = supplierId, operations = eligible): Promise<void> {
    if (!categoryId || operations.length === 0) return;
    try {
      const nextDetail = await window.operationsCafe.generatePurchaseSettlement({
        organizationId,
        ownLegalEntityId,
        supplierPartnerId: nextSupplierId,
        operationIds: operations.map((operation) => operation.id),
        categoryId,
        dueDate,
        notes: `Acerto de entrada por saca de ${formatDateOnlyBr(periodStart)} a ${formatDateOnlyBr(periodEnd)}`
      });
      setDetail(nextDetail);
      setMessage("Acerto de entrada gerado em contas a pagar.");
      setEligible([]);
      setSearchedOperations(false);
      await loadSummary();
      await loadSettlements();
      scrollTo(detailRef);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao gerar acerto de entrada."}`);
    }
  }

  async function createSettlementForSupplier(row: PartnerRateSummaryRow): Promise<void> {
    try {
      const operations = await window.operationsCafe.findEligiblePurchaseOperations({ organizationId, ownLegalEntityId, supplierPartnerId: row.partnerId, periodStart, periodEnd, includeAllCompanies });
      if (operations.length === 0) {
        setMessage(`Nenhuma nota de entrada em aberto para ${row.partnerDisplayName} no periodo.`);
        return;
      }
      await loadOperationDocuments(operations);
      setSupplierId(row.partnerId);
      setEligible(operations);
      setSearchedOperations(true);
      setTab("gerar");
      await createSettlement(row.partnerId, operations);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao gerar acerto."}`);
    }
  }

  function openPayable(): void {
    if (!detail) return;
    window.location.hash = `#/finance/payables/${detail.payable.id}`;
  }

  return (
    <section className="content-section settings purchase-settlements-page">
      <PageHeader eyebrow="Notas de entrada" title="Acertos a pagar por saca" description="Agrupe notas de entrada por fornecedor, confira sacas e valores por saca, e gere a conta a pagar para controle financeiro." />

      <div className="settings-tabs">
        <button className={tab === "gerar" ? "active" : ""} onClick={() => setTab("gerar")}>Gerar acerto</button>
        <button className={tab === "resumo" ? "active" : ""} onClick={() => setTab("resumo")}>Resumo por fornecedor</button>
        <button className={tab === "historico" ? "active" : ""} onClick={() => setTab("historico")}>Historico</button>
      </div>

      {tab === "gerar" ? (
        <AdminBlock title="Gerar acerto de entrada">
          <div className="charge-context-note">
            <span>Escopo do acerto</span>
            <strong>Todas as empresas do sistema</strong>
            <small>Notas de entrada de Villa, Grao & Grao e terceiros entram na consulta quando tiverem fornecedor e regra de entrada aplicada.</small>
          </div>
          <FormGrid>
            <PartnerQuickSearch label="Fornecedor" value={supplierId} onChange={setSupplierId} partners={suppliers} legalEntities={partnerLegalEntities} />
            <DateInput label="Inicio" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
            <DateInput label="Fim" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
            <DateInput label="Vencimento" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            <SelectField label="Categoria financeira" value={categoryId} onChange={setCategoryId} options={categories.map((category) => [category.id, category.name] as [string, string])} />
          </FormGrid>
          <div className="inline-actions" style={{ marginBottom: "var(--space-4)" }}>
            <span className="muted">Periodicidade:</span>
            <Tabs items={PERIODICITY_ITEMS} active={periodicity} onChange={(next) => void applyPeriodicityFilter(next as BillingPeriodicity)} />
          </div>
          <div className="toolbar">
            <button onClick={() => void findOperations()}>Buscar notas de entrada</button>
          </div>

          <div className="charges-columns" ref={operationsRef}>
            <div className="charges-column">
              <h3>Notas de entrada no periodo</h3>
              {eligible.length ? (
                <div className="table">
                  <div className="table-head purchase-operation-grid"><span>Nota</span><span>Empresa</span><span>Operacao</span><span>Valor</span><span>Status</span></div>
                  {eligible.map((operation) => (
                    <div key={operation.id} className="table-row purchase-operation-grid">
                      <span><strong>{operationNoteLabel(operation)}</strong><small>{formatDateOnlyBr(operation.operationDate)}</small></span>
                      <span>{legalEntityLabel(operation.ownLegalEntityId)}</span>
                      <span><strong>{formatOperationScope(operation.operationScope)}</strong><small>{decimalTextBr(operation.quantitySacks)} sacas · {formatCurrencyFromCents(operation.appliedRateValueCents)}/saca</small></span>
                      <span><strong>{formatCurrencyFromCents(operation.serviceAmountCents)}</strong><small>{formatCurrencyFromCents(operation.serviceAmountCents)} x {operationNoteLabel(operation)}</small></span>
                      <span>{operation.purchaseSettlementStatus === "UNSETTLED" ? "Nao acertada" : "Ja em acerto"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title={searchedOperations ? "Nenhuma nota de entrada elegivel" : "Nenhuma nota carregada"} description={searchedOperations ? "Esse fornecedor nao tem notas de entrada confirmadas e nao acertadas no periodo selecionado." : "Clique em 'Buscar notas de entrada' para listar as notas elegiveis do fornecedor no periodo."} />
              )}
            </div>
            <div className="charges-column">
              <h3>Resumo do acerto</h3>
              <div className="charges-final-card">
                <span>Sacas a pagar</span>
                <strong>{decimalTextBr(totalSacks)}</strong>
                <small>{eligible.length} nota(s) de entrada selecionada(s)</small>
              </div>
              <div className="charges-final-card">
                <span>Valor total a pagar</span>
                <strong>{formatCurrencyFromCents(totalCents)}</strong>
                <small>Calculado pelas regras de entrada por saca.</small>
                <span className="disabled-action-tip" tabIndex={blockedReason ? 0 : -1}>
                  <button className="primary" onClick={() => void createSettlement()} disabled={Boolean(blockedReason)}>Gerar acerto a pagar</button>
                  {blockedReason ? <span className="disabled-action-tip__card" role="tooltip">{blockedReason}</span> : null}
                </span>
              </div>
            </div>
          </div>
        </AdminBlock>
      ) : null}

      {tab === "resumo" ? (
        <AdminBlock title="Resumo do periodo por fornecedor">
          <p className="muted">Sacas e valor a pagar por fornecedor, separado entre notas da mesma UF e de outra UF.</p>
          <div className="table">
            <div className="table-head partner-summary-grid"><span>Fornecedor</span><span>Sacas mesma UF</span><span>Sacas outra UF</span><span>Valor mesma UF</span><span>Valor outra UF</span><span>Total</span><span>Acoes</span></div>
            {summary.map((row) => (
              <div key={row.partnerId} className="table-row partner-summary-grid">
                <span>{row.partnerDisplayName}</span>
                <span>{decimalTextBr(row.internalSacks)}</span>
                <span>{decimalTextBr(row.externalSacks)}</span>
                <span>{formatCurrencyFromCents(row.internalAmountCents)}</span>
                <span>{formatCurrencyFromCents(row.externalAmountCents)}</span>
                <span>{formatCurrencyFromCents(row.totalAmountCents)}</span>
                <span><button disabled={row.operationCount === 0 || !categoryId} onClick={() => void createSettlementForSupplier(row)}>Gerar acerto</button></span>
              </div>
            ))}
            {summary.length === 0 ? <div className="table-row"><span>Nenhum fornecedor com notas de entrada no periodo.</span></div> : null}
          </div>
        </AdminBlock>
      ) : null}

      {tab === "historico" ? (
        <div ref={historyRef}>
          <AdminBlock title="Historico de acertos de entrada">
            <p className="muted">Todos os acertos ja gerados, com o detalhamento nota a nota preservado -- use isso como prova em caso de cobranca indevida do fornecedor.</p>
            <div className="table">
              <div className="table-head purchase-settlement-history-grid"><span>Fornecedor</span><span>Vencimento</span><span>Valor</span><span>Status</span><span>Acoes</span></div>
              {settlements.map((payable) => (
                <React.Fragment key={payable.id}>
                  <div className="table-row purchase-settlement-history-grid">
                    <span>{payable.payeeNameSnapshot}</span>
                    <span>{formatDateOnlyBr(payable.dueDate)}</span>
                    <span>{formatCurrencyFromCents(payable.finalAmountCents ?? 0)}</span>
                    <span>{formatStatusLabel(payable.status)}</span>
                    <span className="row-actions">
                      <button onClick={() => void toggleSettlementOperations(payable.id)}>{expandedSettlementId === payable.id ? "Ocultar notas" : "Ver notas"}</button>
                      <button onClick={() => openSettlementInPayables(payable.id)}>Abrir em contas a pagar</button>
                    </span>
                  </div>
                  {expandedSettlementId === payable.id ? (
                    <div className="table-row purchase-settlement-history-detail">
                      <div className="table">
                        <div className="table-head purchase-operation-grid"><span>Nota</span><span>Empresa</span><span>Operacao</span><span>Sacas</span><span>Valor</span></div>
                        {expandedSettlementOperations.map((operation) => (
                          <div key={operation.id} className="table-row purchase-operation-grid">
                            <span>{operation.fiscalDocumentNumberSnapshot ? `NF ${operation.fiscalDocumentNumberSnapshot}` : "NF -"}</span>
                            <span>{operation.ownLegalEntityNameSnapshot ?? "-"}</span>
                            <span>{formatOperationScope(operation.operationScopeSnapshot)}</span>
                            <span>{decimalTextBr(operation.quantitySacksDecimalSnapshot)}</span>
                            <span>{formatCurrencyFromCents(operation.purchaseAmountCentsSnapshot)}</span>
                          </div>
                        ))}
                        {expandedSettlementOperations.length === 0 ? <div className="table-row"><span>Nenhuma nota registrada nesse acerto.</span></div> : null}
                      </div>
                    </div>
                  ) : null}
                </React.Fragment>
              ))}
              {settlements.length === 0 ? <div className="table-row"><span>Nenhum acerto de entrada gerado ainda.</span></div> : null}
            </div>
          </AdminBlock>
        </div>
      ) : null}

      {detail ? (
        <div ref={detailRef}>
          <AdminBlock title="Acerto gerado">
            <div className="cards">
              <article><span>Fornecedor</span><strong>{detail.payable.payeeNameSnapshot}</strong></article>
              <article><span>Valor a pagar</span><strong>{formatCurrencyFromCents(detail.payable.finalAmountCents ?? 0)}</strong></article>
              <article><span>Vencimento</span><strong>{formatDateOnlyBr(detail.payable.dueDate)}</strong></article>
              <article><span>Status</span><strong>{detail.payable.status}</strong></article>
            </div>
            <div className="toolbar"><button className="primary" onClick={openPayable}>Abrir em contas a pagar</button></div>
          </AdminBlock>
        </div>
      ) : null}
      <Feedback message={message} />
    </section>
  );
}
