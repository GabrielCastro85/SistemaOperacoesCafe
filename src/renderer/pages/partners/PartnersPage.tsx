import React, { useCallback, useEffect, useRef, useState } from "react";
import type { BootstrapData, BusinessPartner, BusinessPartnerLegalEntity, BusinessPartnerRole, CnpjLookupResult, OperationScope, PartnerContact, ServiceRateRule } from "../../../shared/types/domain";
import { formatCnpj, formatCurrencyFromCents, formatDateBr, isValidCnpj, onlyDigits, parseCurrencyToCents } from "../../../shared/utils/format";
import { PageHeader } from "../../design-system";
import { Feedback } from "../../components/feedback/Feedback";
import { SelectField, TextField } from "../../components/forms/LegacyFields";
import { AdminBlock, FormGrid } from "../../components/layout/SectionPrimitives";
import { requestDecision } from "../../utils/dialogs";
import { useAutoScroll } from "../../hooks/useAutoScroll";
import { OPERATION_SCOPE_LABELS } from "../../../shared/utils/operationLabels";
const roleLabels: Record<BusinessPartnerRole, string> = { CLIENT: "Cliente/corretor", SUPPLIER: "Fornecedor", SELLER: "Vendedor", BUYER: "Empresa", DESTINATION: "Destino", CARRIER: "Transportadora", SERVICE_PROVIDER: "Prestador de servico", OTHER: "Outro" };
const roleOptions: BusinessPartnerRole[] = ["CLIENT", "BUYER", "SUPPLIER", "SELLER", "DESTINATION", "CARRIER", "SERVICE_PROVIDER", "OTHER"];
type PartnerModalMode = "createClient" | "editClient" | "createCompany" | "editCompany" | null;
type PartnersTab = "clients" | "companies";
const OPEN_ENDED_EFFECTIVE_FROM = "1900-01-01";

const emptyLegalEntityForm = {
  cnpj: "",
  legalName: "",
  tradeName: "",
  stateRegistration: "",
  municipalRegistration: "",
  email: "",
  phone: "",
  addressLine: "",
  addressNumber: "",
  addressComplement: "",
  district: "",
  city: "",
  state: "",
  postalCode: ""
};

const emptyClientForm = {
  documentNumber: "",
  email: "",
  phone: "",
  mobile: "",
  postalCode: "",
  addressLine: "",
  addressNumber: "",
  addressComplement: "",
  district: "",
  city: "",
  state: "",
  notes: ""
};

const emptyBrokerRuleForm = {
  specificCounterpartyLegalEntityId: "",
  specificCounterpartyValue: "",
  internalValue: "",
  externalValue: ""
};

type ClientForm = typeof emptyClientForm;
type LegalEntityForm = typeof emptyLegalEntityForm;
type BrokerRuleForm = typeof emptyBrokerRuleForm;

