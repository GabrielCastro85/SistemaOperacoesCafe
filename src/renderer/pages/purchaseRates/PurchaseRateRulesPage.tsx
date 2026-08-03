import React, { useCallback, useEffect, useRef, useState } from "react";
import type { BootstrapData, BusinessPartner, BusinessPartnerLegalEntity, OperationScope, Product, PurchaseRateRule } from "../../../shared/types/domain";
import { formatCurrencyFromCents, formatDateOnlyBr, parseCurrencyToCents } from "../../../shared/utils/format";
import { OPERATION_SCOPE_LABELS, SERVICE_RATE_SCOPE_OPTIONS } from "../../../shared/utils/operationLabels";
import { Feedback } from "../../components/feedback/Feedback";
import { PartnerQuickSearch } from "../../components/forms/PartnerQuickSearch";
import { SelectField, TextField } from "../../components/forms/LegacyFields";
import { AdminBlock, FormGrid } from "../../components/layout/SectionPrimitives";
import { DateInput, PageHeader } from "../../design-system";
import { useAutoScroll } from "../../hooks/useAutoScroll";
import { requestDecision } from "../../utils/dialogs";

type RateRuleModalMode = "create" | "edit" | null;

const OPEN_ENDED_EFFECTIVE_FROM = "1900-01-01";

function currentMonthStart(): string {
  return new Date().toISOString().slice(0, 8) + "01";
}

const emptyRuleForm = {
  partnerId: "",
  counterpartyPartnerLegalEntityId: "",
  productId: "",
  scope: "EXTERNAL" as OperationScope,
  value: "5,00",
  noDefinedValidity: false,
  effectiveFrom: currentMonthStart(),
  effectiveTo: "",
  priority: "1",
  notes: ""
};

