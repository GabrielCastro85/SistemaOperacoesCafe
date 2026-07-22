import React, { useCallback, useEffect, useState } from "react";
import type { BootstrapData, BusinessPartner, BusinessPartnerLegalEntity, BusinessPartnerRole, CnpjLookupResult, PartnerContact } from "../../../shared/types/domain";
import { formatCnpj, formatDateBr, isValidCnpj, onlyDigits } from "../../../shared/utils/format";
import { PageHeader } from "../../design-system";
import { Feedback } from "../../components/feedback/Feedback";
import { TextField } from "../../components/forms/LegacyFields";
import { AdminBlock, FormGrid } from "../../components/layout/SectionPrimitives";
import { requestDecision } from "../../utils/dialogs";
const roleLabels: Record<BusinessPartnerRole, string> = { CLIENT: "Cliente", SUPPLIER: "Fornecedor", SELLER: "Vendedor", BUYER: "Comprador", DESTINATION: "Destino", CARRIER: "Transportadora", SERVICE_PROVIDER: "Prestador de servico", OTHER: "Outro" };
const roleOptions: BusinessPartnerRole[] = ["CLIENT", "BUYER", "SUPPLIER", "SELLER", "DESTINATION", "CARRIER", "SERVICE_PROVIDER", "OTHER"];
type PartnerModalMode = "create" | "edit" | null;

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

