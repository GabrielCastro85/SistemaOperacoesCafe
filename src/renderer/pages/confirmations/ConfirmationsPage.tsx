import React, { useCallback, useEffect, useRef, useState } from "react";
import type { BootstrapData, BusinessPartner, BusinessPartnerLegalEntity, DealClauseTemplate, DealConfirmation, DealConfirmationDetail, DealConfirmationSummary, DealConfirmationTemplate, FiscalDocument, Product } from "../../../shared/types/domain";
import { formatCurrencyFromCents, formatDateBr, onlyDigits } from "../../../shared/utils/format";
import { sumDecimalTexts } from "../../../shared/utils/decimal";
import { fiscalDocumentCounterpartyNameFromSnapshot } from "../../../shared/utils/fiscalDocumentLabels";
import { DateInput, EmptyState, HandshakeIcon, PageHeader, StatusBadge, Stepper, Textarea } from "../../design-system";
import { SelectField, TextField } from "../../components/forms/LegacyFields";
import { PartnerQuickSearch } from "../../components/forms/PartnerQuickSearch";
import { LegalEntityQuickSearch } from "../../components/forms/LegalEntityQuickSearch";
import { AdminBlock, FormGrid } from "../../components/layout/SectionPrimitives";
import { Feedback } from "../../components/feedback/Feedback";
import { requestDecision, requestTextInput } from "../../utils/dialogs";
import { ConfirmationPartyCard } from "./components/ConfirmationPartyCard";
import { ConfirmationItemsTable } from "./components/ConfirmationItemsTable";
import { useAutoScroll } from "../../hooks/useAutoScroll";

interface SourceDocumentRow {
  document: FiscalDocument;
  sacks: string;
}

function todayDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function firstDayOfCurrentMonth(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

interface DealPartyTarget {
  businessPartnerId: string | null;
  partnerLegalEntityId: string | null;
  manualName: string | null;
  displayName: string;
}

function legalEntityDisplayName(entity: BusinessPartnerLegalEntity): string {
  return entity.legalName || entity.tradeName || "Empresa da NF";
}

function legalEntitySearchLabel(entity: BusinessPartnerLegalEntity): string {
  const mainName = legalEntityDisplayName(entity);
  const fantasyName = entity.tradeName && entity.tradeName !== mainName ? ` (${entity.tradeName})` : "";
  return `${mainName}${fantasyName} - ${entity.cnpj ?? "CNPJ nao informado"}`;
}

function fiscalDocumentHasCompanyCnpj(document: FiscalDocument, cnpj: string | null | undefined): boolean {
  const selectedCnpj = onlyDigits(cnpj ?? "");
  if (!selectedCnpj) return false;
  try {
    const snapshot = document.fiscalSnapshotJson ? JSON.parse(document.fiscalSnapshotJson) as Record<string, unknown> : null;
    const issuer = snapshot?.issuer && typeof snapshot.issuer === "object" ? snapshot.issuer as Record<string, unknown> : null;
    const recipient = snapshot?.recipient && typeof snapshot.recipient === "object" ? snapshot.recipient as Record<string, unknown> : null;
    const issuerCnpj = onlyDigits(String(issuer?.cnpjCpf ?? ""));
    const recipientCnpj = onlyDigits(String(recipient?.cnpjCpf ?? ""));
    return issuerCnpj === selectedCnpj || recipientCnpj === selectedCnpj;
  } catch {
    return false;
  }
}

export function ConfirmationsPage({ data }: { data: BootstrapData }): JSX.Element {
  const organizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "";
  const ownLegalEntityId = data.profile?.defaultLegalEntityId ?? data.legalEntities.find((item) => item.organizationId === organizationId)?.id ?? "";
  const [tab, setTab] = useState("Confirmacoes");
  const [confirmations, setConfirmations] = useState<DealConfirmation[]>([]);
  const [detail, setDetail] = useState<DealConfirmationDetail | null>(null);
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);
  const [summary, setSummary] = useState<DealConfirmationSummary | null>(null);
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [partnerLegalEntities, setPartnerLegalEntities] = useState<BusinessPartnerLegalEntity[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [templates, setTemplates] = useState<DealConfirmationTemplate[]>([]);
  const [clauses, setClauses] = useState<DealClauseTemplate[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [buyerId, setBuyerId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("685");
  const [price, setPrice] = useState("1000.0000");
  const [sourceClientId, setSourceClientId] = useState("");
  const [sourceSearchMode, setSourceSearchMode] = useState<"corretor" | "empresa" | "numero">("empresa");
  const [sourceLegalEntityId, setSourceLegalEntityId] = useState("");
  const [companySearchTerm, setCompanySearchTerm] = useState("");
  const [showCompanyResults, setShowCompanyResults] = useState(false);
  const [sourceDateStart, setSourceDateStart] = useState(() => firstDayOfCurrentMonth());
  const [sourceDateEnd, setSourceDateEnd] = useState(() => todayDate());
  const [sourceDocumentNumberFilter, setSourceDocumentNumberFilter] = useState("");
  const [sourceDocuments, setSourceDocuments] = useState<SourceDocumentRow[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Record<string, boolean>>({});
  const [brokerageInput, setBrokerageInput] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [bankAgency, setBankAgency] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankAccountType, setBankAccountType] = useState("");
  const [bankHolderName, setBankHolderName] = useState("");
  const [bankHolderDocument, setBankHolderDocument] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("");
  const [deliveryText, setDeliveryText] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [qualityTerms, setQualityTerms] = useState("");
  const [generalTerms, setGeneralTerms] = useState("");
  const [publicNotes, setPublicNotes] = useState("");
  const [deliveryRecipientId, setDeliveryRecipientId] = useState("");
  const [clauseTemplateId, setClauseTemplateId] = useState("");
  const [view, setView] = useState<"list" | "new" | "detail">("list");
  const [creationMode, setCreationMode] = useState<"notes" | "manual">("notes");
  const scrollTo = useAutoScroll();
  const detailRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    const [dealList, partnerList, productList, templateList, clauseList, dealSummary] = await Promise.all([
      window.operationsCafe.listDealConfirmations({ organizationId }),
      window.operationsCafe.listBusinessPartners({ status: "active" }),
      window.operationsCafe.listProducts({ organizationId, status: "active" }),
      window.operationsCafe.listDealConfirmationTemplates({ organizationId, status: "all" }),
      window.operationsCafe.listDealClauseTemplates(organizationId),
      window.operationsCafe.getDealConfirmationSummary({ organizationId, ownLegalEntityId: ownLegalEntityId || null, dateStart: null, dateEnd: null, sellerPartnerId: null, buyerPartnerId: null, productId: null, status: null, signatureStatus: null })
    ]);
    setConfirmations(dealList.filter((confirmation) => !ownLegalEntityId || confirmation.ownLegalEntityId === ownLegalEntityId));
    setPartners(partnerList);
    // Empresas vinculadas a um corretor + empresas ainda soltas (sem dono) --
    // a busca por empresa/CNPJ precisa achar as duas, ja que uma nota pode
    // chegar de uma empresa que ainda nao tem corretor vinculado.
    const [linkedEntityGroups, unlinkedEntities] = await Promise.all([
      Promise.all(partnerList.map((partner) => window.operationsCafe.listPartnerLegalEntities(partner.id))),
      window.operationsCafe.listUnlinkedPartnerLegalEntities(organizationId)
    ]);
    setPartnerLegalEntities([...linkedEntityGroups.flat(), ...unlinkedEntities]);
    setProducts(productList);
    setTemplates(templateList);
    setClauses(clauseList);
    setSummary(dealSummary);
    const clientPartners = partnerList.filter((item) => item.roles.includes("CLIENT"));
    setBuyerId((current) => current || clientPartners[0]?.id || "");
    setProductId((current) => current || productList[0]?.id || "");
    setSourceClientId((current) => current || clientPartners[0]?.id || "");
    setDeliveryRecipientId((current) => current || partnerList[0]?.id || "");
    setClauseTemplateId((current) => current || clauseList.find((item) => item.isActive)?.id || "");
  }, [organizationId, ownLegalEntityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadSourceDocuments = useCallback(async () => {
    // Busca por corretor: mesmo comportamento de sempre (nota atribuida a
    // esse cliente/corretor, sem olhar qual empresa emitiu). Busca por
    // empresa/CNPJ: pedido do dono -- pesquisa a empresa e traz TODAS as
    // notas emitidas por aquele CNPJ, independente de qual corretor ficou
    // responsavel. Busca por numero: independente de empresa/cliente -- digita
    // um pedaco do numero (ex: "79" acha 790/791/792/793) e ve' a lista com o
    // destinatario de cada uma, pra selecionar so' as que forem do mesmo
    // negocio sem precisar saber de qual empresa/cliente sao antes.
    const numberFilter = sourceDocumentNumberFilter.trim();
    if (sourceSearchMode === "corretor") {
      if (!sourceClientId) { setSourceDocuments([]); return; }
    } else if (sourceSearchMode === "empresa") {
      if (!sourceLegalEntityId) { setSourceDocuments([]); return; }
    } else if (!numberFilter) {
      setSourceDocuments([]);
      return;
    }
    const selectedCompany = sourceLegalEntityId ? partnerLegalEntities.find((entity) => entity.id === sourceLegalEntityId) : null;
    const allDocuments = await window.operationsCafe.listFiscalDocuments({
      organizationId,
      ownLegalEntityId: sourceSearchMode === "corretor" ? ownLegalEntityId : undefined,
      status: "CONFIRMED"
    });
    const documents = (sourceSearchMode === "corretor"
      ? allDocuments.filter((item) => item.responsiblePartnerId === sourceClientId)
      : sourceSearchMode === "empresa"
        ? allDocuments
          .filter((item) => item.partnerLegalEntityId === sourceLegalEntityId || fiscalDocumentHasCompanyCnpj(item, selectedCompany?.cnpj))
          // So' pra nao vir a pilha inteira de notas antigas da empresa: por
          // padrao mostra so' o periodo escolhido no filtro (hoje ate' hoje por
          // padrao), o dono alarga a data quando quiser incluir uma nota de
          // outro dia na mesma confirmacao.
          .filter((item) => (!sourceDateStart || item.issueDate >= sourceDateStart) && (!sourceDateEnd || item.issueDate <= sourceDateEnd))
        : allDocuments
    ).filter((item) => !numberFilter || item.documentNumber.toUpperCase().includes(numberFilter.toUpperCase()));
    const rows = await Promise.all(documents.map(async (document): Promise<SourceDocumentRow> => {
      const detailDoc = await window.operationsCafe.getFiscalDocument(document.id);
      const sacks = detailDoc.items.map((item) => item.sacksQuantity).filter((value): value is string => Boolean(value));
      return { document, sacks: sacks.length ? sumDecimalTexts(sacks) : "0" };
    }));
    setSourceDocuments(rows);
    setSelectedDocumentIds({});
  }, [organizationId, ownLegalEntityId, partnerLegalEntities, sourceClientId, sourceSearchMode, sourceLegalEntityId, sourceDateStart, sourceDateEnd, sourceDocumentNumberFilter]);

  useEffect(() => { void loadSourceDocuments(); }, [loadSourceDocuments]);

  async function refreshPreview(current: DealConfirmationDetail): Promise<void> {
    const latest = [...current.documents].sort((a, b) => b.versionNumber - a.versionNumber)[0];
    if (!latest) { setPreviewBase64(null); return; }
    try {
      setPreviewBase64(await window.operationsCafe.getDealDocumentBytes(latest.id));
    } catch {
      setPreviewBase64(null);
    }
  }

  function loadBankFieldsFromDetail(current: DealConfirmationDetail): void {
    setBrokerageInput(current.confirmation.brokeragePercentageBasisPoints != null ? (current.confirmation.brokeragePercentageBasisPoints / 100).toString().replace(".", ",") : "");
    setBankName(current.confirmation.bankName ?? "");
    setBankCode(current.confirmation.bankCode ?? "");
    setBankAgency(current.confirmation.bankAgency ?? "");
    setBankAccount(current.confirmation.bankAccount ?? "");
    setBankAccountType(current.confirmation.bankAccountType ?? "");
    setBankHolderName(current.confirmation.bankHolderName ?? "");
    setBankHolderDocument(current.confirmation.bankHolderDocument ?? "");
    setPixKey(current.confirmation.pixKey ?? "");
    setPixKeyType(current.confirmation.pixKeyType ?? "");
    setDeliveryText(current.confirmation.deliveryLocationSnapshot ?? "");
    setPaymentTerms(current.confirmation.paymentTermsSnapshot ?? "");
    setQualityTerms(current.confirmation.qualityTermsSnapshot ?? "");
    setGeneralTerms(current.confirmation.generalTermsSnapshot ?? "");
    setPublicNotes(current.confirmation.publicNotes ?? "");
  }

  async function createManual(): Promise<void> {
    try {
      const draft = await window.operationsCafe.createDealConfirmationDraft({
        organizationId,
        ownLegalEntityId,
        templateId: templates.find((item) => item.isDefault)?.id ?? null,
        confirmationDate: new Date().toISOString().slice(0, 10),
        negotiationDate: new Date().toISOString().slice(0, 10),
        deliveryLocationSnapshot: "Local de entrega a confirmar",
        deliveryStartDate: null,
        deliveryEndDate: null,
        paymentTermsSnapshot: "Condicao comercial a revisar",
        qualityTermsSnapshot: "Qualidade conforme amostra",
        generalTermsSnapshot: "Textos demonstrativos devem ser revisados pela empresa",
        publicNotes: null,
        internalNotes: null
      });
      await addPartiesItemsAndSigners(draft.confirmation.id);
      const refreshed = await window.operationsCafe.getDealConfirmation(draft.confirmation.id);
      setDetail(refreshed);
      loadBankFieldsFromDetail(refreshed);
      setPreviewBase64(null);
      setView("detail");
      setMessage("Confirmacao manual criada.");
      await load();
      scrollTo(detailRef);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao criar confirmacao."}`);
    }
  }

  async function addPartiesItemsAndSigners(
    confirmationId: string,
    skipItem = false,
    confirmationOwnLegalEntityId = ownLegalEntityId,
    confirmationBuyer: DealPartyTarget | null = buyerId ? partnerTargetFromPartnerId(buyerId) : null,
    confirmationDeliveryRecipient: DealPartyTarget | null = confirmationBuyer
  ): Promise<void> {
    if (confirmationOwnLegalEntityId) await window.operationsCafe.addDealConfirmationParty({ dealConfirmationId: confirmationId, partyRole: "SELLER", businessPartnerId: null, partnerLegalEntityId: null, ownLegalEntityId: confirmationOwnLegalEntityId, manualName: null, representativeName: null, sortOrder: 1 });
    if (confirmationBuyer) await window.operationsCafe.addDealConfirmationParty({ dealConfirmationId: confirmationId, partyRole: "BUYER", businessPartnerId: confirmationBuyer.businessPartnerId, partnerLegalEntityId: confirmationBuyer.partnerLegalEntityId, ownLegalEntityId: null, manualName: confirmationBuyer.manualName, representativeName: null, sortOrder: 2 });
    if (confirmationDeliveryRecipient) await window.operationsCafe.addDealConfirmationParty({ dealConfirmationId: confirmationId, partyRole: "DELIVERY_RECIPIENT", businessPartnerId: confirmationDeliveryRecipient.businessPartnerId, partnerLegalEntityId: confirmationDeliveryRecipient.partnerLegalEntityId, ownLegalEntityId: null, manualName: confirmationDeliveryRecipient.manualName, representativeName: null, sortOrder: 3 });
    if (!skipItem && productId) await window.operationsCafe.addDealConfirmationItem({
      dealConfirmationId: confirmationId,
      sortOrder: 0,
      productId,
      productNameSnapshot: products.find((item) => item.id === productId)?.name ?? "Cafe",
      productDescriptionSnapshot: null,
      cropSnapshot: null,
      qualitySnapshot: "Bebida dura",
      packagingSnapshot: "Sacas",
      originSnapshot: null,
      destinationSnapshot: null,
      quantitySacksDecimal: quantity,
      sackWeightKgDecimal: "60",
      unitPriceDecimal: price,
      totalAmountCents: null,
      totalOverrideReason: null,
      deliveryStartDate: null,
      deliveryEndDate: null,
      deliveryLocationSnapshot: "Local de entrega a confirmar",
      notes: null
    });
    await window.operationsCafe.addDealSigner({ dealConfirmationId: confirmationId, partyRole: "SELLER", name: data.legalEntities.find((item) => item.id === confirmationOwnLegalEntityId)?.legalName ?? "Vendedor", documentNumber: null, positionTitle: null, email: null, phone: null, signatureOrder: 1, signatureStatus: "PENDING", signedAt: null, notes: null });
    await window.operationsCafe.addDealSigner({ dealConfirmationId: confirmationId, partyRole: "BUYER", name: confirmationBuyer?.displayName ?? "Comprador", documentNumber: null, positionTitle: null, email: null, phone: null, signatureOrder: 2, signatureStatus: "PENDING", signedAt: null, notes: null });
  }

  const clientPartners = partners.filter((item) => item.roles.includes("CLIENT"));
  const companySearchResults = (() => {
    const term = normalizeSearchText(companySearchTerm.trim());
    const digitsTerm = onlyDigits(companySearchTerm) ?? "";
    const orderedEntities = [...partnerLegalEntities].sort((first, second) =>
      legalEntityDisplayName(first).localeCompare(legalEntityDisplayName(second), "pt-BR")
    );
    const results = term || digitsTerm
      ? orderedEntities.filter((entity) =>
        normalizeSearchText(entity.tradeName).includes(term) ||
        normalizeSearchText(entity.legalName).includes(term) ||
        (digitsTerm ? (onlyDigits(entity.cnpj ?? "") ?? "").includes(digitsTerm) : false)
      )
      : orderedEntities;
    return results.slice(0, 50);
  })();
  const selectedSourceCompany = sourceLegalEntityId ? partnerLegalEntities.find((entity) => entity.id === sourceLegalEntityId) : null;
  const ownEntityName = data.legalEntities.find((item) => item.id === ownLegalEntityId)?.legalName ?? "Empresa propria";
  const selectedCount = Object.values(selectedDocumentIds).filter(Boolean).length;
  const selectedRows = sourceDocuments.filter((row) => selectedDocumentIds[row.document.id]);
  const selectedTotalSacks = selectedRows.length ? sumDecimalTexts(selectedRows.map((row) => row.sacks)) : "0";
  const selectedTotalCents = selectedRows.reduce((sum, row) => sum + row.document.totalAmountCents, 0);
  const selectedAvgPricePerSack = Number(selectedTotalSacks) > 0 ? selectedTotalCents / 100 / Number(selectedTotalSacks) : 0;

  async function createFromNotes(): Promise<void> {
    const fiscalDocumentIds = selectedRows.map((row) => row.document.id);
    if (fiscalDocumentIds.length === 0) return;
    const selectedBuyerIds = [...new Set(selectedRows.map((row) => row.document.responsiblePartnerId))];
    if (sourceSearchMode === "corretor" && selectedBuyerIds.length > 1) {
      setMessage("Erro: selecione notas do mesmo cliente para gerar uma confirmacao.");
      return;
    }
    const selectedBuyerId = selectedBuyerIds[0] ?? buyerId;
    const nfCompanyEntityIds = sourceSearchMode === "empresa" && sourceLegalEntityId
      ? [sourceLegalEntityId]
      : [...new Set(selectedRows.map((row) => row.document.partnerLegalEntityId).filter((id): id is string => Boolean(id)))];
    if (nfCompanyEntityIds.length === 0) {
      setMessage("Erro: a nota selecionada nao tem empresa da NF vinculada. Abra a nota, vincule a empresa e tente novamente.");
      return;
    }
    if (sourceSearchMode !== "empresa" && nfCompanyEntityIds.length > 1) {
      setMessage("Erro: selecione notas da mesma empresa da NF para gerar uma unica confirmacao.");
      return;
    }
    const nfCompanyTarget = partnerTargetFromLegalEntityId(nfCompanyEntityIds[0]);
    if (!nfCompanyTarget) {
      setMessage("Erro: a empresa da NF nao foi encontrada no cadastro. Cadastre/atualize a empresa da nota e tente novamente.");
      return;
    }
    try {
      const created = await window.operationsCafe.createDealConfirmationFromFiscalDocuments({ organizationId, ownLegalEntityId, operationIds: [], fiscalDocumentIds });
      // As notas selecionadas podem ja estar vinculadas a uma confirmacao ativa -- nesse caso o backend
      // devolve essa confirmacao existente em vez de criar outra (evita duplicar o negocio). Toda confirmacao
      // (nova ou reaproveitada) ja vem com a parte ISSUER auto-criada pelo backend, entao NAO da pra usar
      // "tem alguma parte" para decidir se ja foi preenchida -- precisa checar especificamente o comprador.
      const wasReused = created.parties.some((party) => party.partyRole === "BUYER") || created.signers.some((signer) => signer.partyRole === "BUYER");
      if (!wasReused) {
        await addPartiesItemsAndSigners(created.confirmation.id, true, created.confirmation.ownLegalEntityId, nfCompanyTarget, nfCompanyTarget);
      }
      if (sourceSearchMode === "corretor" && selectedBuyerId) {
        setSourceClientId(selectedBuyerId);
      }
      if (nfCompanyTarget.businessPartnerId) {
        setBuyerId(nfCompanyTarget.businessPartnerId);
      }
      if (nfCompanyTarget.partnerLegalEntityId) {
        setDeliveryRecipientId(nfCompanyTarget.partnerLegalEntityId);
      }
      const refreshed = await window.operationsCafe.getDealConfirmation(created.confirmation.id);
      setDetail(refreshed);
      loadBankFieldsFromDetail(refreshed);
      setPreviewBase64(null);
      setView("detail");
      setMessage(
        wasReused
          ? `Notas ja vinculadas a confirmacao ${created.confirmation.confirmationNumber ?? "em rascunho"} existente -- reaproveitando em vez de criar outra.`
          : `Confirmacao criada a partir de ${fiscalDocumentIds.length} nota(s).`
      );
      await load();
      scrollTo(detailRef);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao criar a partir de notas."}`);
    }
  }

  function partnerTargetFromPartnerId(partnerId: string): DealPartyTarget | null {
    const partner = partners.find((item) => item.id === partnerId);
    if (!partner) return null;
    const primaryEntity = partnerLegalEntities.find((item) => item.businessPartnerId === partnerId && item.isPrimary) ?? null;
    return {
      businessPartnerId: partner.id,
      partnerLegalEntityId: primaryEntity?.id ?? null,
      manualName: null,
      displayName: primaryEntity ? legalEntityDisplayName(primaryEntity) : partner.displayName
    };
  }

  function partnerTargetFromLegalEntityId(legalEntityId: string): DealPartyTarget | null {
    const entity = partnerLegalEntities.find((item) => item.id === legalEntityId);
    if (!entity) return null;
    const partner = entity.businessPartnerId ? partners.find((item) => item.id === entity.businessPartnerId) ?? null : null;
    return {
      businessPartnerId: partner?.id ?? null,
      partnerLegalEntityId: entity.id,
      manualName: partner ? null : legalEntityDisplayName(entity),
      displayName: legalEntityDisplayName(entity) || partner?.displayName || "Empresa da NF"
    };
  }

  async function openConfirmation(id: string): Promise<void> {
    const opened = await window.operationsCafe.getDealConfirmation(id);
    setDetail(opened);
    loadBankFieldsFromDetail(opened);
    await refreshPreview(opened);
    setView("detail");
    scrollTo(detailRef);
  }

  async function generatePreview(): Promise<void> {
    if (!detail) return;
    const updated = await window.operationsCafe.generateDealConfirmationPreview(detail.confirmation.id);
    if (!updated) {
      setMessage("Geracao cancelada. Nenhuma pasta foi escolhida.");
      return;
    }
    setDetail(updated);
    await refreshPreview(updated);
    setMessage("Previa gerada e salva na pasta escolhida.");
    scrollTo(detailRef);
  }

  async function issue(): Promise<void> {
    if (!detail) return;
    const updated = await window.operationsCafe.issueDealConfirmation(detail.confirmation.id);
    if (!updated) {
      setMessage("Emissao cancelada. Nenhuma pasta foi escolhida.");
      return;
    }
    setDetail(updated);
    await refreshPreview(updated);
    setMessage("Confirmacao emitida e salva na pasta escolhida.");
    await load();
    scrollTo(detailRef);
  }

  async function saveBankDetails(): Promise<void> {
    if (!detail) return;
    const basisPoints = brokerageInput.trim() ? Math.round(Number(brokerageInput.replace(",", ".")) * 100) : null;
    const updated = await window.operationsCafe.updateDealConfirmationDraft(detail.confirmation.id, {
      brokeragePercentageBasisPoints: basisPoints,
      bankName: bankName || null,
      bankCode: bankCode || null,
      bankAgency: bankAgency || null,
      bankAccount: bankAccount || null,
      bankAccountType: bankAccountType || null,
      bankHolderName: bankHolderName || null,
      bankHolderDocument: bankHolderDocument || null,
      pixKey: pixKey || null,
      pixKeyType: pixKeyType || null
    });
    setDetail(updated);
    setMessage("Dados de corretagem e banco atualizados.");
  }

  async function saveDocumentDetails(): Promise<void> {
    if (!detail) return;
    const updated = await window.operationsCafe.updateDealConfirmationDraft(detail.confirmation.id, {
      deliveryLocationSnapshot: deliveryText.trim() || null,
      paymentTermsSnapshot: paymentTerms.trim() || null,
      qualityTermsSnapshot: qualityTerms.trim() || null,
      generalTermsSnapshot: generalTerms.trim() || null,
      publicNotes: publicNotes.trim() || null
    });
    setDetail(updated);
    loadBankFieldsFromDetail(updated);
    setMessage("Dados manuais da confirmacao atualizados.");
  }

  async function setDeliveryRecipient(): Promise<void> {
    if (!detail || !deliveryRecipientId) return;
    const target = partnerTargetFromLegalEntityId(deliveryRecipientId);
    if (!target) return;
    const existing = detail.parties.filter((party) => party.partyRole === "DELIVERY_RECIPIENT");
    await Promise.all(existing.map((party) => window.operationsCafe.removeDealConfirmationParty(party.id)));
    const updated = await window.operationsCafe.addDealConfirmationParty({ dealConfirmationId: detail.confirmation.id, partyRole: "DELIVERY_RECIPIENT", businessPartnerId: target.businessPartnerId, partnerLegalEntityId: target.partnerLegalEntityId, ownLegalEntityId: null, manualName: target.manualName, representativeName: null, sortOrder: 3 }).then(() => window.operationsCafe.getDealConfirmation(detail.confirmation.id));
    setDetail(updated);
    setMessage("Local de descarga definido.");
  }

  async function addClauseFromTemplate(): Promise<void> {
    if (!detail || !clauseTemplateId) return;
    const template = clauses.find((item) => item.id === clauseTemplateId);
    if (!template) return;
    const nextSortOrder = detail.clauses.length;
    const updated = await window.operationsCafe.addDealConfirmationClause({ dealConfirmationId: detail.confirmation.id, clauseNumber: String(nextSortOrder + 1), title: template.title, clauseText: template.clauseText, sortOrder: nextSortOrder, isVisible: true }).then(() => window.operationsCafe.getDealConfirmation(detail.confirmation.id));
    setDetail(updated);
    setMessage("Clausula adicionada.");
  }

  async function importSigned(): Promise<void> {
    if (!detail) return;
    const selected = await window.operationsCafe.selectSignedDealPdf();
    if (!selected) return;
    setDetail(await window.operationsCafe.importSignedDealConfirmationDocument(detail.confirmation.id, { token: selected.token, notes: "Assinatura externa registrada pelo usuario" }));
    setMessage("PDF assinado importado. O sistema nao valida criptograficamente a assinatura nesta etapa.");
    await load();
  }

  async function cancelDeal(): Promise<void> {
    if (!detail) return;
    const reason = await requestTextInput({ title: "Cancelar confirmação", label: "Motivo formal do cancelamento" }) ?? "";
    if (!reason) return;
    setDetail(await window.operationsCafe.cancelDealConfirmation(detail.confirmation.id, reason));
    await load();
  }

  async function replaceDeal(): Promise<void> {
    if (!detail) return;
    const reason = await requestTextInput({ title: "Substituir confirmação", label: "Motivo formal da substituição" }) ?? "";
    if (!reason) return;
    setDetail(await window.operationsCafe.replaceDealConfirmation(detail.confirmation.id, reason));
    await load();
  }

  async function deleteDeal(id = detail?.confirmation.id): Promise<void> {
    if (!id) return;
    const target = confirmations.find((item) => item.id === id) ?? detail?.confirmation;
    const label = target?.confirmationNumber ?? target?.temporaryReference ?? "esta confirmacao";
    const confirmed = await requestDecision({
      title: "Excluir confirmação definitivamente",
      message: `Deseja excluir ${label}? Documentos, participantes, itens, clausulas, assinantes e historico desta confirmacao tambem serao removidos.`
    });
    if (!confirmed) return;
    try {
      await window.operationsCafe.deleteDealConfirmation(id);
      if (detail?.confirmation.id === id) {
        setDetail(null);
        setPreviewBase64(null);
        setView("list");
      }
      setMessage("Confirmacao excluida definitivamente.");
      await load();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao excluir confirmacao."}`);
    }
  }

  async function createClauseTemplate(): Promise<void> {
    const name = await requestTextInput({ title: "Nova clausula", label: "Nome da clausula (uso interno)" });
    if (!name) return;
    const clauseText = await requestTextInput({ title: "Nova clausula", label: "Texto da clausula (aparece no PDF)" });
    if (!clauseText) return;
    await window.operationsCafe.createDealClauseTemplate({ organizationId, name, title: null, clauseText, category: "GENERAL", isActive: true });
    setMessage("Clausula cadastrada na biblioteca.");
    await load();
  }

  function dealPartyName(role: string): string {
    const party = detail?.parties.find((item) => item.partyRole === role);
    if (!party) return "-";
    try {
      const snapshot = JSON.parse(party.snapshotJson) as { name?: string; legalName?: string; taxId?: string };
      const taxId = snapshot.taxId ? ` - ${snapshot.taxId}` : "";
      return `${snapshot.name ?? snapshot.legalName ?? party.manualName ?? "Participante"}${taxId}`;
    } catch {
      return party.manualName ?? "Participante";
    }
  }

  return (
    <section className="content-section settings">
      <PageHeader
        eyebrow="Comercial"
        title="Confirmações de negócio"
        description="Crie confirmações, controle documentos, assinaturas externas, cláusulas e relatórios comerciais."
      />
      {tab === "Confirmacoes" && view !== "list" && (
        <Stepper
          activeId="origin"
          steps={[
            { id: "origin", label: "Origem", status: "current" },
            { id: "parties", label: "Participantes", status: detail?.parties.length ? "complete" : "pending" },
            { id: "items", label: "Itens", status: detail?.items.length ? "complete" : "pending" },
            { id: "documents", label: "Documentos", status: detail?.documents.length ? "complete" : "pending" }
          ]}
        />
      )}
      <div className="settings-tabs">{["Confirmacoes", "Clausulas"].map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</div>
      {tab === "Confirmacoes" && view !== "detail" && (
        <div className="cards">
          <article><span>Confirmacoes</span><strong>{summary?.confirmations ?? 0}</strong></article>
          <article><span>Sacas confirmadas</span><strong>{summary?.totalSacksDecimal ?? "0"}</strong></article>
          <article><span>Valor comercial</span><strong>{formatCurrencyFromCents(summary?.totalCommercialAmountCents ?? 0)}</strong></article>
          <article><span>Aguardando assinatura</span><strong>{summary?.waitingSignature ?? 0}</strong></article>
          <article><span>Assinadas</span><strong>{summary?.signed ?? 0}</strong></article>
          <article><span>Sem NF</span><strong>{summary?.withoutFiscalDocument ?? 0}</strong></article>
        </div>
      )}
      {tab === "Confirmacoes" && view === "list" && (
        <>
          <div className="page-title-row">
            <p className="muted">Confirmações já criadas nesta empresa/CNPJ.</p>
            <button className="primary" onClick={() => setView("new")}>+ Nova confirmação</button>
          </div>
          <div className="table">
            <div className="table-head confirmation-grid"><span>Numero</span><span>Data</span><span>Sacas</span><span>Valor</span><span>Status</span><span>Assinatura</span><span>Acoes</span></div>
            {confirmations.map((item) => <div key={item.id} className="table-row confirmation-grid"><span>{item.confirmationNumber ?? item.temporaryReference}</span><span>{formatDateBr(item.confirmationDate)}</span><span>{item.totalQuantitySacksDecimal}</span><span>{formatCurrencyFromCents(item.totalCommercialAmountCents)}</span><span><StatusBadge status={item.status} /></span><span><StatusBadge status={item.signatureStatus} /></span><span className="actions"><button onClick={() => void openConfirmation(item.id)}>Abrir</button><button className="danger-action" onClick={() => void deleteDeal(item.id)}>Excluir</button></span></div>)}
          </div>
        </>
      )}
      {tab === "Confirmacoes" && view === "new" && (
        <>
          <div className="page-title-row">
            <button onClick={() => setView("list")}>&larr; Voltar para a lista</button>
          </div>
          <div className="settings-tabs">
            <button className={creationMode === "notes" ? "active" : ""} onClick={() => setCreationMode("notes")}>A partir de notas fiscais</button>
            <button className={creationMode === "manual" ? "active" : ""} onClick={() => setCreationMode("manual")}>Criação manual</button>
          </div>
          {creationMode === "notes" && (
            <AdminBlock title="Criar a partir de notas fiscais">
              <p className="muted">Fluxo recomendado: busque por cliente/corretor, por empresa/CNPJ ou direto pelo número da nota e marque as notas já emitidas para gerar o fechamento automaticamente.</p>
              <div className="settings-tabs">
                <button className={sourceSearchMode === "corretor" ? "active" : ""} onClick={() => { setSourceSearchMode("corretor"); setSourceLegalEntityId(""); setCompanySearchTerm(""); setSourceDocumentNumberFilter(""); }}>Buscar por cliente/corretor</button>
                <button className={sourceSearchMode === "empresa" ? "active" : ""} onClick={() => { setSourceSearchMode("empresa"); setSourceClientId(""); setShowCompanyResults(false); setSourceDocumentNumberFilter(""); }}>Buscar por empresa/CNPJ</button>
                <button className={sourceSearchMode === "numero" ? "active" : ""} onClick={() => { setSourceSearchMode("numero"); setSourceClientId(""); setSourceLegalEntityId(""); setCompanySearchTerm(""); setShowCompanyResults(false); }}>Buscar por numero da nota</button>
              </div>
              {sourceSearchMode === "corretor" ? (
                <FormGrid>
                  <PartnerQuickSearch label="Cliente (comprador)" value={sourceClientId} onChange={setSourceClientId} partners={clientPartners} legalEntities={partnerLegalEntities} />
                </FormGrid>
              ) : sourceSearchMode === "numero" ? (
                <FormGrid>
                  <TextField label="Numero da nota (parte do numero ja filtra, ex: 79 acha 790, 791...)" value={sourceDocumentNumberFilter} onChange={setSourceDocumentNumberFilter} />
                  <DateInput label="Notas emitidas de (opcional)" value={sourceDateStart} onChange={(event) => setSourceDateStart(event.target.value)} />
                  <DateInput label="ate (opcional)" value={sourceDateEnd} onChange={(event) => setSourceDateEnd(event.target.value)} />
                  {sourceDateStart !== firstDayOfCurrentMonth() || sourceDateEnd !== todayDate() ? (
                    <button type="button" onClick={() => { setSourceDateStart(firstDayOfCurrentMonth()); setSourceDateEnd(todayDate()); }}>Mes atual</button>
                  ) : null}
                </FormGrid>
              ) : (
                <FormGrid>
                  <TextField label="Buscar empresa por nome ou CNPJ" value={companySearchTerm} onChange={(value) => { setCompanySearchTerm(value); setSourceLegalEntityId(""); setShowCompanyResults(true); }} />
                  <TextField label="Numero da nota" value={sourceDocumentNumberFilter} onChange={setSourceDocumentNumberFilter} />
                  <DateInput label="Notas emitidas de" value={sourceDateStart} onChange={(event) => setSourceDateStart(event.target.value)} />
                  <DateInput label="ate" value={sourceDateEnd} onChange={(event) => setSourceDateEnd(event.target.value)} />
                  {sourceDateStart !== firstDayOfCurrentMonth() || sourceDateEnd !== todayDate() ? (
                    <button type="button" onClick={() => { setSourceDateStart(firstDayOfCurrentMonth()); setSourceDateEnd(todayDate()); }}>Mes atual</button>
                  ) : null}
                  <button type="button" onClick={() => setShowCompanyResults((current) => !current)}>{showCompanyResults ? "Ocultar empresas" : "Listar empresas"}</button>
                  {showCompanyResults || companySearchTerm.trim() ? (
                    <div className="confirmation-company-results">
                      {companySearchResults.length ? companySearchResults.map((entity) => (
                        <div key={entity.id} className="confirmation-company-result-row">
                          <button
                            type="button"
                            className={entity.id === sourceLegalEntityId ? "partner-action-button partner-action-button--primary" : "partner-action-button"}
                            onClick={() => {
                              setSourceLegalEntityId(entity.id);
                              setCompanySearchTerm(legalEntityDisplayName(entity));
                              setShowCompanyResults(false);
                            }}
                          >
                            {legalEntitySearchLabel(entity)}
                          </button>
                        </div>
                      )) : <div className="confirmation-company-result-row"><span>Nenhuma empresa encontrada.</span></div>}
                    </div>
                  ) : null}
                  {selectedSourceCompany ? (
                    <div className="confirmation-company-selected">
                      <span>Empresa selecionada</span>
                      <strong>{legalEntityDisplayName(selectedSourceCompany)}</strong>
                      {selectedSourceCompany.tradeName !== legalEntityDisplayName(selectedSourceCompany) ? <small>Fantasia: {selectedSourceCompany.tradeName}</small> : null}
                      <small>{selectedSourceCompany.cnpj ?? "CNPJ nao informado"}</small>
                    </div>
                  ) : null}
                </FormGrid>
              )}
              {sourceDocuments.length ? (
                <div className="table">
                  <div className="table-head confirmation-source-grid"><span></span><span>NF</span><span>Empresa/Destinatario</span><span>Emissao</span><span>Sacas</span><span>Valor total</span></div>
                  {sourceDocuments.map((row) => {
                    const company = partnerLegalEntities.find((entity) => entity.id === row.document.partnerLegalEntityId);
                    return (
                      <div key={row.document.id} className="table-row confirmation-source-grid">
                        <span><input type="checkbox" checked={Boolean(selectedDocumentIds[row.document.id])} onChange={(event) => setSelectedDocumentIds((current) => ({ ...current, [row.document.id]: event.target.checked }))} /></span>
                        <span>{row.document.documentNumber}</span>
                        <span>{company ? legalEntityDisplayName(company) : (fiscalDocumentCounterpartyNameFromSnapshot(row.document) ?? "Empresa nao vinculada")}</span>
                        <span>{formatDateBr(row.document.issueDate)}</span>
                        <span>{row.sacks.replace(".", ",")}</span>
                        <span>{formatCurrencyFromCents(row.document.totalAmountCents)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="Nenhuma nota encontrada"
                  description={sourceSearchMode === "corretor"
                    ? "Este cliente/corretor nao possui notas fiscais confirmadas dentro do periodo selecionado."
                    : sourceSearchMode === "numero"
                      ? "Digite parte do numero da nota pra buscar (independente de empresa ou cliente)."
                      : "Essa empresa/CNPJ nao possui notas fiscais confirmadas dentro do periodo selecionado. Confira o intervalo de datas ou clique em Mes atual."}
                />
              )}
              <div className="confirmation-source-stats">
                <span>{selectedCount} nota(s) selecionada(s)</span>
                <span>Total de sacas: {selectedTotalSacks.replace(".", ",")}</span>
                <span>Valor medio: {formatCurrencyFromCents(Math.round(selectedAvgPricePerSack * 100))}/saca</span>
                <span>Valor total: {formatCurrencyFromCents(selectedTotalCents)}</span>
              </div>
              <div className="toolbar">
                <button className="primary" onClick={() => void createFromNotes()} disabled={selectedCount === 0}>Gerar confirmacao das notas selecionadas</button>
              </div>
            </AdminBlock>
          )}
          {creationMode === "manual" && (
            <AdminBlock title="Criacao manual">
              <p className="muted">Use quando ainda não existe nota fiscal emitida para este negócio.</p>
              <p className="muted">Vendedor: <strong>{ownEntityName}</strong> (empresa/CNPJ propio selecionado no topo).</p>
              <FormGrid>
                <PartnerQuickSearch label="Comprador (cliente)" value={buyerId} onChange={setBuyerId} partners={clientPartners} legalEntities={partnerLegalEntities} />
                <SelectField label="Produto" value={productId} onChange={setProductId} options={products.map((item) => [item.id, item.name])} />
                <TextField label="Sacas" value={quantity} onChange={setQuantity} />
                <TextField label="Preco por saca" value={price} onChange={setPrice} />
                <button className="primary" onClick={() => void createManual()}>Criar confirmacao</button>
              </FormGrid>
            </AdminBlock>
          )}
        </>
      )}
      {tab === "Confirmacoes" && view === "detail" && detail && (
        <>
          <div className="page-title-row">
            <button onClick={() => { setView("list"); setDetail(null); setPreviewBase64(null); }}>&larr; Voltar para a lista</button>
          </div>
          <div ref={detailRef}>
          <AdminBlock title={`Detalhe ${detail.confirmation.confirmationNumber ?? detail.confirmation.temporaryReference}`}>
            <div className="confirmation-detail-columns">
              <div className="confirmation-detail-column">
                <div className="confirmation-parties-row">
                  {detail.parties.filter((party) => party.partyRole !== "ISSUER").map((party) => <ConfirmationPartyCard key={party.id} party={party} />)}
                </div>
                <FormGrid>
                  <LegalEntityQuickSearch label="Definir/alterar local de descarga" value={deliveryRecipientId} onChange={setDeliveryRecipientId} legalEntities={partnerLegalEntities} />
                  <button onClick={() => void setDeliveryRecipient()} disabled={!deliveryRecipientId}>Salvar local</button>
                </FormGrid>

                <h3>Dados manuais do documento</h3>
                <p className="muted">Use estes campos para ajustar o texto que aparece no PDF antes de gerar a previa ou emitir a confirmacao.</p>
                <FormGrid>
                  <Textarea label="Local de descarga no PDF" rows={3} value={deliveryText} onChange={(event) => setDeliveryText(event.target.value)} />
                  <Textarea label="Condicao de pagamento" rows={3} value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} />
                  <Textarea label="Qualidade" rows={3} value={qualityTerms} onChange={(event) => setQualityTerms(event.target.value)} />
                  <Textarea label="Condicoes gerais" rows={3} value={generalTerms} onChange={(event) => setGeneralTerms(event.target.value)} />
                  <Textarea label="Observacoes" rows={3} value={publicNotes} onChange={(event) => setPublicNotes(event.target.value)} />
                  <button className="primary" onClick={() => void saveDocumentDetails()}>Salvar dados do documento</button>
                </FormGrid>

                <h3><HandshakeIcon /> Itens</h3>
                <ConfirmationItemsTable items={detail.items} />

                <h3>Corretagem e dados bancarios</h3>
                <p className="muted">Preenchidos automaticamente pelo CNPJ proprio. Altere aqui quando este fechamento precisar de dados diferentes.</p>
                <FormGrid>
                  <TextField label="Corretagem (%)" value={brokerageInput} onChange={setBrokerageInput} />
                  <TextField label="Banco" value={bankName} onChange={setBankName} />
                  <TextField label="Codigo do banco" value={bankCode} onChange={setBankCode} />
                  <TextField label="Agencia" value={bankAgency} onChange={setBankAgency} />
                  <TextField label="Conta" value={bankAccount} onChange={setBankAccount} />
                  <TextField label="Tipo da conta" value={bankAccountType} onChange={setBankAccountType} />
                  <TextField label="Titular da conta" value={bankHolderName} onChange={setBankHolderName} />
                  <TextField label="CPF/CNPJ do titular" value={bankHolderDocument} onChange={setBankHolderDocument} />
                  <TextField label="Chave PIX" value={pixKey} onChange={setPixKey} />
                  <TextField label="Tipo da chave PIX" value={pixKeyType} onChange={setPixKeyType} />
                  <button onClick={() => void saveBankDetails()}>Salvar dados</button>
                </FormGrid>

                <h3>Clausulas</h3>
                {detail.clauses.length > 0 ? <ul>{detail.clauses.map((clause) => <li key={clause.id}>{clause.title ? `${clause.title} - ` : ""}{clause.clauseText}</li>)}</ul> : <p className="muted">Nenhuma clausula adicionada ainda.</p>}
                {clauses.length > 0 ? (
                  <div className="inline-actions">
                    <SelectField label="Adicionar clausula da biblioteca" value={clauseTemplateId} onChange={setClauseTemplateId} options={clauses.filter((item) => item.isActive).map((item) => [item.id, item.name])} />
                    <button disabled={!clauseTemplateId} onClick={() => void addClauseFromTemplate()}>Adicionar</button>
                  </div>
                ) : <p className="muted">Cadastre clausulas na aba "Clausulas" para poder anexa-las aqui.</p>}

                <div className="cards">
                  <article><span>Itens</span><strong>{detail.items.length}</strong></article>
                  <article><span>Notas</span><strong>{detail.fiscalDocuments.length}</strong></article>
                  <article><span>Operacoes</span><strong>{detail.operations.length}</strong></article>
                  <article><span>Versoes</span><strong>{detail.documents.length}</strong></article>
                  <article><span>Pendencias</span><strong>{detail.pendingIssues.length}</strong></article>
                </div>
                <div className="confirmation-issue-review">
                  <div className="section-title-row">
                    <div>
                      <h3>Revisao antes de emitir</h3>
                      <p className="muted">Confira os principais dados que vao para a previa e para o PDF definitivo.</p>
                    </div>
                    <span className="summary-pill">{detail.confirmation.confirmationNumber ?? detail.confirmation.temporaryReference}</span>
                  </div>
                  <div className="confirmation-review-grid">
                    <article><span>Vendedor</span><strong>{dealPartyName("SELLER")}</strong></article>
                    <article><span>Comprador</span><strong>{dealPartyName("BUYER")}</strong></article>
                    <article><span>Local de descarga</span><strong>{deliveryText || dealPartyName("DELIVERY_RECIPIENT")}</strong></article>
                    <article><span>Notas selecionadas</span><strong>{detail.fiscalDocuments.map((doc) => `NF ${doc.documentNumber}`).join(", ") || "-"}</strong></article>
                    <article><span>Observacoes</span><strong>{publicNotes || "Sem observacoes"}</strong></article>
                    <article><span>Dados bancarios</span><strong>{[bankName, bankAgency ? `Ag. ${bankAgency}` : "", bankAccount ? `Conta ${bankAccount}` : "", bankHolderName ? `Titular ${bankHolderName}` : "", pixKey ? `PIX ${pixKey}` : ""].filter(Boolean).join(" · ") || "Nao informado"}</strong></article>
                  </div>
                  {detail.pendingIssues.length ? <p className="charge-blocked-note">Existem pendencias nesta confirmacao. Revise antes de emitir definitivamente.</p> : null}
                </div>
                <div className="actions">
                  <button onClick={() => void generatePreview()}>Gerar previa</button>
                  <button className="primary" onClick={() => void issue()}>Emitir</button>
                  <button onClick={() => void window.operationsCafe.markDealConfirmationSentForSignature(detail.confirmation.id).then(setDetail)}>Enviada para assinatura</button>
                  <button onClick={() => void importSigned()}>Importar assinada</button>
                  <button onClick={() => void cancelDeal()}>Cancelar</button>
                  <button onClick={() => void replaceDeal()}>Substituir</button>
                  <button className="danger-action" onClick={() => void deleteDeal()}>Excluir definitivamente</button>
                </div>
                <div className="table">
                  <div className="table-head document-grid"><span>Versao</span><span>Tipo</span><span>Hash</span><span>Arquivo</span><span>Acoes</span></div>
                  {detail.documents.map((item) => <div key={item.id} className="table-row document-grid"><span>{item.versionNumber}</span><span>{item.documentType}</span><span>{item.fileHash.slice(0, 12)}</span><span>{item.originalFileName}</span><span><button onClick={() => void window.operationsCafe.openDealDocument(item.id)}>Abrir</button><button onClick={() => void window.operationsCafe.revealDealDocumentFolder(item.id)}>Pasta</button></span></div>)}
                </div>
              </div>
              <div className="confirmation-detail-column confirmation-preview-column">
                <h3>Previa do documento</h3>
                {previewBase64 ? (
                  <embed src={`data:application/pdf;base64,${previewBase64}`} type="application/pdf" className="confirmation-pdf-embed" />
                ) : (
                  <EmptyState title="Sem previa gerada" description="Clique em 'Gerar previa' ou 'Emitir' para ver o documento aqui." />
                )}
              </div>
            </div>
          </AdminBlock>
          </div>
        </>
      )}
      {tab === "Clausulas" && <AdminBlock title="Biblioteca de Clausulas"><div className="actions"><button className="primary" onClick={() => void createClauseTemplate()}>Criar clausula</button></div><div className="table"><div className="table-head clause-grid"><span>Nome</span><span>Categoria</span><span>Titulo</span><span>Status</span><span>Acoes</span></div>{clauses.map((item) => <div key={item.id} className="table-row clause-grid"><span>{item.name}</span><span>{item.category}</span><span>{item.title ?? "-"}</span><span>{item.isActive ? "Ativa" : "Inativa"}</span><span><button onClick={() => void window.operationsCafe.duplicateDealClauseTemplate(item.id).then(() => load())}>Duplicar</button></span></div>)}</div></AdminBlock>}
      <Feedback message={message} />
    </section>
  );
}
