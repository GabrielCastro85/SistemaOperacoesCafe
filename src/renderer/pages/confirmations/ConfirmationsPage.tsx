import React, { useCallback, useEffect, useState } from "react";
import type { BootstrapData, BusinessPartner, DealClauseTemplate, DealConfirmation, DealConfirmationDetail, DealConfirmationSummary, DealConfirmationTemplate, FiscalDocument, Product } from "../../../shared/types/domain";
import { formatCurrencyFromCents, formatDateBr } from "../../../shared/utils/format";
import { sumDecimalTexts } from "../../../shared/utils/decimal";
import { EmptyState, HandshakeIcon, PageHeader, StatusBadge, Stepper } from "../../design-system";
import { SelectField, TextField } from "../../components/forms/LegacyFields";
import { AdminBlock, FormGrid } from "../../components/layout/SectionPrimitives";
import { Feedback } from "../../components/feedback/Feedback";
import { requestTextInput } from "../../utils/dialogs";
import { ConfirmationPartyCard } from "./components/ConfirmationPartyCard";
import { ConfirmationItemsTable } from "./components/ConfirmationItemsTable";

interface SourceDocumentRow {
  document: FiscalDocument;
  sacks: string;
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
  const [products, setProducts] = useState<Product[]>([]);
  const [templates, setTemplates] = useState<DealConfirmationTemplate[]>([]);
  const [clauses, setClauses] = useState<DealClauseTemplate[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [buyerId, setBuyerId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("685");
  const [price, setPrice] = useState("1000.0000");
  const [sourceClientId, setSourceClientId] = useState("");
  const [sourceDocuments, setSourceDocuments] = useState<SourceDocumentRow[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Record<string, boolean>>({});
  const [brokerageInput, setBrokerageInput] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [bankAgency, setBankAgency] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [deliveryRecipientId, setDeliveryRecipientId] = useState("");
  const [clauseTemplateId, setClauseTemplateId] = useState("");

  const load = useCallback(async () => {
    if (!organizationId) return;
    const [dealList, partnerList, productList, templateList, clauseList, dealSummary] = await Promise.all([
      window.operationsCafe.listDealConfirmations({ organizationId }),
      window.operationsCafe.listBusinessPartners({ organizationId, status: "active" }),
      window.operationsCafe.listProducts({ organizationId, status: "active" }),
      window.operationsCafe.listDealConfirmationTemplates({ organizationId, status: "all" }),
      window.operationsCafe.listDealClauseTemplates(organizationId),
      window.operationsCafe.getDealConfirmationSummary({ organizationId, ownLegalEntityId: ownLegalEntityId || null, dateStart: null, dateEnd: null, sellerPartnerId: null, buyerPartnerId: null, productId: null, status: null, signatureStatus: null })
    ]);
    setConfirmations(dealList.filter((confirmation) => !ownLegalEntityId || confirmation.ownLegalEntityId === ownLegalEntityId));
    setPartners(partnerList);
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
    if (!sourceClientId) return;
    const documents = (await window.operationsCafe.listFiscalDocuments({ organizationId, ownLegalEntityId, status: "CONFIRMED" })).filter((item) => item.responsiblePartnerId === sourceClientId);
    const rows = await Promise.all(documents.map(async (document): Promise<SourceDocumentRow> => {
      const detailDoc = await window.operationsCafe.getFiscalDocument(document.id);
      const sacks = detailDoc.items.map((item) => item.sacksQuantity).filter((value): value is string => Boolean(value));
      return { document, sacks: sacks.length ? sumDecimalTexts(sacks) : "0" };
    }));
    setSourceDocuments(rows);
    setSelectedDocumentIds({});
  }, [organizationId, ownLegalEntityId, sourceClientId]);

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
    setPixKey(current.confirmation.pixKey ?? "");
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
      setMessage("Confirmacao manual criada.");
      await load();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao criar confirmacao."}`);
    }
  }

  async function addPartiesItemsAndSigners(confirmationId: string, skipItem = false, confirmationOwnLegalEntityId = ownLegalEntityId): Promise<void> {
    if (confirmationOwnLegalEntityId) await window.operationsCafe.addDealConfirmationParty({ dealConfirmationId: confirmationId, partyRole: "SELLER", businessPartnerId: null, partnerLegalEntityId: null, ownLegalEntityId: confirmationOwnLegalEntityId, manualName: null, representativeName: null, sortOrder: 1 });
    if (buyerId) await window.operationsCafe.addDealConfirmationParty({ dealConfirmationId: confirmationId, partyRole: "BUYER", businessPartnerId: buyerId, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 2 });
    if (buyerId) await window.operationsCafe.addDealConfirmationParty({ dealConfirmationId: confirmationId, partyRole: "DELIVERY_RECIPIENT", businessPartnerId: buyerId, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 3 });
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
    await window.operationsCafe.addDealSigner({ dealConfirmationId: confirmationId, partyRole: "SELLER", name: data.legalEntities.find((item) => item.id === confirmationOwnLegalEntityId)?.tradeName ?? "Vendedor", documentNumber: null, positionTitle: null, email: null, phone: null, signatureOrder: 1, signatureStatus: "PENDING", signedAt: null, notes: null });
    await window.operationsCafe.addDealSigner({ dealConfirmationId: confirmationId, partyRole: "BUYER", name: partners.find((item) => item.id === buyerId)?.displayName ?? "Comprador", documentNumber: null, positionTitle: null, email: null, phone: null, signatureOrder: 2, signatureStatus: "PENDING", signedAt: null, notes: null });
  }

  const clientPartners = partners.filter((item) => item.roles.includes("CLIENT"));
  const ownEntityName = data.legalEntities.find((item) => item.id === ownLegalEntityId)?.tradeName ?? "Empresa propria";
  const selectedCount = Object.values(selectedDocumentIds).filter(Boolean).length;
  const selectedRows = sourceDocuments.filter((row) => selectedDocumentIds[row.document.id]);
  const selectedTotalSacks = selectedRows.length ? sumDecimalTexts(selectedRows.map((row) => row.sacks)) : "0";
  const selectedTotalCents = selectedRows.reduce((sum, row) => sum + row.document.totalAmountCents, 0);
  const selectedAvgPricePerSack = Number(selectedTotalSacks) > 0 ? selectedTotalCents / 100 / Number(selectedTotalSacks) : 0;

  async function createFromNotes(): Promise<void> {
    const fiscalDocumentIds = selectedRows.map((row) => row.document.id);
    if (fiscalDocumentIds.length === 0) return;
    try {
      const created = await window.operationsCafe.createDealConfirmationFromFiscalDocuments({ organizationId, ownLegalEntityId, operationIds: [], fiscalDocumentIds });
      await addPartiesItemsAndSigners(created.confirmation.id, true, created.confirmation.ownLegalEntityId);
      const refreshed = await window.operationsCafe.getDealConfirmation(created.confirmation.id);
      setDetail(refreshed);
      loadBankFieldsFromDetail(refreshed);
      setPreviewBase64(null);
      setMessage(`Confirmacao criada a partir de ${fiscalDocumentIds.length} nota(s).`);
      await load();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao criar a partir de notas."}`);
    }
  }

  async function openConfirmation(id: string): Promise<void> {
    const opened = await window.operationsCafe.getDealConfirmation(id);
    setDetail(opened);
    loadBankFieldsFromDetail(opened);
    await refreshPreview(opened);
  }

  async function generatePreview(): Promise<void> {
    if (!detail) return;
    const updated = await window.operationsCafe.generateDealConfirmationPreview(detail.confirmation.id);
    setDetail(updated);
    await refreshPreview(updated);
    setMessage("Previa gerada.");
  }

  async function issue(): Promise<void> {
    if (!detail) return;
    const updated = await window.operationsCafe.issueDealConfirmation(detail.confirmation.id);
    setDetail(updated);
    await refreshPreview(updated);
    setMessage("Confirmacao emitida.");
    await load();
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
      pixKey: pixKey || null
    });
    setDetail(updated);
    setMessage("Dados de corretagem e banco atualizados.");
  }

  async function setDeliveryRecipient(): Promise<void> {
    if (!detail || !deliveryRecipientId) return;
    const existing = detail.parties.filter((party) => party.partyRole === "DELIVERY_RECIPIENT");
    await Promise.all(existing.map((party) => window.operationsCafe.removeDealConfirmationParty(party.id)));
    const updated = await window.operationsCafe.addDealConfirmationParty({ dealConfirmationId: detail.confirmation.id, partyRole: "DELIVERY_RECIPIENT", businessPartnerId: deliveryRecipientId, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 3 }).then(() => window.operationsCafe.getDealConfirmation(detail.confirmation.id));
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

  async function createTemplate(): Promise<void> {
    await window.operationsCafe.createDealConfirmationTemplate({
      organizationId,
      ownLegalEntityId: null,
      name: `Template ${templates.length + 1}`,
      description: null,
      title: "Confirmacao de Negocio",
      subtitle: "Cafe",
      layoutMode: "STANDARD",
      defaultPaymentTerms: "Conforme combinado entre as partes.",
      defaultDeliveryTerms: "Local a definir.",
      defaultQualityTerms: "Qualidade conforme amostra.",
      defaultGeneralTerms: "Textos devem ser revisados pela empresa.",
      showBroker: true,
      showCommercialValues: true,
      showItemOrigins: true,
      showSignatureBlocks: true,
      signatureBlockCount: 2,
      isDefault: templates.length === 0,
      isActive: true
    });
    setMessage("Template criado.");
    await load();
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

  async function generateReport(format: "PDF" | "EXCEL"): Promise<void> {
    const report = await window.operationsCafe.generateConfirmationReport({ reportType: "CONFIRMATIONS_PERIOD", format, filters: { organizationId, ownLegalEntityId: ownLegalEntityId || null, dateStart: null, dateEnd: null, sellerPartnerId: null, buyerPartnerId: null, productId: null, status: null, signatureStatus: null } });
    setMessage(`Relatorio ${format} gerado: ${report.fileName}`);
  }

  return (
    <section className="content-section settings">
      <PageHeader
        eyebrow="Comercial"
        title="Confirmações de negócio"
        description="Crie confirmações, controle documentos, assinaturas externas, templates, cláusulas e relatórios comerciais."
      />
      <Stepper
        activeId="origin"
        steps={[
          { id: "origin", label: "Origem", status: "current" },
          { id: "parties", label: "Participantes", status: detail?.parties.length ? "complete" : "pending" },
          { id: "items", label: "Itens", status: detail?.items.length ? "complete" : "pending" },
          { id: "documents", label: "Documentos", status: detail?.documents.length ? "complete" : "pending" }
        ]}
      />
      <div className="settings-tabs">{["Confirmacoes", "Templates", "Clausulas", "Relatorios"].map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</div>
      <div className="cards">
        <article><span>Confirmacoes</span><strong>{summary?.confirmations ?? 0}</strong></article>
        <article><span>Sacas confirmadas</span><strong>{summary?.totalSacksDecimal ?? "0"}</strong></article>
        <article><span>Valor comercial</span><strong>{formatCurrencyFromCents(summary?.totalCommercialAmountCents ?? 0)}</strong></article>
        <article><span>Aguardando assinatura</span><strong>{summary?.waitingSignature ?? 0}</strong></article>
        <article><span>Assinadas</span><strong>{summary?.signed ?? 0}</strong></article>
        <article><span>Sem NF</span><strong>{summary?.withoutFiscalDocument ?? 0}</strong></article>
      </div>
      {tab === "Confirmacoes" && (
        <>
          <AdminBlock title="Criacao manual">
            <p className="muted">Vendedor: <strong>{ownEntityName}</strong> (empresa/CNPJ propio selecionado no topo).</p>
            <FormGrid>
              <SelectField label="Comprador (cliente)" value={buyerId} onChange={setBuyerId} options={clientPartners.map((item) => [item.id, item.displayName])} />
              <SelectField label="Produto" value={productId} onChange={setProductId} options={products.map((item) => [item.id, item.name])} />
              <TextField label="Sacas" value={quantity} onChange={setQuantity} />
              <TextField label="Preco por saca" value={price} onChange={setPrice} />
              <button className="primary" onClick={() => void createManual()}>Criar confirmacao</button>
            </FormGrid>
          </AdminBlock>

          <AdminBlock title="Criar a partir de notas fiscais">
            <FormGrid>
              <SelectField label="Cliente (comprador)" value={sourceClientId} onChange={setSourceClientId} options={clientPartners.map((item) => [item.id, item.displayName])} />
            </FormGrid>
            {sourceDocuments.length ? (
              <div className="table">
                <div className="table-head confirmation-source-grid"><span></span><span>NF</span><span>Emissao</span><span>Sacas</span><span>Valor total</span></div>
                {sourceDocuments.map((row) => (
                  <div key={row.document.id} className="table-row confirmation-source-grid">
                    <span><input type="checkbox" checked={Boolean(selectedDocumentIds[row.document.id])} onChange={(event) => setSelectedDocumentIds((current) => ({ ...current, [row.document.id]: event.target.checked }))} /></span>
                    <span>{row.document.documentNumber}</span>
                    <span>{formatDateBr(row.document.issueDate)}</span>
                    <span>{row.sacks.replace(".", ",")}</span>
                    <span>{formatCurrencyFromCents(row.document.totalAmountCents)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Nenhuma nota confirmada" description="Este cliente ainda nao possui notas fiscais confirmadas para gerar uma confirmacao." />
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

          <div className="table">
            <div className="table-head confirmation-grid"><span>Numero</span><span>Data</span><span>Sacas</span><span>Valor</span><span>Status</span><span>Assinatura</span><span>Acoes</span></div>
            {confirmations.map((item) => <div key={item.id} className="table-row confirmation-grid"><span>{item.confirmationNumber ?? item.temporaryReference}</span><span>{formatDateBr(item.confirmationDate)}</span><span>{item.totalQuantitySacksDecimal}</span><span>{formatCurrencyFromCents(item.totalCommercialAmountCents)}</span><span><StatusBadge status={item.status} /></span><span><StatusBadge status={item.signatureStatus} /></span><span><button onClick={() => void openConfirmation(item.id)}>Abrir</button></span></div>)}
          </div>

          {detail && (
            <AdminBlock title={`Detalhe ${detail.confirmation.confirmationNumber ?? detail.confirmation.temporaryReference}`}>
              <div className="confirmation-detail-columns">
                <div className="confirmation-detail-column">
                  <div className="confirmation-parties-row">
                    {detail.parties.filter((party) => party.partyRole !== "ISSUER").map((party) => <ConfirmationPartyCard key={party.id} party={party} />)}
                  </div>
                  <FormGrid>
                    <SelectField label="Definir/alterar local de descarga" value={deliveryRecipientId} onChange={setDeliveryRecipientId} options={partners.map((item) => [item.id, item.displayName])} />
                    <button onClick={() => void setDeliveryRecipient()} disabled={!deliveryRecipientId}>Salvar local</button>
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
                    <TextField label="Chave PIX" value={pixKey} onChange={setPixKey} />
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
                  <div className="actions">
                    <button onClick={() => void generatePreview()}>Gerar previa</button>
                    <button className="primary" onClick={() => void issue()}>Emitir</button>
                    <button onClick={() => void window.operationsCafe.markDealConfirmationSentForSignature(detail.confirmation.id).then(setDetail)}>Enviada para assinatura</button>
                    <button onClick={() => void importSigned()}>Importar assinada</button>
                    <button onClick={() => void cancelDeal()}>Cancelar</button>
                    <button onClick={() => void replaceDeal()}>Substituir</button>
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
          )}
        </>
      )}
      {tab === "Templates" && <AdminBlock title="Templates de Confirmacao"><div className="actions"><button className="primary" onClick={() => void createTemplate()}>Criar template</button></div><div className="table"><div className="table-head template-grid"><span>Nome</span><span>Layout</span><span>Padrao</span><span>Status</span><span>Acoes</span></div>{templates.map((item) => <div key={item.id} className="table-row template-grid"><span>{item.name}</span><span>{item.layoutMode}</span><span>{item.isDefault ? "Sim" : "Nao"}</span><span>{item.isActive ? "Ativo" : "Inativo"}</span><span><button onClick={() => void window.operationsCafe.setDefaultDealConfirmationTemplate(item.id).then(() => load())}>Padrao</button><button onClick={() => void window.operationsCafe.duplicateDealConfirmationTemplate(item.id).then(() => load())}>Duplicar</button></span></div>)}</div></AdminBlock>}
      {tab === "Clausulas" && <AdminBlock title="Biblioteca de Clausulas"><div className="actions"><button className="primary" onClick={() => void createClauseTemplate()}>Criar clausula</button></div><div className="table"><div className="table-head clause-grid"><span>Nome</span><span>Categoria</span><span>Titulo</span><span>Status</span><span>Acoes</span></div>{clauses.map((item) => <div key={item.id} className="table-row clause-grid"><span>{item.name}</span><span>{item.category}</span><span>{item.title ?? "-"}</span><span>{item.isActive ? "Ativa" : "Inativa"}</span><span><button onClick={() => void window.operationsCafe.duplicateDealClauseTemplate(item.id).then(() => load())}>Duplicar</button></span></div>)}</div></AdminBlock>}
      {tab === "Relatorios" && <AdminBlock title="Relatorios de Confirmacoes"><div className="actions"><button className="primary" onClick={() => void generateReport("PDF")}>Gerar PDF</button><button onClick={() => void generateReport("EXCEL")}>Gerar Excel</button></div></AdminBlock>}
      <Feedback message={message} />
    </section>
  );
}