export function PartnersPage({ data }: { data: BootstrapData; refresh?: () => Promise<BootstrapData> }): JSX.Element {
  const [items, setItems] = useState<BusinessPartner[]>([]);
  const [selected, setSelected] = useState<BusinessPartner | null>(null);
  const [legalEntities, setLegalEntities] = useState<BusinessPartnerLegalEntity[]>([]);
  const [contacts, setContacts] = useState<PartnerContact[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const organizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "";
  const [partnerName, setPartnerName] = useState("");
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
  const [modalMode, setModalMode] = useState<PartnerModalMode>(null);

  const load = useCallback(async () => {
    setItems(await window.operationsCafe.listBusinessPartners({ organizationId, search, status: "active" }));
  }, [organizationId, search]);
  useEffect(() => { void load(); }, [load]);

  async function loadDetail(partner: BusinessPartner): Promise<void> {
    setSelected(partner);
    setEditPartnerName(partner.displayName);
    setEditPartnerRoles(partner.roles);
    setLegalEntities(await window.operationsCafe.listPartnerLegalEntities(partner.id));
    setContacts(await window.operationsCafe.listPartnerContacts(partner.id));
  }

  function updateManualLegalEntityForm(field: keyof typeof emptyLegalEntityForm, value: string): void {
    setManualLegalEntityForm((current) => ({ ...current, [field]: value }));
  }

  function fillLegalEntityForm(result: CnpjLookupResult): void {
    setManualLegalEntityForm({
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
    });
  }

  function updateDetailLegalEntityForm(field: keyof typeof emptyLegalEntityForm, value: string): void {
    setDetailLegalEntityForm((current) => ({ ...current, [field]: value }));
  }

  function hasLegalEntityData(form: typeof emptyLegalEntityForm): boolean {
    return Object.values(form).some((value) => value.trim());
  }

  function legalEntityToForm(entity: BusinessPartnerLegalEntity): typeof emptyLegalEntityForm {
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

  function toggleRole(currentRoles: BusinessPartnerRole[], role: BusinessPartnerRole, checked: boolean): BusinessPartnerRole[] {
    return checked ? Array.from(new Set([...currentRoles, role])) : currentRoles.filter((item) => item !== role);
  }

  function resetCreateForm(): void {
    setPartnerName("");
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
    setModalMode("create");
  }

  async function openEditModal(partner: BusinessPartner): Promise<void> {
    setDetailLegalEntityForm(emptyLegalEntityForm);
    setEditingLegalEntityId(null);
    await loadDetail(partner);
    setModalMode("edit");
  }

  function closePartnerModal(): void {
    setModalMode(null);
    setEditingLegalEntityId(null);
    setDetailLegalEntityForm(emptyLegalEntityForm);
  }

  function buildLegalEntityPayload(form: typeof emptyLegalEntityForm, businessPartnerId: string, isPrimary: boolean, fallbackName: string): Record<string, unknown> {
    const cnpjDigits = onlyDigits(form.cnpj) ?? "";
    const hasCnpj = Boolean(cnpjDigits);
    return {
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

  function normalizePhoneInput(value: string): string | null {
    const digits = onlyDigits(value) ?? "";
    if (!digits) return null;
    return digits.slice(0, 13);
  }

  async function saveManualPartner(): Promise<void> {
    const fallbackName = partnerName.trim() || manualLegalEntityForm.tradeName.trim() || manualLegalEntityForm.legalName.trim();
    const cnpjDigits = onlyDigits(manualLegalEntityForm.cnpj) ?? "";
    if (!organizationId) {
      setMessage("Erro: selecione uma organizacao antes de cadastrar o cliente.");
      return;
    }
    if (!fallbackName) {
      setMessage("Erro: informe o nome do parceiro ou a razao social.");
      return;
    }
    if (roles.length === 0) {
      setMessage("Erro: selecione pelo menos um papel para o cadastro.");
      return;
    }
    if (cnpjDigits && !isValidCnpj(cnpjDigits)) {
      setMessage("Erro: informe um CNPJ valido ou deixe o campo em branco para salvar rascunho.");
      return;
    }
    try {
      const partner = await window.operationsCafe.createBusinessPartner({ organizationId, displayName: fallbackName, notes: null, roles, isActive: true });
      if (hasLegalEntityData(manualLegalEntityForm)) {
        await window.operationsCafe.createPartnerLegalEntity(buildLegalEntityPayload(manualLegalEntityForm, partner.id, true, fallbackName));
      }
      setLookupCnpjInput("");
      setLookupResult(null);
      setPartnerName("");
      setManualLegalEntityForm(emptyLegalEntityForm);
      setMessage(cnpjDigits ? "Cliente cadastrado manualmente." : "Cliente cadastrado manualmente como rascunho sem CNPJ.");
      await load();
      await loadDetail(partner);
      closePartnerModal();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao cadastrar cliente manualmente."}`);
    }
  }

  async function savePartnerEdit(): Promise<void> {
    if (!selected) return;
    const name = editPartnerName.trim();
    if (!name) {
      setMessage("Erro: informe o nome do cliente.");
      return;
    }
    if (editPartnerRoles.length === 0) {
      setMessage("Erro: selecione pelo menos um papel para o cadastro.");
      return;
    }
    try {
      const updated = await window.operationsCafe.updateBusinessPartner(selected.id, {
        organizationId: selected.organizationId,
        displayName: name,
        notes: selected.notes,
        roles: editPartnerRoles,
        isActive: selected.isActive
      });
      setMessage("Cadastro do cliente atualizado.");
      await load();
      await loadDetail(updated);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao atualizar cliente."}`);
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
      setPartnerName((current) => current || result.tradeName || result.legalName);
      fillLegalEntityForm(result);
      setMessage(`CNPJ encontrado: ${result.tradeName || result.legalName}.`);
    } catch (errorValue) {
      setLookupResult(null);
      setMessage(`Erro na busca de CNPJ: ${errorValue instanceof Error ? errorValue.message : "falha ao consultar dados."}`);
    } finally {
      setLookupLoading(false);
    }
  }

  async function createPartnerFromLookup(): Promise<void> {
    if (!lookupResult) return;
    if (!organizationId) {
      setMessage("Erro: selecione uma organizacao antes de cadastrar o cliente.");
      return;
    }
    try {
      const partner = await window.operationsCafe.createBusinessPartner({
        organizationId,
        displayName: manualLegalEntityForm.tradeName.trim() || lookupResult.tradeName || lookupResult.legalName,
        notes: lookupResult.registrationStatus ? `Situacao cadastral: ${lookupResult.registrationStatus}` : null,
        roles,
        isActive: true
      });
      await window.operationsCafe.createPartnerLegalEntity(buildLegalEntityPayload(manualLegalEntityForm, partner.id, true, lookupResult.tradeName || lookupResult.legalName));
      setLookupCnpjInput("");
      setLookupResult(null);
      setPartnerName("");
      setManualLegalEntityForm(emptyLegalEntityForm);
      setMessage("Cliente cadastrado com dados do CNPJ.");
      await load();
      await loadDetail(partner);
      closePartnerModal();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao cadastrar cliente pelo CNPJ."}`);
    }
  }

  async function savePartnerLegalEntity(): Promise<void> {
    if (!selected) return;
    const cnpjDigits = onlyDigits(detailLegalEntityForm.cnpj) ?? "";
    const hasCnpj = Boolean(cnpjDigits);
    if (hasCnpj && !isValidCnpj(cnpjDigits)) {
      setMessage("Erro: informe um CNPJ valido com 14 digitos.");
      return;
    }
    try {
      if (editingLegalEntityId) {
        const original = legalEntities.find((item) => item.id === editingLegalEntityId);
        await window.operationsCafe.updatePartnerLegalEntity(editingLegalEntityId, buildLegalEntityPayload(detailLegalEntityForm, selected.id, original?.isPrimary ?? legalEntities.length === 0, selected.displayName));
      } else {
        await window.operationsCafe.createPartnerLegalEntity(buildLegalEntityPayload(detailLegalEntityForm, selected.id, legalEntities.length === 0, selected.displayName));
      }
      setDetailLegalEntityForm(emptyLegalEntityForm);
      setEditingLegalEntityId(null);
      setMessage(editingLegalEntityId ? "Estabelecimento atualizado." : hasCnpj ? "Estabelecimento salvo." : "Estabelecimento salvo como rascunho sem CNPJ.");
      await loadDetail(selected);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao salvar estabelecimento."}`);
    }
  }

  function startEditingLegalEntity(entity: BusinessPartnerLegalEntity): void {
    setEditingLegalEntityId(entity.id);
    setDetailLegalEntityForm(legalEntityToForm(entity));
    setMessage(`Editando estabelecimento: ${entity.tradeName}.`);
  }

  function cancelLegalEntityEdit(): void {
    setEditingLegalEntityId(null);
    setDetailLegalEntityForm(emptyLegalEntityForm);
  }

  async function deletePartner(partner: BusinessPartner): Promise<void> {
    const confirmed = await requestDecision({
      title: "Excluir cliente definitivamente",
      message: `Deseja apagar ${partner.displayName} definitivamente? Esta acao remove CNPJs, contatos, regras, cobrancas, conta-corrente e documentos vinculados a este cliente.`
    });
    if (!confirmed) return;
    try {
      await window.operationsCafe.deleteBusinessPartner(partner.id);
      if (selected?.id === partner.id) {
        setSelected(null);
        closePartnerModal();
      }
      setMessage("Cliente excluido definitivamente.");
      await load();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao excluir cliente."}`);
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

  return (
    <section className="content-section settings">
      <PageHeader title="Clientes e parceiros" eyebrow="Comercial" description="Cadastre clientes, compradores, vendedores, fornecedores, CNPJs e contatos." />
      <AdminBlock title="Clientes e parceiros">
        <div className="partners-list-toolbar">
          <TextField label="Pesquisar cliente" value={search} onChange={setSearch} />
          <button className="partner-action-button partner-action-button--primary" onClick={openCreateModal}>Cadastrar cliente</button>
        </div>
        <div className="table">
          <div className="table-head partner-grid"><span>Parceiro</span><span>Papeis</span><span>Status</span><span>Atualizado</span><span>Acoes</span></div>
          {items.map((item) => <div key={item.id} className="table-row partner-grid"><span>{item.displayName}</span><span>{item.roles.map((role) => roleLabels[role]).join(", ")}</span><span>{item.isActive ? "Ativo" : "Inativo"}</span><span>{formatDateBr(item.updatedAt)}</span><span className="actions"><button onClick={() => void openEditModal(item)}>Editar</button><button className="danger-action" onClick={() => void deletePartner(item)}>Excluir</button></span></div>)}
          {items.length === 0 ? <div className="table-row"><span>Nenhum cliente encontrado.</span></div> : null}
        </div>
      </AdminBlock>
      {modalMode ? (
        <div className="partner-modal-backdrop" role="presentation">
          <div className="partner-modal" role="dialog" aria-modal="true" aria-label={modalMode === "create" ? "Cadastrar cliente" : "Editar cliente"}>
            <header className="partner-modal__header">
              <div>
                <span>{modalMode === "create" ? "Novo cadastro" : "Cadastro existente"}</span>
                <strong>{modalMode === "create" ? "Cadastrar cliente" : selected?.displayName ?? "Editar cliente"}</strong>
              </div>
              <button className="partner-modal__close" onClick={closePartnerModal} aria-label="Fechar">x</button>
            </header>
            <div className="partner-modal__body">
              {modalMode === "create" ? (
                <>
                  <div className="cnpj-lookup-panel">
                    <div>
                      <span>Busca automatica</span>
                      <strong>Consultar cliente por CNPJ</strong>
                      <small>Preenche os campos automaticamente quando a consulta publica retornar os dados.</small>
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
                        <button className="partner-action-button" disabled={roles.length === 0} onClick={() => void createPartnerFromLookup()}>Cadastrar cliente com estes dados</button>
                      </div>
                    ) : null}
                  </div>
                  <div className="manual-partner-panel">
                    <div className="partner-action-panel__header">
                      <span className="partner-action-icon" aria-hidden="true">+</span>
                      <div>
                        <strong>Dados do cliente</strong>
                        <small>Preencha manualmente ou ajuste os dados trazidos pela consulta.</small>
                      </div>
                    </div>
                    <FormGrid>
                      <TextField label="Nome do parceiro" value={partnerName} onChange={setPartnerName} required />
                      <label className="checkbox"><input type="checkbox" checked={roles.includes("CLIENT")} onChange={(event) => setRoles(toggleRole(roles, "CLIENT", event.target.checked))} /> Cliente</label>
                      <label className="checkbox"><input type="checkbox" checked={roles.includes("BUYER")} onChange={(event) => setRoles(toggleRole(roles, "BUYER", event.target.checked))} /> Comprador</label>
                    </FormGrid>
                    <div className="legal-entity-form-grid">
                      <TextField label="CNPJ" value={manualLegalEntityForm.cnpj} onChange={(value) => updateManualLegalEntityForm("cnpj", value)} />
                      <TextField label="Razao social" value={manualLegalEntityForm.legalName} onChange={(value) => updateManualLegalEntityForm("legalName", value)} />
                      <TextField label="Nome fantasia" value={manualLegalEntityForm.tradeName} onChange={(value) => updateManualLegalEntityForm("tradeName", value)} />
                      <TextField label="Inscricao estadual" value={manualLegalEntityForm.stateRegistration} onChange={(value) => updateManualLegalEntityForm("stateRegistration", value)} />
                      <TextField label="Inscricao municipal" value={manualLegalEntityForm.municipalRegistration} onChange={(value) => updateManualLegalEntityForm("municipalRegistration", value)} />
                      <TextField label="Email" value={manualLegalEntityForm.email} onChange={(value) => updateManualLegalEntityForm("email", value)} />
                      <TextField label="Telefone" value={manualLegalEntityForm.phone} onChange={(value) => updateManualLegalEntityForm("phone", value)} />
                      <TextField label="CEP" value={manualLegalEntityForm.postalCode} onChange={(value) => updateManualLegalEntityForm("postalCode", value)} />
                      <TextField label="Endereco" value={manualLegalEntityForm.addressLine} onChange={(value) => updateManualLegalEntityForm("addressLine", value)} />
                      <TextField label="Numero" value={manualLegalEntityForm.addressNumber} onChange={(value) => updateManualLegalEntityForm("addressNumber", value)} />
                      <TextField label="Complemento" value={manualLegalEntityForm.addressComplement} onChange={(value) => updateManualLegalEntityForm("addressComplement", value)} />
                      <TextField label="Bairro" value={manualLegalEntityForm.district} onChange={(value) => updateManualLegalEntityForm("district", value)} />
                      <TextField label="Cidade" value={manualLegalEntityForm.city} onChange={(value) => updateManualLegalEntityForm("city", value)} />
                      <TextField label="UF" value={manualLegalEntityForm.state} onChange={(value) => updateManualLegalEntityForm("state", value)} />
                    </div>
                  </div>
                </>
              ) : selected ? (
                <>
                  <section className="partner-action-panel">
                    <div className="partner-action-panel__header">
                      <span className="partner-action-icon" aria-hidden="true">E</span>
                      <div>
                        <strong>Editar cliente</strong>
                        <small>Atualize o nome principal e os papeis usados no sistema.</small>
                      </div>
                    </div>
                    <FormGrid>
                      <TextField label="Nome do cliente" value={editPartnerName} onChange={setEditPartnerName} required />
                      {roleOptions.map((role) => (
                        <label key={role} className="checkbox">
                          <input type="checkbox" checked={editPartnerRoles.includes(role)} onChange={(event) => setEditPartnerRoles(toggleRole(editPartnerRoles, role, event.target.checked))} /> {roleLabels[role]}
                        </label>
                      ))}
                    </FormGrid>
                    <button className="partner-action-button partner-action-button--primary" disabled={!editPartnerName.trim() || editPartnerRoles.length === 0} onClick={() => void savePartnerEdit()}>
                      Salvar alteracoes do cliente
                    </button>
                  </section>
                  <section className="partner-action-panel">
                    <div className="partner-action-panel__header">
                      <span className="partner-action-icon" aria-hidden="true">#</span>
                      <div>
                        <strong>{editingLegalEntityId ? "Editar estabelecimento" : "Novo estabelecimento"}</strong>
                        <small>{editingLegalEntityId ? "Altere os dados do CNPJ selecionado." : "Cadastre outro CNPJ manualmente para este cliente."}</small>
                      </div>
                    </div>
                    <div className="legal-entity-form-grid">
                      <TextField label="CNPJ" value={detailLegalEntityForm.cnpj} onChange={(value) => updateDetailLegalEntityForm("cnpj", value)} />
                      <TextField label="Razao social" value={detailLegalEntityForm.legalName} onChange={(value) => updateDetailLegalEntityForm("legalName", value)} />
                      <TextField label="Nome fantasia" value={detailLegalEntityForm.tradeName} onChange={(value) => updateDetailLegalEntityForm("tradeName", value)} />
                      <TextField label="Inscricao estadual" value={detailLegalEntityForm.stateRegistration} onChange={(value) => updateDetailLegalEntityForm("stateRegistration", value)} />
                      <TextField label="Inscricao municipal" value={detailLegalEntityForm.municipalRegistration} onChange={(value) => updateDetailLegalEntityForm("municipalRegistration", value)} />
                      <TextField label="Email" value={detailLegalEntityForm.email} onChange={(value) => updateDetailLegalEntityForm("email", value)} />
                      <TextField label="Telefone" value={detailLegalEntityForm.phone} onChange={(value) => updateDetailLegalEntityForm("phone", value)} />
                      <TextField label="CEP" value={detailLegalEntityForm.postalCode} onChange={(value) => updateDetailLegalEntityForm("postalCode", value)} />
                      <TextField label="Endereco" value={detailLegalEntityForm.addressLine} onChange={(value) => updateDetailLegalEntityForm("addressLine", value)} />
                      <TextField label="Numero" value={detailLegalEntityForm.addressNumber} onChange={(value) => updateDetailLegalEntityForm("addressNumber", value)} />
                      <TextField label="Complemento" value={detailLegalEntityForm.addressComplement} onChange={(value) => updateDetailLegalEntityForm("addressComplement", value)} />
                      <TextField label="Bairro" value={detailLegalEntityForm.district} onChange={(value) => updateDetailLegalEntityForm("district", value)} />
                      <TextField label="Cidade" value={detailLegalEntityForm.city} onChange={(value) => updateDetailLegalEntityForm("city", value)} />
                      <TextField label="UF" value={detailLegalEntityForm.state} onChange={(value) => updateDetailLegalEntityForm("state", value)} />
                    </div>
                    <div className="partner-action-row">
                      <button className="partner-action-button partner-action-button--primary" onClick={() => void savePartnerLegalEntity()}>
                        {editingLegalEntityId ? "Salvar edicao" : detailLegalEntityForm.cnpj.trim() ? "Salvar estabelecimento" : "Salvar rascunho sem CNPJ"}
                      </button>
                      {editingLegalEntityId ? <button className="partner-action-button" onClick={cancelLegalEntityEdit}>Cancelar edicao</button> : null}
                    </div>
                  </section>
                  <div className="partner-records-grid">
                    <article className="partner-record-card">
                      <span>Estabelecimentos</span>
                      {legalEntities.length ? legalEntities.map((item) => (
                        <div key={item.id} className="partner-record-item">
                          <div>
                            <strong>{item.tradeName}</strong>
                            <small>{formatCnpj(item.cnpj)}{item.isDraft ? " - rascunho" : ""}</small>
                          </div>
                          <button className="partner-action-button" onClick={() => startEditingLegalEntity(item)}>Editar</button>
                        </div>
                      )) : <strong>Nenhum</strong>}
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
              {modalMode === "create" ? (
                <>
                  <button className="partner-action-button" onClick={() => { setManualLegalEntityForm(emptyLegalEntityForm); setLookupResult(null); }}>Limpar dados</button>
                  <button className="partner-action-button partner-action-button--primary" disabled={roles.length === 0 || !organizationId} onClick={() => void saveManualPartner()}>Cadastrar cliente</button>
                </>
              ) : null}
              <button className="partner-action-button" onClick={closePartnerModal}>Fechar</button>
            </footer>
          </div>
        </div>
      ) : null}
      <Feedback message={message} />
    </section>
  );
}


