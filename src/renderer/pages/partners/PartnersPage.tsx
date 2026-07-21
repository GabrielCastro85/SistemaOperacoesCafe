import React, { useCallback, useEffect, useState } from "react";
import type { BootstrapData, BusinessPartner, BusinessPartnerLegalEntity, BusinessPartnerRole, PartnerContact } from "../../../shared/types/domain";
import { formatCnpj, formatDateBr, isValidCnpj, onlyDigits } from "../../../shared/utils/format";
import { PageHeader } from "../../design-system";
import { Feedback } from "../../components/feedback/Feedback";
import { TextField } from "../../components/forms/LegacyFields";
import { AdminBlock, FormGrid } from "../../components/layout/SectionPrimitives";
const roleLabels: Record<BusinessPartnerRole, string> = { CLIENT: "Cliente", SUPPLIER: "Fornecedor", SELLER: "Vendedor", BUYER: "Comprador", DESTINATION: "Destino", CARRIER: "Transportadora", SERVICE_PROVIDER: "Prestador de servico", OTHER: "Outro" };
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
  const [cnpj, setCnpj] = useState("");
  const [contactName, setContactName] = useState("");

  const load = useCallback(async () => {
    setItems(await window.operationsCafe.listBusinessPartners({ organizationId, search, status: "all" }));
  }, [organizationId, search]);
  useEffect(() => { void load(); }, [load]);

  async function loadDetail(partner: BusinessPartner): Promise<void> {
    setSelected(partner);
    setLegalEntities(await window.operationsCafe.listPartnerLegalEntities(partner.id));
    setContacts(await window.operationsCafe.listPartnerContacts(partner.id));
  }

  async function savePartner(): Promise<void> {
    const name = partnerName.trim();
    if (!organizationId) {
      setMessage("Erro: selecione uma organizacao antes de cadastrar o cliente.");
      return;
    }
    if (!name) {
      setMessage("Erro: informe o nome do cliente.");
      return;
    }
    if (roles.length === 0) {
      setMessage("Erro: selecione pelo menos um papel para o cadastro.");
      return;
    }
    try {
      const partner = await window.operationsCafe.createBusinessPartner({ organizationId, displayName: name, notes: null, roles, isActive: true });
      setPartnerName("");
      setMessage("Parceiro salvo.");
      await load();
      await loadDetail(partner);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao salvar parceiro."}`);
    }
  }

  async function savePartnerLegalEntity(): Promise<void> {
    if (!selected) return;
    const cnpjDigits = onlyDigits(cnpj);
    const hasCnpj = Boolean(cnpjDigits);
    if (hasCnpj && !isValidCnpj(cnpjDigits)) {
      setMessage("Erro: informe um CNPJ valido com 14 digitos.");
      return;
    }
    try {
      await window.operationsCafe.createPartnerLegalEntity({
        businessPartnerId: selected.id,
        legalName: selected.displayName,
        tradeName: selected.displayName,
        cnpj: hasCnpj ? cnpjDigits : null,
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
        isPrimary: legalEntities.length === 0,
        isActive: hasCnpj,
        isDraft: !hasCnpj
      });
      setCnpj("");
      setMessage(hasCnpj ? "Estabelecimento salvo." : "Estabelecimento salvo como rascunho sem CNPJ.");
      await loadDetail(selected);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao salvar estabelecimento."}`);
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
        <div className="toolbar"><TextField label="Busca" value={search} onChange={setSearch} /></div>
        <FormGrid>
          <TextField label="Nome do parceiro" value={partnerName} onChange={setPartnerName} required />
          <label className="checkbox"><input type="checkbox" checked={roles.includes("CLIENT")} onChange={(event) => setRoles(event.target.checked ? Array.from(new Set([...roles, "CLIENT"])) : roles.filter((role) => role !== "CLIENT"))} /> Cliente</label>
          <label className="checkbox"><input type="checkbox" checked={roles.includes("BUYER")} onChange={(event) => setRoles(event.target.checked ? Array.from(new Set([...roles, "BUYER"])) : roles.filter((role) => role !== "BUYER"))} /> Comprador</label>
          <button className="primary" disabled={!partnerName.trim() || roles.length === 0 || !organizationId} onClick={() => void savePartner()}>Cadastrar parceiro</button>
        </FormGrid>
        <div className="table">
          <div className="table-head partner-grid"><span>Parceiro</span><span>Papeis</span><span>Status</span><span>Atualizado</span><span>Acoes</span></div>
          {items.map((item) => <div key={item.id} className="table-row partner-grid"><span>{item.displayName}</span><span>{item.roles.map((role) => roleLabels[role]).join(", ")}</span><span>{item.isActive ? "Ativo" : "Inativo"}</span><span>{formatDateBr(item.updatedAt)}</span><span className="actions"><button onClick={() => void loadDetail(item)}>Detalhar</button></span></div>)}
        </div>
      </AdminBlock>
      {selected ? <AdminBlock title={`Detalhe: ${selected.displayName}`}>
        <FormGrid>
          <TextField label="CNPJ do estabelecimento" value={cnpj} onChange={setCnpj} />
          <button onClick={() => void savePartnerLegalEntity()}>{cnpj.trim() ? "Cadastrar CNPJ" : "Salvar rascunho sem CNPJ"}</button>
          <TextField label="Nome do contato" value={contactName} onChange={setContactName} />
          <button disabled={!contactName.trim()} onClick={() => void saveContact()}>Cadastrar contato</button>
        </FormGrid>
        <div className="cards"><article><span>Estabelecimentos</span><strong>{legalEntities.map((item) => `${item.tradeName} ${formatCnpj(item.cnpj)}${item.isDraft ? " (rascunho)" : ""}`).join(" | ") || "Nenhum"}</strong></article><article><span>Contatos</span><strong>{contacts.map((item) => item.name).join(" | ") || "Nenhum"}</strong></article></div>
      </AdminBlock> : null}
      <Feedback message={message} />
    </section>
  );
}