export function PurchaseRateRulesPage({ data }: { data: BootstrapData }): JSX.Element {
  const organizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "";
  const [suppliers, setSuppliers] = useState<BusinessPartner[]>([]);
  const [partnerLegalEntities, setPartnerLegalEntities] = useState<BusinessPartnerLegalEntity[]>([]);
  const [counterpartyLegalEntities, setCounterpartyLegalEntities] = useState<BusinessPartnerLegalEntity[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rules, setRules] = useState<PurchaseRateRule[]>([]);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [modalMode, setModalMode] = useState<RateRuleModalMode>(null);
  const [editingRule, setEditingRule] = useState<PurchaseRateRule | null>(null);
  const [form, setForm] = useState(emptyRuleForm);
  const [message, setMessage] = useState<string | null>(null);
  const scrollTo = useAutoScroll();
  const rulesListRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const supplierPartners = await window.operationsCafe.listBusinessPartners({ role: "SUPPLIER", status: "active" });
    const allPartners = await window.operationsCafe.listBusinessPartners({ status: "active" });
    const activeProducts = await window.operationsCafe.listProducts({ status: "active" });
    const activeRules = await window.operationsCafe.listPurchaseRateRules({ organizationId, status: "active" });
    const linkedLegalEntities = (await Promise.all(allPartners.map((partner) => window.operationsCafe.listPartnerLegalEntities(partner.id)))).flat();
    const unlinkedLegalEntities = await window.operationsCafe.listUnlinkedPartnerLegalEntities(organizationId);
    const allCounterpartyLegalEntities = [...linkedLegalEntities, ...unlinkedLegalEntities]
      .filter((item) => item.isActive)
      .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index)
      .sort((a, b) => a.tradeName.localeCompare(b.tradeName, "pt-BR"));
    setSuppliers(supplierPartners);
    // Empresas/CNPJs sem fornecedor dono nao aparecem so' percorrendo os
    // fornecedores -- reaproveita o mesmo merge linked+unlinked ja feito
    // acima pra allCounterpartyLegalEntities.
    setPartnerLegalEntities(allCounterpartyLegalEntities);
    setCounterpartyLegalEntities(allCounterpartyLegalEntities);
    setProducts(activeProducts);
    setRules(activeRules);
    setForm((current) => ({ ...current, partnerId: current.partnerId || supplierPartners[0]?.id || "" }));
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  const filteredRules = rules.filter((rule) => {
    const haystack = `${supplierLabel(rule.businessPartnerId)} ${counterpartyLabel(rule.counterpartyPartnerLegalEntityId)} ${productLabel(rule.productId)} ${OPERATION_SCOPE_LABELS[rule.operationScope]}`.toLowerCase();
    return (!scopeFilter || rule.operationScope === scopeFilter) && haystack.includes(search.trim().toLowerCase());
  });

  function supplierLabel(id: string): string {
    return suppliers.find((supplier) => supplier.id === id)?.displayName ?? id;
  }

  function counterpartyLabel(id: string | null): string {
    return id ? counterpartyLegalEntities.find((entity) => entity.id === id)?.tradeName ?? partnerLegalEntities.find((entity) => entity.id === id)?.tradeName ?? id : "Todas";
  }

  function productLabel(id: string | null): string {
    return id ? products.find((product) => product.id === id)?.name ?? id : "Todos";
  }

  function updateForm(field: keyof typeof emptyRuleForm, value: string): void {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreateModal(): void {
    setEditingRule(null);
    setForm({ ...emptyRuleForm, partnerId: suppliers[0]?.id ?? "" });
    setModalMode("create");
  }

  function openEditModal(rule: PurchaseRateRule): void {
    const hasNoDefinedValidity = rule.effectiveFrom === OPEN_ENDED_EFFECTIVE_FROM && !rule.effectiveTo;
    setEditingRule(rule);
    setForm({
      partnerId: rule.businessPartnerId,
      counterpartyPartnerLegalEntityId: rule.counterpartyPartnerLegalEntityId ?? "",
      productId: rule.productId ?? "",
      scope: rule.operationScope,
      value: (rule.rateValueCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      noDefinedValidity: hasNoDefinedValidity,
      effectiveFrom: hasNoDefinedValidity ? "" : rule.effectiveFrom,
      effectiveTo: rule.effectiveTo ?? "",
      priority: String(rule.priority),
      notes: rule.notes ?? ""
    });
    setModalMode("edit");
  }

  function closeModal(): void {
    setModalMode(null);
    setEditingRule(null);
  }

  function resetForm(): void {
    setForm({ ...emptyRuleForm, partnerId: suppliers[0]?.id ?? "" });
  }

  function buildPayload(): Record<string, unknown> {
    return {
      organizationId,
      businessPartnerId: form.partnerId,
      ownLegalEntityId: null,
      counterpartyPartnerLegalEntityId: form.counterpartyPartnerLegalEntityId || null,
      productId: form.productId || null,
      operationScope: form.scope,
      rateType: "PER_SACK",
      rateValueCents: parseCurrencyToCents(form.value),
      effectiveFrom: form.noDefinedValidity ? OPEN_ENDED_EFFECTIVE_FROM : form.effectiveFrom,
      effectiveTo: form.noDefinedValidity ? null : form.effectiveTo.trim() || null,
      priority: Number.parseInt(form.priority, 10) || (form.productId ? 10 : 1),
      notes: form.notes.trim() || null,
      isActive: true
    };
  }

  async function saveRule(): Promise<void> {
    if (!form.partnerId) {
      setMessage("Erro: selecione um fornecedor para a regra.");
      return;
    }
    if (!form.noDefinedValidity && !form.effectiveFrom) {
      setMessage("Erro: informe a data inicial da vigencia.");
      return;
    }
    if (parseCurrencyToCents(form.value) <= 0) {
      setMessage("Erro: informe um valor por saca maior que zero.");
      return;
    }
    try {
      const saved = editingRule
        ? await window.operationsCafe.updatePurchaseRateRule(editingRule.id, buildPayload())
        : await window.operationsCafe.createPurchaseRateRule(buildPayload());
      const baseMessage = editingRule ? "Regra de entrada atualizada." : "Regra de entrada cadastrada.";
      setMessage(saved.conflictWarning ? `${baseMessage} Atencao: ${saved.conflictWarning}` : baseMessage);
      closeModal();
      await load();
      scrollTo(rulesListRef);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao salvar regra de entrada."}`);
    }
  }

  function validityLabel(rule: PurchaseRateRule): string {
    if (rule.effectiveFrom === OPEN_ENDED_EFFECTIVE_FROM && !rule.effectiveTo) return "Sem vigencia definida";
    return `${formatDateOnlyBr(rule.effectiveFrom)} ate ${rule.effectiveTo ? formatDateOnlyBr(rule.effectiveTo) : "sem data final"}`;
  }

  async function deleteRule(rule: PurchaseRateRule): Promise<void> {
    const confirmed = await requestDecision({
      title: "Excluir regra de entrada",
      message: `Deseja apagar definitivamente a regra de ${supplierLabel(rule.businessPartnerId)}? Operacoes antigas continuam com os valores ja calculados.`
    });
    if (!confirmed) return;
    try {
      await window.operationsCafe.deletePurchaseRateRule(rule.id);
      setMessage("Regra de entrada excluida.");
      await load();
      scrollTo(rulesListRef);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao excluir regra de entrada."}`);
    }
  }

  return (
    <section className="content-section settings compact-crud-page service-rates-page">
      <PageHeader eyebrow="Notas de entrada" title="Regras de entrada por saca" description="Cadastre quanto a empresa deve pagar por saca ao fornecedor em notas de entrada, separado por fornecedor, empresa da nota, produto e UF." />
      <div ref={rulesListRef}>
        <AdminBlock title="Pagamentos - Regras por fornecedor">
          <div className="partners-list-toolbar service-rate-toolbar">
            <TextField label="Pesquisar regra" value={search} onChange={setSearch} />
            <SelectField label="UF da venda" value={scopeFilter} onChange={setScopeFilter} options={[["", "Todos"], ...SERVICE_RATE_SCOPE_OPTIONS]} />
            <button className="partner-action-button partner-action-button--primary" onClick={openCreateModal}>Cadastrar regra de entrada</button>
          </div>
          <div className="table">
            <div className="table-head rate-grid rate-grid--with-alert"><span>Fornecedor</span><span>Empresa da nota</span><span>UF da venda</span><span>Produto</span><span>Valor</span><span>Vigencia</span><span>Status</span><span>Alerta</span><span>Acoes</span></div>
            {filteredRules.map((item) => (
              <div key={item.id} className="table-row rate-grid rate-grid--with-alert">
                <span>{supplierLabel(item.businessPartnerId)}</span>
                <span>{counterpartyLabel(item.counterpartyPartnerLegalEntityId)}</span>
                <span>{OPERATION_SCOPE_LABELS[item.operationScope]}</span>
                <span>{productLabel(item.productId)}</span>
                <span>{formatCurrencyFromCents(item.rateValueCents)} por saca</span>
                <span>{validityLabel(item)}</span>
                <span>{item.isActive ? "Vigente" : "Inativa"}</span>
                <span title={item.conflictWarning ?? undefined} className={item.conflictWarning ? "rate-conflict-flag" : undefined}>{item.conflictWarning ? "Conflito de regra" : "-"}</span>
                <span className="actions"><button onClick={() => openEditModal(item)}>Editar</button><button className="danger-action" onClick={() => void deleteRule(item)}>Excluir</button></span>
              </div>
            ))}
            {filteredRules.length === 0 ? <div className="table-row"><span>Nenhuma regra de entrada encontrada.</span></div> : null}
          </div>
        </AdminBlock>
      </div>

      {modalMode ? (
        <div className="partner-modal-backdrop" role="presentation">
          <div className="partner-modal partner-modal--rate" role="dialog" aria-modal="true" aria-label={modalMode === "create" ? "Cadastrar regra de entrada" : "Editar regra de entrada"}>
            <header className="partner-modal__header">
              <div>
                <span>{modalMode === "create" ? "Nova regra" : "Regra existente"}</span>
                <strong>{modalMode === "create" ? "Cadastrar regra de entrada" : `Editar regra de ${editingRule ? supplierLabel(editingRule.businessPartnerId) : "fornecedor"}`}</strong>
              </div>
              <button className="partner-modal__close" onClick={closeModal} aria-label="Fechar">x</button>
            </header>
            <div className="partner-modal__body">
              <section className="partner-action-panel">
                <div className="partner-action-panel__header">
                  <span className="partner-action-icon" aria-hidden="true">$</span>
                  <div>
                    <strong>Dados da regra de entrada</strong>
                    <small>Use para notas que geram valor a pagar ao fornecedor por saca.</small>
                  </div>
                </div>
                <FormGrid>
                  <PartnerQuickSearch label="Fornecedor" value={form.partnerId} onChange={(value) => updateForm("partnerId", value)} partners={suppliers} legalEntities={partnerLegalEntities} />
                  <SelectField label="Empresa da nota especifica" value={form.counterpartyPartnerLegalEntityId} onChange={(value) => updateForm("counterpartyPartnerLegalEntityId", value)} options={[["", "Todas"], ...counterpartyLegalEntities.map((item) => [item.id, item.tradeName] as [string, string])]} />
                  <SelectField label="UF da venda" value={form.scope} onChange={(value) => updateForm("scope", value)} options={SERVICE_RATE_SCOPE_OPTIONS} />
                  <SelectField label="Produto" value={form.productId} onChange={(value) => updateForm("productId", value)} options={[["", "Todos"], ...products.map((item) => [item.id, item.name] as [string, string])]} />
                  <TextField label="Valor por saca" value={form.value} onChange={(value) => updateForm("value", value)} />
                  <label className="checkbox"><input type="checkbox" checked={form.noDefinedValidity} onChange={(event) => setForm((current) => ({ ...current, noDefinedValidity: event.target.checked, effectiveFrom: event.target.checked ? "" : current.effectiveFrom || currentMonthStart(), effectiveTo: event.target.checked ? "" : current.effectiveTo }))} /> Sem vigencia definida</label>
                  <DateInput label="Inicio da vigencia" value={form.effectiveFrom} disabled={form.noDefinedValidity} onChange={(event) => updateForm("effectiveFrom", event.target.value)} />
                  <DateInput label="Fim da vigencia" value={form.effectiveTo} disabled={form.noDefinedValidity} onChange={(event) => updateForm("effectiveTo", event.target.value)} />
                  <TextField label="Prioridade" value={form.priority} onChange={(value) => updateForm("priority", value)} />
                  <TextField label="Observacoes" value={form.notes} onChange={(value) => updateForm("notes", value)} />
                </FormGrid>
              </section>
            </div>
            <footer className="partner-modal__footer">
              <button className="partner-action-button" onClick={resetForm}>Limpar dados</button>
              <button className="partner-action-button partner-action-button--primary" onClick={() => void saveRule()}>{editingRule ? "Salvar edicao" : "Cadastrar regra"}</button>
              <button className="partner-action-button" onClick={closeModal}>Fechar</button>
            </footer>
          </div>
        </div>
      ) : null}
      <Feedback message={message} />
    </section>
  );
}
