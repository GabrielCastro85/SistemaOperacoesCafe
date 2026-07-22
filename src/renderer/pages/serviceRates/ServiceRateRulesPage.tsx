import React, { useCallback, useEffect, useState } from "react";
import type { BootstrapData, BusinessPartner, OperationScope, Product, ServiceRateRule } from "../../../shared/types/domain";
import { formatCurrencyFromCents, parseCurrencyToCents } from "../../../shared/utils/format";
import { Feedback } from "../../components/feedback/Feedback";
import { SelectField, TextField } from "../../components/forms/LegacyFields";
import { AdminBlock, FormGrid } from "../../components/layout/SectionPrimitives";
import { PageHeader } from "../../design-system";
import { requestDecision } from "../../utils/dialogs";

const scopeLabels: Record<OperationScope, string> = { INTERNAL: "Interna", EXTERNAL: "Externa", ALL: "Todas" };
type RateRuleModalMode = "create" | "edit" | null;

const emptyRuleForm = {
  partnerId: "",
  productId: "",
  scope: "EXTERNAL" as OperationScope,
  value: "5,00",
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: "",
  priority: "1",
  notes: ""
};

export function ServiceRateRulesPage({ data }: { data: BootstrapData }): JSX.Element {
  const organizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "";
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rules, setRules] = useState<ServiceRateRule[]>([]);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [modalMode, setModalMode] = useState<RateRuleModalMode>(null);
  const [editingRule, setEditingRule] = useState<ServiceRateRule | null>(null);
  const [form, setForm] = useState(emptyRuleForm);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const clientPartners = await window.operationsCafe.listBusinessPartners({ organizationId, role: "CLIENT", status: "active" });
    const activeProducts = await window.operationsCafe.listProducts({ organizationId, status: "active" });
    const activeRules = await window.operationsCafe.listServiceRateRules({ organizationId, status: "active" });
    setPartners(clientPartners);
    setProducts(activeProducts);
    setRules(activeRules);
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  const filteredRules = rules.filter((rule) => {
    const partnerName = partnerLabel(rule.businessPartnerId);
    const productName = productLabel(rule.productId);
    const haystack = `${partnerName} ${productName} ${scopeLabels[rule.operationScope]}`.toLowerCase();
    return (!scopeFilter || rule.operationScope === scopeFilter) && haystack.includes(search.trim().toLowerCase());
  });

  function partnerLabel(id: string): string {
    return partners.find((partner) => partner.id === id)?.displayName ?? id;
  }

  function productLabel(id: string | null): string {
    return id ? products.find((product) => product.id === id)?.name ?? id : "Todos";
  }

  function updateForm(field: keyof typeof emptyRuleForm, value: string): void {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm(): void {
    setForm({ ...emptyRuleForm, partnerId: partners[0]?.id ?? "" });
    setEditingRule(null);
  }

  function openCreateModal(): void {
    setForm({ ...emptyRuleForm, partnerId: partners[0]?.id ?? "" });
    setEditingRule(null);
    setModalMode("create");
  }

  function openEditModal(rule: ServiceRateRule): void {
    setEditingRule(rule);
    setForm({
      partnerId: rule.businessPartnerId,
      productId: rule.productId ?? "",
      scope: rule.operationScope,
      value: (rule.rateValueCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      effectiveFrom: rule.effectiveFrom,
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

  function centsFromInput(value: string): number {
    return parseCurrencyToCents(value);
  }

  function buildPayload(): Record<string, unknown> {
    return {
      organizationId,
      businessPartnerId: form.partnerId,
      ownLegalEntityId: null,
      productId: form.productId || null,
      operationScope: form.scope,
      rateType: "PER_SACK",
      rateValueCents: centsFromInput(form.value),
      effectiveFrom: form.effectiveFrom,
      effectiveTo: form.effectiveTo.trim() || null,
      priority: Number.parseInt(form.priority, 10) || (form.productId ? 10 : 1),
      notes: form.notes.trim() || null,
      isActive: true
    };
  }

  async function saveRule(): Promise<void> {
    if (!form.partnerId) {
      setMessage("Erro: selecione um cliente para a regra.");
      return;
    }
    if (!form.effectiveFrom) {
      setMessage("Erro: informe a data inicial da vigencia.");
      return;
    }
    if (centsFromInput(form.value) <= 0) {
      setMessage("Erro: informe um valor por saca maior que zero.");
      return;
    }
    try {
      if (editingRule) {
        await window.operationsCafe.updateServiceRateRule(editingRule.id, buildPayload());
        setMessage("Regra por saca atualizada.");
      } else {
        await window.operationsCafe.createServiceRateRule(buildPayload());
        setMessage("Regra por saca cadastrada.");
      }
      closeModal();
      await load();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao salvar regra."}`);
    }
  }

  async function deleteRule(rule: ServiceRateRule): Promise<void> {
    const confirmed = await requestDecision({
      title: "Excluir regra por saca",
      message: `Deseja apagar definitivamente a regra de ${partnerLabel(rule.businessPartnerId)}? Operacoes antigas continuam com os valores ja calculados.`
    });
    if (!confirmed) return;
    try {
      await window.operationsCafe.deleteServiceRateRule(rule.id);
      if (editingRule?.id === rule.id) closeModal();
      setMessage("Regra por saca excluida.");
      await load();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao excluir regra."}`);
    }
  }

  return (
    <section className="content-section settings">
      <PageHeader eyebrow="Regras por saca" title="Valores comerciais por cliente" description="Cadastre vigencias, escopos e produtos para aplicar automaticamente o valor de servico por saca." />
      <AdminBlock title="Cobrancas - Regras por cliente">
        <div className="partners-list-toolbar">
          <TextField label="Pesquisar regra" value={search} onChange={setSearch} />
          <SelectField label="Tipo" value={scopeFilter} onChange={setScopeFilter} options={[["", "Todos"], ["INTERNAL", "Interna"], ["EXTERNAL", "Externa"], ["ALL", "Todas"]]} />
          <button className="partner-action-button partner-action-button--primary" onClick={openCreateModal}>Cadastrar regra</button>
        </div>
        <div className="table">
          <div className="table-head rate-grid"><span>Cliente</span><span>Tipo</span><span>Produto</span><span>Valor</span><span>Vigencia</span><span>Status</span><span>Acoes</span></div>
          {filteredRules.map((item) => (
            <div key={item.id} className="table-row rate-grid">
              <span>{partnerLabel(item.businessPartnerId)}</span>
              <span>{scopeLabels[item.operationScope]}</span>
              <span>{productLabel(item.productId)}</span>
              <span>{formatCurrencyFromCents(item.rateValueCents)} por saca</span>
              <span>{item.effectiveFrom} ate {item.effectiveTo ?? "sem data final"}</span>
              <span>{item.isActive ? "Vigente" : "Inativa"}</span>
              <span className="actions"><button onClick={() => openEditModal(item)}>Editar</button><button className="danger-action" onClick={() => void deleteRule(item)}>Excluir</button></span>
            </div>
          ))}
          {filteredRules.length === 0 ? <div className="table-row"><span>Nenhuma regra encontrada.</span></div> : null}
        </div>
      </AdminBlock>
      {modalMode ? (
        <div className="partner-modal-backdrop" role="presentation">
          <div className="partner-modal partner-modal--rate" role="dialog" aria-modal="true" aria-label={modalMode === "create" ? "Cadastrar regra por saca" : "Editar regra por saca"}>
            <header className="partner-modal__header">
              <div>
                <span>{modalMode === "create" ? "Nova regra" : "Regra existente"}</span>
                <strong>{modalMode === "create" ? "Cadastrar regra por saca" : `Editar regra de ${editingRule ? partnerLabel(editingRule.businessPartnerId) : "cliente"}`}</strong>
              </div>
              <button className="partner-modal__close" onClick={closeModal} aria-label="Fechar">x</button>
            </header>
            <div className="partner-modal__body">
              <section className="partner-action-panel">
                <div className="partner-action-panel__header">
                  <span className="partner-action-icon" aria-hidden="true">$</span>
                  <div>
                    <strong>Dados da regra</strong>
                    <small>Escolha o cliente, produto opcional, tipo de operacao e valor comercial por saca.</small>
                  </div>
                </div>
                <FormGrid>
                  <SelectField label="Cliente" value={form.partnerId} onChange={(value) => updateForm("partnerId", value)} options={partners.map((item) => [item.id, item.displayName])} />
                  <SelectField label="Tipo" value={form.scope} onChange={(value) => updateForm("scope", value)} options={[["INTERNAL", "Interna"], ["EXTERNAL", "Externa"], ["ALL", "Todas"]]} />
                  <SelectField label="Produto" value={form.productId} onChange={(value) => updateForm("productId", value)} options={[["", "Todos"], ...products.map((item) => [item.id, item.name] as [string, string])]} />
                  <TextField label="Valor por saca" value={form.value} onChange={(value) => updateForm("value", value)} />
                  <TextField label="Inicio da vigencia" value={form.effectiveFrom} onChange={(value) => updateForm("effectiveFrom", value)} />
                  <TextField label="Fim da vigencia" value={form.effectiveTo} onChange={(value) => updateForm("effectiveTo", value)} />
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
