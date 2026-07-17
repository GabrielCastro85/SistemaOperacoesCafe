import React, { useCallback, useEffect, useState } from "react";
import type { BootstrapData, BusinessPartner, DealClauseTemplate, DealConfirmation, DealConfirmationDetail, DealConfirmationSummary, DealConfirmationTemplate, Product } from "../../../shared/types/domain";
import { formatCurrencyFromCents } from "../../../shared/utils/format";
import { PageHeader, Stepper } from "../../design-system";
import { SelectField, TextField } from "../../components/forms/LegacyFields";
import { AdminBlock, FormGrid } from "../../components/layout/SectionPrimitives";
import { Feedback } from "../../components/feedback/Feedback";
export function ConfirmationsPage({ data }: { data: BootstrapData }): JSX.Element {
  const organizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "";
  const ownLegalEntityId = data.profile?.defaultLegalEntityId ?? data.legalEntities.find((item) => item.organizationId === organizationId)?.id ?? "";
  const [tab, setTab] = useState("Confirmacoes");
  const [confirmations, setConfirmations] = useState<DealConfirmation[]>([]);
  const [detail, setDetail] = useState<DealConfirmationDetail | null>(null);
  const [summary, setSummary] = useState<DealConfirmationSummary | null>(null);
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [templates, setTemplates] = useState<DealConfirmationTemplate[]>([]);
  const [clauses, setClauses] = useState<DealClauseTemplate[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [sellerId, setSellerId] = useState("");
  const [buyerId, setBuyerId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("685");
  const [price, setPrice] = useState("1000.0000");

  const load = useCallback(async () => {
    if (!organizationId) return;
    const [dealList, partnerList, productList, templateList, clauseList, dealSummary] = await Promise.all([
      window.operationsCafe.listDealConfirmations({ organizationId }),
      window.operationsCafe.listBusinessPartners({ organizationId, status: "active" }),
      window.operationsCafe.listProducts({ organizationId, status: "active" }),
      window.operationsCafe.listDealConfirmationTemplates({ organizationId, status: "all" }),
      window.operationsCafe.listDealClauseTemplates(organizationId),
      window.operationsCafe.getDealConfirmationSummary({ organizationId, ownLegalEntityId: null, dateStart: null, dateEnd: null, sellerPartnerId: null, buyerPartnerId: null, productId: null, status: null, signatureStatus: null })
    ]);
    setConfirmations(dealList);
    setPartners(partnerList);
    setProducts(productList);
    setTemplates(templateList);
    setClauses(clauseList);
    setSummary(dealSummary);
    setSellerId((current) => current || partnerList.find((item) => item.roles.includes("SELLER"))?.id || partnerList[0]?.id || "");
    setBuyerId((current) => current || partnerList.find((item) => item.roles.includes("BUYER"))?.id || partnerList[0]?.id || "");
    setProductId((current) => current || productList[0]?.id || "");
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

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
      if (sellerId) await window.operationsCafe.addDealConfirmationParty({ dealConfirmationId: draft.confirmation.id, partyRole: "SELLER", businessPartnerId: sellerId, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 1 });
      if (buyerId) await window.operationsCafe.addDealConfirmationParty({ dealConfirmationId: draft.confirmation.id, partyRole: "BUYER", businessPartnerId: buyerId, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 2 });
      if (productId) await window.operationsCafe.addDealConfirmationItem({
        dealConfirmationId: draft.confirmation.id,
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
      await window.operationsCafe.addDealConfirmationClause({ dealConfirmationId: draft.confirmation.id, clauseNumber: "1", title: "Texto demonstrativo", clauseText: "Clausula demonstrativa. O texto definitivo deve ser revisado pela empresa.", sortOrder: 0, isVisible: true });
      await window.operationsCafe.addDealSigner({ dealConfirmationId: draft.confirmation.id, partyRole: "SELLER", name: partners.find((item) => item.id === sellerId)?.displayName ?? "Vendedor", documentNumber: null, positionTitle: null, email: null, phone: null, signatureOrder: 1, signatureStatus: "PENDING", signedAt: null, notes: null });
      await window.operationsCafe.addDealSigner({ dealConfirmationId: draft.confirmation.id, partyRole: "BUYER", name: partners.find((item) => item.id === buyerId)?.displayName ?? "Comprador", documentNumber: null, positionTitle: null, email: null, phone: null, signatureOrder: 2, signatureStatus: "PENDING", signedAt: null, notes: null });
      const refreshed = await window.operationsCafe.getDealConfirmation(draft.confirmation.id);
      setDetail(refreshed);
      setMessage("Confirmacao manual criada.");
      await load();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao criar confirmacao."}`);
    }
  }

  async function openConfirmation(id: string): Promise<void> {
    setDetail(await window.operationsCafe.getDealConfirmation(id));
  }

  async function generatePreview(): Promise<void> {
    if (!detail) return;
    setDetail(await window.operationsCafe.generateDealConfirmationPreview(detail.confirmation.id));
    setMessage("Previa gerada.");
  }

  async function issue(): Promise<void> {
    if (!detail) return;
    setDetail(await window.operationsCafe.issueDealConfirmation(detail.confirmation.id));
    setMessage("Confirmacao emitida.");
    await load();
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
    const reason = window.prompt("Motivo formal do cancelamento") ?? "";
    if (!reason) return;
    setDetail(await window.operationsCafe.cancelDealConfirmation(detail.confirmation.id, reason));
    await load();
  }

  async function replaceDeal(): Promise<void> {
    if (!detail) return;
    const reason = window.prompt("Motivo formal da substituicao") ?? "";
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
    await window.operationsCafe.createDealClauseTemplate({ organizationId, name: `Clausula ${clauses.length + 1}`, title: "Demonstrativa", clauseText: "Texto demonstrativo; revisar antes de usar.", category: "GENERAL", isActive: true });
    setMessage("Clausula cadastrada na biblioteca.");
    await load();
  }

  async function generateReport(format: "PDF" | "EXCEL"): Promise<void> {
    const report = await window.operationsCafe.generateConfirmationReport({ reportType: "CONFIRMATIONS_PERIOD", format, filters: { organizationId, ownLegalEntityId: null, dateStart: null, dateEnd: null, sellerPartnerId: null, buyerPartnerId: null, productId: null, status: null, signatureStatus: null } });
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
            <FormGrid>
              <SelectField label="Vendedor" value={sellerId} onChange={setSellerId} options={partners.map((item) => [item.id, item.displayName])} />
              <SelectField label="Comprador" value={buyerId} onChange={setBuyerId} options={partners.map((item) => [item.id, item.displayName])} />
              <SelectField label="Produto" value={productId} onChange={setProductId} options={products.map((item) => [item.id, item.name])} />
              <TextField label="Sacas" value={quantity} onChange={setQuantity} />
              <TextField label="Preco por saca" value={price} onChange={setPrice} />
              <button className="primary" onClick={() => void createManual()}>Criar confirmacao</button>
            </FormGrid>
          </AdminBlock>
          <div className="table">
            <div className="table-head confirmation-grid"><span>Numero</span><span>Data</span><span>Sacas</span><span>Valor</span><span>Status</span><span>Assinatura</span><span>Acoes</span></div>
            {confirmations.map((item) => <div key={item.id} className="table-row confirmation-grid"><span>{item.confirmationNumber ?? item.temporaryReference}</span><span>{item.confirmationDate}</span><span>{item.totalQuantitySacksDecimal}</span><span>{formatCurrencyFromCents(item.totalCommercialAmountCents)}</span><span>{item.status}</span><span>{item.signatureStatus}</span><span><button onClick={() => void openConfirmation(item.id)}>Abrir</button></span></div>)}
          </div>
          {detail && (
            <AdminBlock title="Detalhe da confirmacao">
              <div className="cards">
                <article><span>Numero</span><strong>{detail.confirmation.confirmationNumber ?? detail.confirmation.temporaryReference}</strong></article>
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