export function PartnersPage({ data }: { data: BootstrapData; refresh?: () => Promise<BootstrapData> }): JSX.Element {
  const [items, setItems] = useState<BusinessPartner[]>([]);
  const [allPartners, setAllPartners] = useState<BusinessPartner[]>([]);
  const [selected, setSelected] = useState<BusinessPartner | null>(null);
  const [legalEntities, setLegalEntities] = useState<BusinessPartnerLegalEntity[]>([]);
  const [allLegalEntities, setAllLegalEntities] = useState<BusinessPartnerLegalEntity[]>([]);
  const [selectedRateRules, setSelectedRateRules] = useState<ServiceRateRule[]>([]);
  const [contacts, setContacts] = useState<PartnerContact[]>([]);
  const [search, setSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PartnersTab>("clients");
  const organizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "";
  const [partnerName, setPartnerName] = useState("");
  const [creditLimitInput, setCreditLimitInput] = useState("");
  const [editCreditLimitInput, setEditCreditLimitInput] = useState("");
  const [clientForm, setClientForm] = useState<ClientForm>(emptyClientForm);
  const [editClientForm, setEditClientForm] = useState<ClientForm>(emptyClientForm);
  const [brokerRuleForm, setBrokerRuleForm] = useState<BrokerRuleForm>(emptyBrokerRuleForm);
  const [editBrokerRuleForm, setEditBrokerRuleForm] = useState<BrokerRuleForm>(emptyBrokerRuleForm);
  const [roles, setRoles] = useState<BusinessPartnerRole[]>(["CLIENT"]);
  const [contactName, setContactName] = useState("");
  const [manualLegalEntityForm, setManualLegalEntityForm] = useState(emptyLegalEntityForm);
  const [detailLegalEntityForm, setDetailLegalEntityForm] = useState(emptyLegalEntityForm);
  const [lookupCnpjInput, setLookupCnpjInput] = useState("");
  const [lookupResult, setLookupResult] = useState<CnpjLookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [editPartnerName, setEditPartnerName] = useState("");
  const [editPartnerRoles, setEditPartnerRoles] = useState<BusinessPartnerRole[]>([]);
  const [editingLegalEntityId, setEditingLegalEntityId] = useState<string | null>(null);
  const [companyOwnerPartnerId, setCompanyOwnerPartnerId] = useState("");
  const [linkCompanySearch, setLinkCompanySearch] = useState("");
  const [linkCompanyResults, setLinkCompanyResults] = useState<BusinessPartnerLegalEntity[]>([]);
  const [linkCompanySearching, setLinkCompanySearching] = useState(false);
  const [modalMode, setModalMode] = useState<PartnerModalMode>(null);
  const scrollTo = useAutoScroll();
  const partnersListRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const searchedPartners = await window.operationsCafe.listBusinessPartners({ search, status: "active" });
    const activePartners = await window.operationsCafe.listBusinessPartners({ status: "active" });
    setItems(searchedPartners.filter((partner) => partner.roles.includes("CLIENT") || partner.roles.includes("SUPPLIER")));
    setAllPartners(activePartners);
    // Empresas/CNPJs sem cliente/corretor dono nao aparecem percorrendo os
    // parceiros (nao tem partner.id pra' consultar) -- precisa buscar as
    // soltas separadamente e juntar, senao a aba "Empresas/CNPJs" mostra so'
    // as ja vinculadas.
    const [linkedEntities, unlinkedEntities] = await Promise.all([
      Promise.all(activePartners.map((partner) => window.operationsCafe.listPartnerLegalEntities(partner.id))),
      organizationId ? window.operationsCafe.listUnlinkedPartnerLegalEntities(organizationId) : Promise.resolve([])
    ]);
    setAllLegalEntities([...linkedEntities.flat(), ...unlinkedEntities]);
  }, [search, organizationId]);
  useEffect(() => { void load(); }, [load]);

  async function loadDetail(partner: BusinessPartner): Promise<void> {
    setSelected(partner);
    setEditPartnerName(partner.displayName);
    setEditPartnerRoles(partner.roles);
    setEditCreditLimitInput(partner.creditLimitCents != null ? formatCurrencyFromCents(partner.creditLimitCents) : "");
    setEditClientForm(partnerToClientForm(partner));
    const [partnerEntities, partnerContacts, rules] = await Promise.all([
      window.operationsCafe.listPartnerLegalEntities(partner.id),
      window.operationsCafe.listPartnerContacts(partner.id),
      window.operationsCafe.listServiceRateRules({ businessPartnerId: partner.id, organizationId: partner.organizationId, status: "active" })
    ]);
    setLegalEntities(partnerEntities);
    setContacts(partnerContacts);
    setSelectedRateRules(rules);
    setLinkCompanySearch("");
    setLinkCompanyResults([]);
  }

  async function searchUnlinkedCompanies(term: string): Promise<void> {
    setLinkCompanySearch(term);
    if (!term.trim() || !organizationId) {
      setLinkCompanyResults([]);
      return;
    }
    setLinkCompanySearching(true);
    try {
      setLinkCompanyResults(await window.operationsCafe.listUnlinkedPartnerLegalEntities(organizationId, term.trim()));
    } finally {
      setLinkCompanySearching(false);
    }
  }

  async function linkExistingCompany(entity: BusinessPartnerLegalEntity): Promise<void> {
    if (!selected) return;
    await window.operationsCafe.linkPartnerLegalEntity(entity.id, selected.id);
    setMessage(`Empresa ${entity.tradeName} vinculada a ${selected.displayName}.`);
    setLinkCompanySearch("");
    setLinkCompanyResults([]);
    await loadDetail(selected);
    await load();
  }

  async function unlinkCompany(entity: BusinessPartnerLegalEntity): Promise<void> {
    if (!selected) return;
    const confirmed = await requestDecision({
      title: "Desvincular empresa",
      message: `Desvincular ${entity.tradeName} de ${selected.displayName}? A empresa continua cadastrada, so' fica sem cliente/corretor dono ate' ser vinculada de novo.`
    });
    if (!confirmed) return;
    await window.operationsCafe.unlinkPartnerLegalEntity(entity.id);
    await loadDetail(selected);
    await load();
  }

  function updateClientForm(field: keyof ClientForm, value: string): void {
    setClientForm((current) => ({ ...current, [field]: value }));
  }

  function updateEditClientForm(field: keyof ClientForm, value: string): void {
    setEditClientForm((current) => ({ ...current, [field]: value }));
  }

  function updateBrokerRuleForm(field: keyof BrokerRuleForm, value: string): void {
    setBrokerRuleForm((current) => ({ ...current, [field]: value }));
  }

  function updateEditBrokerRuleForm(field: keyof BrokerRuleForm, value: string): void {
    setEditBrokerRuleForm((current) => ({ ...current, [field]: value }));
  }

  function updateManualLegalEntityForm(field: keyof LegalEntityForm, value: string): void {
    setManualLegalEntityForm((current) => ({ ...current, [field]: value }));
  }

  function fillLegalEntityForm(result: CnpjLookupResult): void {
    const nextForm = {
      cnpj: formatCnpj(result.cnpj),
      legalName: result.legalName,
      tradeName: result.tradeName || result.legalName,
      stateRegistration: "",
      municipalRegistration: "",
      email: result.email ?? "",
      phone: result.phone ?? "",
      addressLine: result.addressLine ?? "",
      addressNumber: result.addressNumber ?? "",
      addressComplement: result.addressComplement ?? "",
      district: result.district ?? "",
      city: result.city ?? "",
      state: result.state ?? "",
      postalCode: result.postalCode ?? ""
    };
    if (modalMode === "editCompany") setDetailLegalEntityForm(nextForm);
    else setManualLegalEntityForm(nextForm);
  }

  function updateDetailLegalEntityForm(field: keyof LegalEntityForm, value: string): void {
    setDetailLegalEntityForm((current) => ({ ...current, [field]: value }));
  }

  function legalEntityToForm(entity: BusinessPartnerLegalEntity): LegalEntityForm {
    return {
      cnpj: entity.cnpj ? formatCnpj(entity.cnpj) : "",
      legalName: entity.legalName,
      tradeName: entity.tradeName,
      stateRegistration: entity.stateRegistration ?? "",
      municipalRegistration: entity.municipalRegistration ?? "",
      email: entity.email ?? "",
      phone: entity.phone ?? "",
      addressLine: entity.addressLine ?? "",
      addressNumber: entity.addressNumber ?? "",
      addressComplement: entity.addressComplement ?? "",
      district: entity.district ?? "",
      city: entity.city ?? "",
      state: entity.state ?? "",
      postalCode: entity.postalCode ?? ""
    };
  }

  function partnerToClientForm(partner: BusinessPartner): ClientForm {
    return {
      documentNumber: partner.documentNumber ?? "",
      email: partner.email ?? "",
      phone: partner.phone ?? "",
      mobile: partner.mobile ?? "",
      postalCode: partner.postalCode ?? "",
      addressLine: partner.addressLine ?? "",
      addressNumber: partner.addressNumber ?? "",
      addressComplement: partner.addressComplement ?? "",
      district: partner.district ?? "",
      city: partner.city ?? "",
      state: partner.state ?? "",
      notes: partner.notes ?? ""
    };
  }

  function toggleRole(currentRoles: BusinessPartnerRole[], role: BusinessPartnerRole, checked: boolean): BusinessPartnerRole[] {
    return checked ? Array.from(new Set([...currentRoles, role])) : currentRoles.filter((item) => item !== role);
  }

  function resetCreateForm(): void {
    setPartnerName("");
    setCreditLimitInput("");
    setClientForm(emptyClientForm);
    setBrokerRuleForm(emptyBrokerRuleForm);
    setRoles(["CLIENT"]);
    setManualLegalEntityForm(emptyLegalEntityForm);
    setLookupCnpjInput("");
    setLookupResult(null);
    setLookupLoading(false);
  }

  function openCreateModal(): void {
    setSelected(null);
    setLegalEntities([]);
    setContacts([]);
    resetCreateForm();
    setModalMode("createClient");
  }

  async function openEditModal(partner: BusinessPartner): Promise<void> {
    setDetailLegalEntityForm(emptyLegalEntityForm);
    setEditingLegalEntityId(null);
    setEditBrokerRuleForm(emptyBrokerRuleForm);
    await loadDetail(partner);
    setModalMode("editClient");
  }

  function openCreateCompanyModal(): void {
    setSelected(null);
    setLegalEntities([]);
    setContacts([]);
    setCompanyOwnerPartnerId("");
    setManualLegalEntityForm(emptyLegalEntityForm);
    setLookupCnpjInput("");
    setLookupResult(null);
    setLookupLoading(false);
    setModalMode("createCompany");
  }

  function openCreateCompanyForClient(partner: BusinessPartner): void {
    setSelected(partner);
    setLegalEntities([]);
    setContacts([]);
    setCompanyOwnerPartnerId(partner.id);
    setManualLegalEntityForm(emptyLegalEntityForm);
    setLookupCnpjInput("");
    setLookupResult(null);
    setLookupLoading(false);
    setModalMode("createCompany");
  }

  async function openEditCompanyModal(entity: BusinessPartnerLegalEntity): Promise<void> {
    const owner = entity.businessPartnerId
      ? allPartners.find((partner) => partner.id === entity.businessPartnerId) ?? await window.operationsCafe.getBusinessPartner(entity.businessPartnerId)
      : null;
    setSelected(owner);
    setCompanyOwnerPartnerId(owner?.id ?? "");
    setEditingLegalEntityId(entity.id);
    setDetailLegalEntityForm(legalEntityToForm(entity));
    setModalMode("editCompany");
  }

  function closePartnerModal(): void {
    setModalMode(null);
    setEditingLegalEntityId(null);
    setDetailLegalEntityForm(emptyLegalEntityForm);
    setCompanyOwnerPartnerId("");
  }

  function buildLegalEntityPayload(form: LegalEntityForm, businessPartnerId: string | null, isPrimary: boolean, fallbackName: string): Record<string, unknown> {
    const cnpjDigits = onlyDigits(form.cnpj) ?? "";
    const hasCnpj = Boolean(cnpjDigits);
    return {
      organizationId,
      businessPartnerId,
      legalName: form.legalName.trim() || fallbackName || "Nao informado",
      tradeName: form.tradeName.trim() || form.legalName.trim() || fallbackName || "Nao informado",
      cnpj: hasCnpj ? cnpjDigits : null,
      stateRegistration: form.stateRegistration.trim() || null,
      municipalRegistration: form.municipalRegistration.trim() || null,
      email: form.email.trim() || null,
      phone: normalizePhoneInput(form.phone),
      addressLine: form.addressLine.trim() || null,
      addressNumber: form.addressNumber.trim() || null,
      addressComplement: form.addressComplement.trim() || null,
      district: form.district.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim().toUpperCase() || null,
      postalCode: onlyDigits(form.postalCode) || null,
      isPrimary,
      isActive: hasCnpj,
      isDraft: !hasCnpj
    };
  }

  function normalizeTextInput(value: string): string | null {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  function normalizeDocumentInput(value: string): string | null {
    const digits = onlyDigits(value) ?? "";
    return digits || null;
  }

  function normalizeStateInput(value: string): string | null {
    const state = value.trim().toUpperCase();
    return state || null;
  }

  function buildPartnerPayload(form: ClientForm, name: string, partnerRoles: BusinessPartnerRole[], creditLimitValue: string, isActive: boolean, targetOrganizationId: string): Record<string, unknown> {
    return {
      organizationId: targetOrganizationId,
      displayName: name,
      notes: normalizeTextInput(form.notes),
      roles: partnerRoles,
      isActive,
      creditLimitCents: creditLimitValue.trim() ? parseCurrencyToCents(creditLimitValue) : null,
      documentNumber: normalizeDocumentInput(form.documentNumber),
      email: normalizeTextInput(form.email),
      phone: normalizePhoneInput(form.phone),
      mobile: normalizePhoneInput(form.mobile),
      postalCode: onlyDigits(form.postalCode) || null,
      addressLine: normalizeTextInput(form.addressLine),
      addressNumber: normalizeTextInput(form.addressNumber),
      addressComplement: normalizeTextInput(form.addressComplement),
      district: normalizeTextInput(form.district),
      city: normalizeTextInput(form.city),
      state: normalizeStateInput(form.state)
    };
  }

  function normalizePhoneInput(value: string): string | null {
    const digits = onlyDigits(value) ?? "";
    if (!digits) return null;
    return digits.slice(0, 13);
  }

  function counterpartyLabel(id: string | null): string {
    return id ? allLegalEntities.find((entity) => entity.id === id)?.tradeName ?? id : "Todas";
  }

  function rateRuleLabel(rule: ServiceRateRule): string {
    const target = rule.counterpartyPartnerLegalEntityId ? counterpartyLabel(rule.counterpartyPartnerLegalEntityId) : OPERATION_SCOPE_LABELS[rule.operationScope];
    return `${target}: ${formatCurrencyFromCents(rule.rateValueCents)} por saca`;
  }

  async function createBrokerRule(partnerId: string, partnerOrganizationId: string, scope: OperationScope, value: string, counterpartyPartnerLegalEntityId: string | null, notes: string): Promise<boolean> {
    const trimmed = value.trim();
    if (!trimmed) return false;
    await window.operationsCafe.createServiceRateRule({
      organizationId: partnerOrganizationId,
      businessPartnerId: partnerId,
      ownLegalEntityId: null,
      counterpartyPartnerLegalEntityId,
      productId: null,
      operationScope: scope,
      rateType: "PER_SACK",
      rateValueCents: parseCurrencyToCents(trimmed),
      effectiveFrom: OPEN_ENDED_EFFECTIVE_FROM,
      effectiveTo: null,
      priority: counterpartyPartnerLegalEntityId ? 30 : 10,
      notes,
      isActive: true
    });
    return true;
  }

  async function saveBrokerRules(partnerId: string, partnerOrganizationId: string, form: BrokerRuleForm): Promise<number> {
    let created = 0;
    if (form.specificCounterpartyValue.trim()) {
      if (!form.specificCounterpartyLegalEntityId) throw new Error("Selecione a empresa especifica para a regra especial.");
      created += await createBrokerRule(partnerId, partnerOrganizationId, "ALL", form.specificCounterpartyValue, form.specificCounterpartyLegalEntityId, "Regra especial por empresa da nota") ? 1 : 0;
    }
    created += await createBrokerRule(partnerId, partnerOrganizationId, "INTERNAL", form.internalValue, null, "Regra padrao para venda na mesma UF") ? 1 : 0;
    created += await createBrokerRule(partnerId, partnerOrganizationId, "EXTERNAL", form.externalValue, null, "Regra padrao para venda em outra UF") ? 1 : 0;
    return created;
  }

  async function saveSelectedBrokerRules(): Promise<void> {
    if (!selected) return;
    try {
      const created = await saveBrokerRules(selected.id, selected.organizationId, editBrokerRuleForm);
      setEditBrokerRuleForm(emptyBrokerRuleForm);
      setMessage(created > 0 ? "Regras de cobranca cadastradas para este cliente/corretor." : "Nenhuma regra preenchida para salvar.");
      await loadDetail(selected);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao salvar regras de cobranca."}`);
    }
  }

  async function saveManualPartner(): Promise<void> {
    const fallbackName = partnerName.trim();
    if (!organizationId) {
      setMessage("Erro: selecione uma organizacao antes de cadastrar o cliente/corretor.");
      return;
    }
    if (!fallbackName) {
      setMessage("Erro: informe o nome do cliente/corretor.");
      return;
    }
    if (roles.length === 0) {
      setMessage("Erro: selecione pelo menos um papel para o cadastro.");
      return;
    }
    try {
      const partner = await window.operationsCafe.createBusinessPartner(buildPartnerPayload(clientForm, fallbackName, roles, creditLimitInput, true, organizationId));
      const createdRules = await saveBrokerRules(partner.id, organizationId, brokerRuleForm);
      setLookupCnpjInput("");
      setLookupResult(null);
      setPartnerName("");
      setCreditLimitInput("");
      setClientForm(emptyClientForm);
      setBrokerRuleForm(emptyBrokerRuleForm);
      setManualLegalEntityForm(emptyLegalEntityForm);
      setMessage(`Cliente/corretor cadastrado.${createdRules ? ` ${createdRules} regra(s) de cobranca criada(s).` : ""}`);
      await load();
      await loadDetail(partner);
      closePartnerModal();
      scrollTo(partnersListRef);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao cadastrar cliente/corretor manualmente."}`);
    }
  }

  async function savePartnerEdit(): Promise<void> {
    if (!selected) return;
    const name = editPartnerName.trim();
    if (!name) {
      setMessage("Erro: informe o nome do cliente/corretor.");
      return;
    }
    if (editPartnerRoles.length === 0) {
      setMessage("Erro: selecione pelo menos um papel para o cadastro.");
      return;
    }
    try {
      const updated = await window.operationsCafe.updateBusinessPartner(selected.id, {
        ...buildPartnerPayload(editClientForm, name, editPartnerRoles, editCreditLimitInput, selected.isActive, selected.organizationId)
      });
      setMessage("Cadastro do cliente/corretor atualizado.");
      await load();
      await loadDetail(updated);
      scrollTo(partnersListRef);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao atualizar cliente/corretor."}`);
    }
  }

  async function searchCnpj(): Promise<void> {
    const cnpjDigits = onlyDigits(lookupCnpjInput) ?? "";
    if (!isValidCnpj(cnpjDigits)) {
      setMessage("Erro: informe um CNPJ valido com 14 digitos para buscar.");
      return;
    }
    setLookupLoading(true);
    try {
      const result = await window.operationsCafe.lookupCnpj(cnpjDigits);
      setLookupResult(result);
      if (!isCompanyModal) setPartnerName((current) => current || result.tradeName || result.legalName);
      fillLegalEntityForm(result);
      setMessage(`CNPJ encontrado: ${result.tradeName || result.legalName}.`);
    } catch (errorValue) {
      setLookupResult(null);
      setMessage(`Erro na busca de CNPJ: ${errorValue instanceof Error ? errorValue.message : "falha ao consultar dados."}`);
    } finally {
      setLookupLoading(false);
    }
  }

  async function saveCompany(): Promise<void> {
    const form = modalMode === "editCompany" ? detailLegalEntityForm : manualLegalEntityForm;
    const cnpjDigits = onlyDigits(form.cnpj) ?? "";
    if (!organizationId) {
      setMessage("Erro: selecione uma organizacao antes de cadastrar a empresa.");
      return;
    }
    if (!form.legalName.trim() && !form.tradeName.trim()) {
      setMessage("Erro: informe a razao social ou o nome fantasia da empresa.");
      return;
    }
    if (cnpjDigits && !isValidCnpj(cnpjDigits)) {
      setMessage("Erro: informe um CNPJ valido com 14 digitos ou deixe em branco para rascunho.");
      return;
    }
    try {
      const fallbackName = form.tradeName.trim() || form.legalName.trim();
      // Empresa nao precisa mais de um cliente/corretor dono desde a criacao --
      // fica solta ("Sem cliente vinculado") ate' alguem usar "Vincular empresa
      // existente" na ficha de um cliente/corretor, quando a relacao comercial
      // de fato comecar.
      const ownerId = companyOwnerPartnerId || selected?.id || null;
      if (modalMode === "editCompany" && editingLegalEntityId) {
        await window.operationsCafe.updatePartnerLegalEntity(editingLegalEntityId, buildLegalEntityPayload(form, ownerId, Boolean(ownerId), fallbackName));
        setMessage("Empresa atualizada.");
      } else {
        await window.operationsCafe.createPartnerLegalEntity(buildLegalEntityPayload(form, ownerId, Boolean(ownerId), fallbackName));
        setMessage(cnpjDigits ? "Empresa cadastrada." : "Empresa cadastrada como rascunho sem CNPJ.");
      }
      setManualLegalEntityForm(emptyLegalEntityForm);
      setDetailLegalEntityForm(emptyLegalEntityForm);
      setEditingLegalEntityId(null);
      setCompanyOwnerPartnerId("");
      setLookupCnpjInput("");
      setLookupResult(null);
      closePartnerModal();
      await load();
      setActiveTab("companies");
      scrollTo(partnersListRef);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao salvar empresa."}`);
    }
  }

  async function deletePartner(partner: BusinessPartner): Promise<void> {
    const confirmed = await requestDecision({
      title: "Arquivar cliente/corretor",
      message: `Deseja arquivar ${partner.displayName}? O cadastro, suas empresas/CNPJs, contatos e regras de tarifa ficam inativos, mas notas, cobrancas e conta-corrente ja lancados sao preservados.`
    });
    if (!confirmed) return;
    try {
      await window.operationsCafe.deleteBusinessPartner(partner.id);
      if (selected?.id === partner.id) {
        setSelected(null);
        closePartnerModal();
      }
      setMessage("Cliente/corretor arquivado.");
      await load();
      scrollTo(partnersListRef);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao arquivar cliente/corretor."}`);
    }
  }

  async function permanentlyDeletePartner(partner: BusinessPartner): Promise<void> {
    const confirmed = await requestDecision({
      title: "Excluir cliente/corretor definitivamente",
      message: `Excluir ${partner.displayName} de forma DEFINITIVA e IRREVERSIVEL (diferente de arquivar). So' funciona se este cadastro nunca teve nenhuma nota, operacao ou cobranca vinculada.`
    });
    if (!confirmed) return;
    try {
      await window.operationsCafe.permanentlyDeleteBusinessPartner(partner.id);
      if (selected?.id === partner.id) {
        setSelected(null);
        closePartnerModal();
      }
      setMessage("Cliente/corretor excluido definitivamente.");
      await load();
      scrollTo(partnersListRef);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao excluir cliente/corretor."}`);
    }
  }

  async function saveContact(): Promise<void> {
    if (!selected) return;
    const name = contactName.trim();
    if (!name) {
      setMessage("Erro: informe o nome do contato.");
      return;
    }
    try {
      await window.operationsCafe.createPartnerContact({
        businessPartnerId: selected.id,
        partnerLegalEntityId: null,
        name,
        department: null,
        email: null,
        phone: null,
        mobile: null,
        preferredContactMethod: "PHONE",
        isPrimary: contacts.length === 0,
        notes: null,
        isActive: true
      });
      setContactName("");
      setMessage("Contato salvo.");
      await loadDetail(selected);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao salvar contato."}`);
    }
  }

  const companySearchTerm = companySearch.trim().toUpperCase();
  const companyItems = allLegalEntities
    .filter((entity) => {
      const owner = allPartners.find((partner) => partner.id === entity.businessPartnerId);
      if (!companySearchTerm) return true;
      return [entity.tradeName, entity.legalName, entity.cnpj, entity.city, entity.state, owner?.displayName]
        .filter(Boolean)
        .some((value) => String(value).toUpperCase().includes(companySearchTerm));
    })
    // Ordem alfabetica pelo nome da empresa, independente de ter cliente/corretor vinculado ou nao.
    .sort((a, b) => a.tradeName.localeCompare(b.tradeName, "pt-BR", { sensitivity: "base" }));
  const clientOptions = allPartners
    .filter((partner) => partner.roles.includes("CLIENT") || partner.roles.includes("SUPPLIER"))
    .map((partner) => [partner.id, partner.displayName] as [string, string]);
  const isCompanyModal = modalMode === "createCompany" || modalMode === "editCompany";
  const isClientCreateModal = modalMode === "createClient";
  const isClientEditModal = modalMode === "editClient";
  const currentCompanyForm = modalMode === "editCompany" ? detailLegalEntityForm : manualLegalEntityForm;
  const updateCurrentCompanyForm = (field: keyof LegalEntityForm, value: string): void => {
    if (modalMode === "editCompany") updateDetailLegalEntityForm(field, value);
    else updateManualLegalEntityForm(field, value);
  };

  return (
    <section className="content-section settings compact-crud-page partners-page">
      <PageHeader title="Cadastros comerciais" eyebrow="Comercial" description="Separe clientes/corretores responsaveis pela cobranca das empresas/CNPJs que aparecem nas notas." />
      <div ref={partnersListRef}>
        <div className="sub-tabs partner-tabs" role="tablist" aria-label="Tipo de cadastro">
          <button className={activeTab === "clients" ? "active" : ""} onClick={() => setActiveTab("clients")}>Clientes/corretores/fornecedores</button>
          <button className={activeTab === "companies" ? "active" : ""} onClick={() => setActiveTab("companies")}>Empresas/CNPJs</button>
        </div>
      {activeTab === "clients" ? (
        <AdminBlock title="Clientes/corretores">
          <div className="partners-list-panel">
            <div className="partners-list-toolbar">
              <TextField label="Pesquisar cliente/corretor" value={search} onChange={setSearch} />
              <button className="partner-action-button partner-action-button--primary" onClick={openCreateModal}>Cadastrar cliente ou fornecedor</button>
            </div>
            <div className="table">
              <div className="table-head partner-grid"><span>Cliente/corretor</span><span>Papeis</span><span>Status</span><span>Atualizado</span><span>Acoes</span></div>
              {items.map((item) => <div key={item.id} className="table-row partner-grid"><span>{item.displayName}</span><span>{item.roles.map((role) => roleLabels[role]).join(", ")}</span><span>{item.isActive ? "Ativo" : "Inativo"}</span><span>{formatDateBr(item.updatedAt)}</span><span className="actions"><button onClick={() => void openEditModal(item)}>Editar</button><button className="danger-action" onClick={() => void deletePartner(item)}>Arquivar</button><button className="danger-action" onClick={() => void permanentlyDeletePartner(item)}>Excluir</button></span></div>)}
              {items.length === 0 ? <div className="table-row"><span>Nenhum cliente/corretor/fornecedor encontrado.</span></div> : null}
            </div>
          </div>
        </AdminBlock>
      ) : (
        <AdminBlock title="Empresas/CNPJs">
          <div className="partners-list-panel">
            <div className="partners-list-toolbar">
              <TextField label="Pesquisar empresa, CNPJ ou cidade" value={companySearch} onChange={setCompanySearch} />
              <button className="partner-action-button partner-action-button--primary" onClick={openCreateCompanyModal}>Cadastrar empresa</button>
            </div>
            <div className="table">
              <div className="table-head partner-company-grid"><span>Empresa</span><span>CNPJ</span><span>Cidade/UF</span><span>Cliente vinculado</span><span>Status</span><span>Acoes</span></div>
              {companyItems.map((entity) => {
                const owner = allPartners.find((partner) => partner.id === entity.businessPartnerId);
                return (
                  <div key={entity.id} className="table-row partner-company-grid">
                    <span><strong>{entity.tradeName}</strong><small>{entity.legalName}</small></span>
                    <span>{formatCnpj(entity.cnpj)}{entity.isDraft ? " - rascunho" : ""}</span>
                    <span>{[entity.city, entity.state].filter(Boolean).join("/") || "-"}</span>
                    <span>{owner ? owner.displayName : "Sem cliente vinculado"}</span>
                    <span>{entity.isActive ? "Ativa" : "Inativa"}</span>
                    <span className="actions"><button onClick={() => void openEditCompanyModal(entity)}>Editar</button></span>
                  </div>
                );
              })}
              {companyItems.length === 0 ? <div className="table-row"><span>Nenhuma empresa encontrada.</span></div> : null}
            </div>
          </div>
        </AdminBlock>
      )}
      </div>
      {modalMode ? (
        <div className="partner-modal-backdrop" role="presentation">
          <div className="partner-modal" role="dialog" aria-modal="true" aria-label={isCompanyModal ? "Cadastrar ou editar empresa" : isClientCreateModal ? "Cadastrar cliente ou fornecedor" : "Editar cliente/corretor"}>
            <header className="partner-modal__header">
              <div>
                <span>{isCompanyModal ? "Cadastro de empresa" : isClientCreateModal ? "Novo cadastro" : "Cadastro existente"}</span>
                <strong>{isCompanyModal ? modalMode === "createCompany" ? "Cadastrar empresa/CNPJ" : currentCompanyForm.tradeName || currentCompanyForm.legalName || "Editar empresa/CNPJ" : isClientCreateModal ? "Cadastrar cliente ou fornecedor" : selected?.displayName ?? "Editar cliente/corretor"}</strong>
              </div>
              <button className="partner-modal__close" onClick={closePartnerModal} aria-label="Fechar">x</button>
            </header>
            <div className="partner-modal__body">
              {isCompanyModal ? (
                <>
                  <div className="cnpj-lookup-panel">
                    <div>
                      <span>Busca automatica</span>
                      <strong>Consultar empresa por CNPJ</strong>
                      <small>Opcional. Use para preencher os dados da empresa; se a consulta falhar, preencha manualmente.</small>
                    </div>
                    <TextField label="CNPJ" value={lookupCnpjInput} onChange={setLookupCnpjInput} />
                    <button className="partner-action-button partner-action-button--primary" disabled={lookupLoading || !onlyDigits(lookupCnpjInput)} onClick={() => void searchCnpj()}>
                      {lookupLoading ? "Buscando..." : "Buscar CNPJ"}
                    </button>
                    {lookupResult ? (
                      <div className="cnpj-lookup-preview">
                        <span>{lookupResult.registrationStatus ?? "Situacao nao informada"} - {lookupResult.source === "BRASIL_API" ? "BrasilAPI" : "ReceitaWS"}</span>
                        <strong>{lookupResult.tradeName || lookupResult.legalName}</strong>
                        <small>{lookupResult.legalName} - {formatCnpj(lookupResult.cnpj)}</small>
                        <small>{[lookupResult.addressLine, lookupResult.addressNumber, lookupResult.district, lookupResult.city, lookupResult.state].filter(Boolean).join(", ") || "Endereco nao informado"}</small>
                      </div>
                    ) : null}
                  </div>
                  <section className="partner-action-panel">
                    <div className="partner-action-panel__header">
                      <span className="partner-action-icon" aria-hidden="true">#</span>
                      <div>
                        <strong>Dados da empresa</strong>
                        <small>Este cadastro representa a empresa/CNPJ que aparece no XML, na confirmacao e nos documentos.</small>
                      </div>
                    </div>
                    <FormGrid>
                      <SelectField label="Cliente/corretor vinculado" value={companyOwnerPartnerId} onChange={setCompanyOwnerPartnerId} options={[["", "Sem cliente vinculado"], ...clientOptions]} />
                    </FormGrid>
                    <div className="legal-entity-form-grid">
                      <TextField label="CNPJ" value={currentCompanyForm.cnpj} onChange={(value) => updateCurrentCompanyForm("cnpj", value)} />
                      <TextField label="Razao social" value={currentCompanyForm.legalName} onChange={(value) => updateCurrentCompanyForm("legalName", value)} />
                      <TextField label="Nome fantasia" value={currentCompanyForm.tradeName} onChange={(value) => updateCurrentCompanyForm("tradeName", value)} />
                      <TextField label="Inscricao estadual" value={currentCompanyForm.stateRegistration} onChange={(value) => updateCurrentCompanyForm("stateRegistration", value)} />
                      <TextField label="Inscricao municipal" value={currentCompanyForm.municipalRegistration} onChange={(value) => updateCurrentCompanyForm("municipalRegistration", value)} />
                      <TextField label="Email" value={currentCompanyForm.email} onChange={(value) => updateCurrentCompanyForm("email", value)} />
                      <TextField label="Telefone" value={currentCompanyForm.phone} onChange={(value) => updateCurrentCompanyForm("phone", value)} />
                      <TextField label="CEP" value={currentCompanyForm.postalCode} onChange={(value) => updateCurrentCompanyForm("postalCode", value)} />
                      <TextField label="Endereco" value={currentCompanyForm.addressLine} onChange={(value) => updateCurrentCompanyForm("addressLine", value)} />
                      <TextField label="Numero" value={currentCompanyForm.addressNumber} onChange={(value) => updateCurrentCompanyForm("addressNumber", value)} />
                      <TextField label="Complemento" value={currentCompanyForm.addressComplement} onChange={(value) => updateCurrentCompanyForm("addressComplement", value)} />
                      <TextField label="Bairro" value={currentCompanyForm.district} onChange={(value) => updateCurrentCompanyForm("district", value)} />
                      <TextField label="Cidade" value={currentCompanyForm.city} onChange={(value) => updateCurrentCompanyForm("city", value)} />
                      <TextField label="UF" value={currentCompanyForm.state} onChange={(value) => updateCurrentCompanyForm("state", value)} />
                    </div>
                  </section>
                </>
              ) : isClientCreateModal ? (
                <>
                  <div className="manual-partner-panel">
                    <div className="partner-action-panel__header">
                      <span className="partner-action-icon" aria-hidden="true">+</span>
                      <div>
                        <strong>Dados do cliente ou fornecedor</strong>
                        <small>Preencha manualmente ou ajuste os dados trazidos pela consulta.</small>
                      </div>
                    </div>
                    <FormGrid>
                      <TextField label="Nome do cliente/corretor" value={partnerName} onChange={setPartnerName} required />
                      <TextField label="Limite de credito (R$)" value={creditLimitInput} onChange={setCreditLimitInput} />
                      <label className="checkbox"><input type="checkbox" checked={roles.includes("CLIENT")} onChange={(event) => setRoles(toggleRole(roles, "CLIENT", event.target.checked))} /> Cliente/corretor</label>
                      <label className="checkbox"><input type="checkbox" checked={roles.includes("SUPPLIER")} onChange={(event) => setRoles(toggleRole(roles, "SUPPLIER", event.target.checked))} /> Fornecedor</label>
                    </FormGrid>
                    <div className="partner-form-subtitle">
                      <strong>Dados cadastrais do cliente/corretor</strong>
                      <small>Use estes campos para contato, endereco e observacoes do cliente responsavel pela cobranca.</small>
                    </div>
                    <div className="legal-entity-form-grid">
                      <TextField label="CPF/CNPJ" value={clientForm.documentNumber} onChange={(value) => updateClientForm("documentNumber", value)} />
                      <TextField label="Email" value={clientForm.email} onChange={(value) => updateClientForm("email", value)} />
                      <TextField label="Telefone" value={clientForm.phone} onChange={(value) => updateClientForm("phone", value)} />
                      <TextField label="Celular/WhatsApp" value={clientForm.mobile} onChange={(value) => updateClientForm("mobile", value)} />
                      <TextField label="CEP" value={clientForm.postalCode} onChange={(value) => updateClientForm("postalCode", value)} />
                      <TextField label="Endereco" value={clientForm.addressLine} onChange={(value) => updateClientForm("addressLine", value)} />
                      <TextField label="Numero" value={clientForm.addressNumber} onChange={(value) => updateClientForm("addressNumber", value)} />
                      <TextField label="Complemento" value={clientForm.addressComplement} onChange={(value) => updateClientForm("addressComplement", value)} />
                      <TextField label="Bairro" value={clientForm.district} onChange={(value) => updateClientForm("district", value)} />
                      <TextField label="Cidade" value={clientForm.city} onChange={(value) => updateClientForm("city", value)} />
                      <TextField label="UF" value={clientForm.state} onChange={(value) => updateClientForm("state", value)} />
                      <TextField label="Observacoes" value={clientForm.notes} onChange={(value) => updateClientForm("notes", value)} />
                    </div>
                    <section className="broker-rules-panel">
                      <div className="partner-form-subtitle">
                        <strong>Regras de cobranca por saca</strong>
                        <small>Opcional. Cadastre os valores comerciais do corretor agora; eles tambem podem ser editados depois em Regras por saca.</small>
                      </div>
                      <div className="broker-rules-grid">
                        <SelectField label="Empresa especifica" value={brokerRuleForm.specificCounterpartyLegalEntityId} onChange={(value) => updateBrokerRuleForm("specificCounterpartyLegalEntityId", value)} options={[["", "Nenhuma"], ...allLegalEntities.map((entity) => [entity.id, entity.tradeName] as [string, string])]} />
                        <TextField label="Valor para empresa especifica" value={brokerRuleForm.specificCounterpartyValue} onChange={(value) => updateBrokerRuleForm("specificCounterpartyValue", value)} />
                        <TextField label="Valor mesma UF" value={brokerRuleForm.internalValue} onChange={(value) => updateBrokerRuleForm("internalValue", value)} />
                        <TextField label="Valor outra UF" value={brokerRuleForm.externalValue} onChange={(value) => updateBrokerRuleForm("externalValue", value)} />
                      </div>
                    </section>
                  </div>
                </>
              ) : selected ? (
                <>
                  <section className="partner-action-panel">
                    <div className="partner-action-panel__header">
                      <span className="partner-action-icon" aria-hidden="true">E</span>
                      <div>
                        <strong>Editar cliente/corretor</strong>
                        <small>Atualize o nome principal e os papeis usados no sistema.</small>
                      </div>
                    </div>
                    <FormGrid>
                      <TextField label="Nome do cliente/corretor" value={editPartnerName} onChange={setEditPartnerName} required />
                      <TextField label="Limite de credito (R$)" value={editCreditLimitInput} onChange={setEditCreditLimitInput} />
                      {roleOptions.map((role) => (
                        <label key={role} className="checkbox">
                          <input type="checkbox" checked={editPartnerRoles.includes(role)} onChange={(event) => setEditPartnerRoles(toggleRole(editPartnerRoles, role, event.target.checked))} /> {roleLabels[role]}
                        </label>
                      ))}
                    </FormGrid>
                    <div className="partner-form-subtitle">
                      <strong>Dados cadastrais</strong>
                      <small>Dados gerais do cliente/corretor responsavel por negocios e cobrancas.</small>
                    </div>
                    <div className="client-profile-form-grid">
                      <TextField label="CPF/CNPJ" value={editClientForm.documentNumber} onChange={(value) => updateEditClientForm("documentNumber", value)} />
                      <TextField label="Email" value={editClientForm.email} onChange={(value) => updateEditClientForm("email", value)} />
                      <TextField label="Telefone" value={editClientForm.phone} onChange={(value) => updateEditClientForm("phone", value)} />
                      <TextField label="Celular/WhatsApp" value={editClientForm.mobile} onChange={(value) => updateEditClientForm("mobile", value)} />
                      <TextField label="CEP" value={editClientForm.postalCode} onChange={(value) => updateEditClientForm("postalCode", value)} />
                      <TextField label="Endereco" value={editClientForm.addressLine} onChange={(value) => updateEditClientForm("addressLine", value)} />
                      <TextField label="Numero" value={editClientForm.addressNumber} onChange={(value) => updateEditClientForm("addressNumber", value)} />
                      <TextField label="Complemento" value={editClientForm.addressComplement} onChange={(value) => updateEditClientForm("addressComplement", value)} />
                      <TextField label="Bairro" value={editClientForm.district} onChange={(value) => updateEditClientForm("district", value)} />
                      <TextField label="Cidade" value={editClientForm.city} onChange={(value) => updateEditClientForm("city", value)} />
                      <TextField label="UF" value={editClientForm.state} onChange={(value) => updateEditClientForm("state", value)} />
                      <TextField label="Observacoes" value={editClientForm.notes} onChange={(value) => updateEditClientForm("notes", value)} />
                    </div>
                    <button className="partner-action-button partner-action-button--primary" disabled={!editPartnerName.trim() || editPartnerRoles.length === 0} onClick={() => void savePartnerEdit()}>
                      Salvar alteracoes do cliente/corretor
                    </button>
                  </section>
                  <section className="partner-action-panel broker-rules-panel">
                    <div className="partner-action-panel__header">
                      <span className="partner-action-icon" aria-hidden="true">%</span>
                      <div>
                        <strong>Regras de cobranca por saca</strong>
                        <small>Use para casos como Valani: empresa especifica, vendas na mesma UF e vendas em outra UF.</small>
                      </div>
                    </div>
                    <div className="broker-rules-grid">
                      <SelectField label="Empresa especifica" value={editBrokerRuleForm.specificCounterpartyLegalEntityId} onChange={(value) => updateEditBrokerRuleForm("specificCounterpartyLegalEntityId", value)} options={[["", "Nenhuma"], ...allLegalEntities.map((entity) => [entity.id, entity.tradeName] as [string, string])]} />
                      <TextField label="Valor para empresa especifica" value={editBrokerRuleForm.specificCounterpartyValue} onChange={(value) => updateEditBrokerRuleForm("specificCounterpartyValue", value)} />
                      <TextField label="Valor mesma UF" value={editBrokerRuleForm.internalValue} onChange={(value) => updateEditBrokerRuleForm("internalValue", value)} />
                      <TextField label="Valor outra UF" value={editBrokerRuleForm.externalValue} onChange={(value) => updateEditBrokerRuleForm("externalValue", value)} />
                    </div>
                    <div className="partner-action-row">
                      <button className="partner-action-button partner-action-button--primary" onClick={() => void saveSelectedBrokerRules()}>Salvar regras do corretor</button>
                    </div>
                    <div className="broker-rules-list">
                      {selectedRateRules.length ? selectedRateRules.map((rule) => <span key={rule.id}>{rateRuleLabel(rule)}</span>) : <span>Nenhuma regra cadastrada para este cliente/corretor.</span>}
                    </div>
                  </section>
                  <div className="partner-records-grid">
                    <article className="partner-record-card">
                      <span>Empresas/CNPJs</span>
                      {legalEntities.length ? legalEntities.map((item) => (
                        <div key={item.id} className="partner-record-item">
                          <div>
                            <strong>{item.tradeName}</strong>
                            <small>{formatCnpj(item.cnpj)}{item.isDraft ? " - rascunho" : ""}</small>
                          </div>
                          <button className="partner-action-button" onClick={() => void openEditCompanyModal(item)}>Editar empresa</button>
                          <button className="partner-action-button" onClick={() => void unlinkCompany(item)}>Desvincular</button>
                        </div>
                      )) : <strong>Nenhum</strong>}
                      {selected ? <button className="partner-action-button" onClick={() => openCreateCompanyForClient(selected)}>Cadastrar empresa vinculada</button> : null}
                      {selected ? (
                        <div className="partner-link-company">
                          <TextField label="Vincular empresa ja cadastrada (nome ou CNPJ)" value={linkCompanySearch} onChange={(value) => void searchUnlinkedCompanies(value)} />
                          {linkCompanySearching ? <small>Buscando...</small> : null}
                          {linkCompanySearch.trim() && !linkCompanySearching ? (
                            linkCompanyResults.length ? linkCompanyResults.map((entity) => (
                              <div key={entity.id} className="partner-record-item">
                                <div>
                                  <strong>{entity.tradeName}</strong>
                                  <small>{formatCnpj(entity.cnpj)}</small>
                                </div>
                                <button className="partner-action-button partner-action-button--primary" onClick={() => void linkExistingCompany(entity)}>Vincular</button>
                              </div>
                            )) : <small>Nenhuma empresa solta encontrada com esse termo.</small>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                    <article className="partner-record-card">
                      <span>Contatos</span>
                      <strong>{contacts.map((item) => item.name).join(" | ") || "Nenhum"}</strong>
                      <TextField label="Nome do contato" value={contactName} onChange={setContactName} />
                      <button className="partner-action-button" disabled={!contactName.trim()} onClick={() => void saveContact()}>Cadastrar contato</button>
                    </article>
                  </div>
                </>
              ) : null}
            </div>
            <footer className="partner-modal__footer">
              {isClientCreateModal ? (
                <>
                  <button
                    className="partner-action-button"
                    onClick={() => {
                      setManualLegalEntityForm(emptyLegalEntityForm);
                      setLookupResult(null);
                    }}
                  >
                    Limpar dados
                  </button>

                  <button
                    className="partner-action-button partner-action-button--primary"
                    disabled={roles.length === 0 || !organizationId}
                    onClick={() => void saveManualPartner()}
                  >
                    Cadastrar cliente ou fornecedor
                  </button>
                </>
              ) : null}

              {isClientEditModal ? (
                <button
                  className="partner-action-button partner-action-button--primary"
                  disabled={
                    !selected ||
                    !editPartnerName.trim() ||
                    editPartnerRoles.length === 0
                  }
                  onClick={() => void savePartnerEdit()}
                >
                  Salvar alterações
                </button>
              ) : null}

              {isCompanyModal ? (
                <>
                  <button
                    className="partner-action-button"
                    onClick={() => {
                      setManualLegalEntityForm(emptyLegalEntityForm);
                      setDetailLegalEntityForm(emptyLegalEntityForm);
                      setLookupResult(null);
                    }}
                  >
                    Limpar dados
                  </button>

                  <button
                    className="partner-action-button partner-action-button--primary"
                    onClick={() => void saveCompany()}
                  >
                    {modalMode === "editCompany"
                      ? "Salvar empresa"
                      : "Cadastrar empresa"}
                  </button>
                </>
              ) : null}

              <button
                className="partner-action-button"
                onClick={closePartnerModal}
              >
                Fechar
              </button>
            </footer>
          </div>
        </div>
      ) : null}
      <Feedback message={message} />
    </section>
  );
}
