import React from "react";
import type { BusinessPartner, BusinessPartnerLegalEntity, FiscalDocumentDetail, OperationScope, Product } from "../../../../shared/types/domain";
import { formatCurrencyFromCents, formatDateOnlyBr, formatSacks, onlyDigits, parseCurrencyToCents } from "../../../../shared/utils/format";
import { formatOperationScope, OPERATION_SCOPE_OPTIONS } from "../../../../shared/utils/operationLabels";
import { formatProductUnit } from "../../../../shared/utils/productLabels";
import { formatStatusLabel } from "../../../../shared/utils/statusLabels";
import { isPackagingDocument, PACKAGING_OVERRIDE_PREFIX } from "../../../../shared/utils/packagingBilling";
import { DateInput, EmptyState, StatusBadge } from "../../../design-system";
import { SelectField, TextField } from "../../../components/forms/LegacyFields";
import { PartnerQuickSearch } from "../../../components/forms/PartnerQuickSearch";
import { requestTextInput } from "../../../utils/dialogs";
import { decimalTextBr } from "../operationsFormatters";
import { AdminBlock, FormGrid } from "../../../components/layout/SectionPrimitives";
import type { useFiscalDocumentDetailState } from "../hooks/useFiscalDocumentDetailState";

// Painel de detalhe de uma nota lancada manualmente. O estado vem do hook
// useFiscalDocumentDetailState; as acoes (gravar, excluir, vincular...) continuam na pagina.
export function FiscalDocumentDetailPanel({ detail, state, message, operationType, setMessage, setDetail, products, partners, secondaryPartners, partnerLegalEntities, partnerName, onReload, onAddItem, onCompleteTriangulation, onDelete, onLinkCompany, onOverrideFirstOperation, onSavePackagingUnitValue }: {
  detail: FiscalDocumentDetail;
  state: ReturnType<typeof useFiscalDocumentDetailState>;
  message: string | null;
  operationType: "PURCHASE" | "SALE";
  setMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setDetail: React.Dispatch<React.SetStateAction<FiscalDocumentDetail | null>>;
  products: Product[];
  partners: BusinessPartner[];
  secondaryPartners: BusinessPartner[];
  partnerLegalEntities: BusinessPartnerLegalEntity[];
  partnerName: (id: string | null | undefined) => string;
  onReload: () => Promise<void>;
  onAddItem: () => Promise<void>;
  onCompleteTriangulation: () => Promise<void>;
  onDelete: () => Promise<void>;
  onLinkCompany: (partnerLegalEntityId: string) => Promise<void>;
  onOverrideFirstOperation: () => Promise<void>;
  onSavePackagingUnitValue: () => Promise<void>;
}): JSX.Element {
  const { detailCompanySearchTerm, detailSecondaryPartnerId, financialServiceEnabled, freightDaeAmount, freightDaeEnabled, freightDaeReference, invoiceDaeAmount, invoiceDaeEnabled, invoiceDaeReference, packagingUnitValue, productId, quantity, replacementPartnerId, returnDate, returnQuantity, returnReason, returnUnit, sacks, scope, unitPrice, setDetailCompanySearchTerm, setDetailSecondaryPartnerId, setFinancialServiceEnabled, setFreightDaeAmount, setFreightDaeEnabled, setFreightDaeReference, setInvoiceDaeAmount, setInvoiceDaeEnabled, setInvoiceDaeReference, setPackagingUnitValue, setProductId, setQuantity, setReplacementPartnerId, setReturnDate, setReturnQuantity, setReturnReason, setReturnUnit, setSacks, setScope, setUnitPrice } = state;
  const parseCurrency = (value: string): number => parseCurrencyToCents(value);
  const detailIsPackaging = isPackagingDocument({ documentNotes: detail.document.notes, overrideReasons: detail.operations.map((operation) => operation.manualOverrideReason) });
  const detailMainItem = detail.items[0] ?? null;
  const detailMainOperation = detail.operations[0] ?? null;
  const isTriangulatedDetail = Boolean(detail.document.secondaryResponsiblePartnerId);
  const operationScopeLabel = formatOperationScope(detailMainOperation?.operationScope);
  const operationTypeLabel = detailMainOperation?.operationType === "PURCHASE" ? "Compra" : detailMainOperation?.operationType === "SALE" ? "Venda" : "-";
  const packagingValueSaved = Boolean(detailMainOperation?.manualOverrideReason?.startsWith(`${PACKAGING_OVERRIDE_PREFIX}:`));
  const purchaseLeg = detail.operations.find((op) => op.operationType === "PURCHASE") ?? null;
  const saleLeg = detail.operations.find((op) => op.operationType === "SALE") ?? null;
  return (
    <AdminBlock title={`Detalhe da nota ${detail.document.documentNumber}`}>
        <FormGrid>
          <PartnerQuickSearch label="Corrigir responsavel da nota" value={replacementPartnerId} onChange={setReplacementPartnerId} partners={[...partners, ...secondaryPartners].filter((partner, index, all) => all.findIndex((item) => item.id === partner.id) === index && partner.roles.includes(detail.document.direction === "INBOUND" ? "SUPPLIER" : "CLIENT"))} legalEntities={partnerLegalEntities} />
          <button disabled={!replacementPartnerId || replacementPartnerId === detail.document.responsiblePartnerId || detail.document.status === "CANCELED" || detail.operations.some((op) => op.billingStatus !== "UNBILLED" || op.purchaseSettlementStatus !== "UNSETTLED")} onClick={async () => {
            try {
              const updated = await window.operationsCafe.updateFiscalDocument(detail.document.id, { ...detail.document, responsiblePartnerId: replacementPartnerId, operationType: detail.document.direction === "INBOUND" ? "PURCHASE" : "SALE" });
              setDetail(updated); setReplacementPartnerId(""); await onReload(); setMessage("Responsavel corrigido e tarifa recalculada. Confira os valores.");
            } catch (error) { setMessage(`Erro: ${error instanceof Error ? error.message : "Falha ao corrigir responsavel."}`); }
          }}>Trocar responsavel e recalcular</button>
          <TextField label="Contrato" value={detail.document.contractNumber ?? ""} onChange={(value) => setDetail((current) => current ? ({ ...current, document: { ...current.document, contractNumber: value } }) : current)} />
          <label>Observacoes da nota (sai na cobranca)<textarea rows={3} maxLength={500} value={detail.document.billingObservations ?? ""} onChange={(event) => setDetail((current) => current ? { ...current, document: { ...current.document, billingObservations: event.target.value } } : current)} placeholder="Ex.: lote 123, contrato ABC, referencia do pedido" /></label>
          <button onClick={async () => {
            try {
              const updated = await window.operationsCafe.updateFiscalDocument(detail.document.id, { ...detail.document, operationType: detail.operations[0]?.operationType ?? "SALE", contractNumber: detail.document.contractNumber?.trim() || null });
              setDetail(updated); await onReload(); setMessage("Contrato e observacoes salvos para o relatorio de cobranca.");
            } catch (error) { setMessage(`Erro: ${error instanceof Error ? error.message : "Falha ao salvar contrato."}`); }
          }}>Salvar contrato e observacoes</button>
        </FormGrid>
        <p className="muted">Ao trocar o responsavel, a tarifa anterior (inclusive manual) e substituida pela regra do novo cliente. Notas vinculadas a cobranca ou acerto precisam ser liberadas primeiro.</p>
        <section className="coffee-return-card">
          <header><span>Servico financeiro</span><strong>Define o valor por saca desta nota</strong></header>
          <label className="inline-check">
            <input type="checkbox" checked={financialServiceEnabled} onChange={(event) => setFinancialServiceEnabled(event.target.checked)} />
            Esta nota possui financeiro
          </label>
          <p className="muted">Quando marcado, o sistema usa o valor "com financeiro" cadastrado na regra por saca do cliente. Sem essa marca, usa o valor normal.</p>
          <button className="invoice-action-button invoice-action-button--primary" disabled={detail.operations.some((op) => op.billingStatus !== "UNBILLED" || op.purchaseSettlementStatus !== "UNSETTLED")} onClick={async () => {
            try {
              const updated = await window.operationsCafe.updateFiscalDocument(detail.document.id, {
                ...detail.document,
                operationType: detail.operations[0]?.operationType ?? (detail.document.direction === "INBOUND" ? "PURCHASE" : "SALE"),
                hasFinancialService: financialServiceEnabled
              });
              setDetail(updated);
              await onReload();
              setMessage(`Condicao financeira salva. A tarifa foi recalculada para ${financialServiceEnabled ? "com financeiro" : "sem financeiro"}.`);
            } catch (error) { setMessage(`Erro: ${error instanceof Error ? error.message : "Falha ao salvar a condicao financeira."}`); }
          }}>Salvar condicao e recalcular</button>
        </section>
        <section className="coffee-return-card">
          <header><span>DAE de frete</span><strong>Valor adicional vinculado à NF {detail.document.documentNumber}</strong></header>
          <label className="inline-check">
            <input type="checkbox" checked={freightDaeEnabled} onChange={(event) => {
              setFreightDaeEnabled(event.target.checked);
              if (!event.target.checked) { setFreightDaeReference(""); setFreightDaeAmount(""); }
            }} />
            Foi feito DAE de frete para esta nota
          </label>
          {freightDaeEnabled ? <FormGrid>
            <TextField label="Numero ou referencia do DAE (opcional)" value={freightDaeReference} onChange={setFreightDaeReference} />
            <TextField label="Valor a cobrar (R$)" value={freightDaeAmount} onChange={setFreightDaeAmount} />
          </FormGrid> : null}
          <p className="muted">Ao gerar uma cobranca com esta nota, o DAE entra automaticamente no total e aparece identificado no PDF e na planilha.</p>
          <button className="invoice-action-button invoice-action-button--primary" onClick={async () => {
            const amountCents = freightDaeEnabled ? parseCurrency(freightDaeAmount) : 0;
            if (freightDaeEnabled && amountCents <= 0) { setMessage("Informe um valor de DAE maior que zero."); return; }
            try {
              const updated = await window.operationsCafe.updateFiscalDocument(detail.document.id, {
                ...detail.document,
                operationType: detail.operations[0]?.operationType ?? (detail.document.direction === "INBOUND" ? "PURCHASE" : "SALE"),
                freightDaeReference: freightDaeEnabled ? freightDaeReference.trim() || null : null,
                freightDaeAmountCents: amountCents
              });
              setDetail(updated);
              setFreightDaeEnabled((updated.document.freightDaeAmountCents ?? 0) > 0);
              setFreightDaeReference(updated.document.freightDaeReference ?? "");
              setFreightDaeAmount((updated.document.freightDaeAmountCents ?? 0) > 0 ? formatCurrencyFromCents(updated.document.freightDaeAmountCents ?? 0) : "");
              await onReload();
              setMessage(amountCents > 0 ? "DAE de frete salvo. O valor entrara automaticamente na cobranca desta nota." : "DAE de frete removido desta nota.");
            } catch (error) { setMessage(`Erro: ${error instanceof Error ? error.message : "Falha ao salvar o DAE de frete."}`); }
          }}>Salvar DAE de frete</button>
        </section>
        <section className="coffee-return-card">
          <header><span>DAE da nota fiscal</span><strong>Valor do DAE referente à NF {detail.document.documentNumber}</strong></header>
          <label className="inline-check">
            <input type="checkbox" checked={invoiceDaeEnabled} onChange={(event) => {
              setInvoiceDaeEnabled(event.target.checked);
              if (!event.target.checked) { setInvoiceDaeReference(""); setInvoiceDaeAmount(""); }
            }} />
            Foi feito DAE referente a esta nota
          </label>
          {invoiceDaeEnabled ? <FormGrid>
            <TextField label="Numero ou referencia do DAE (opcional)" value={invoiceDaeReference} onChange={setInvoiceDaeReference} />
            <TextField label="Valor a cobrar (R$)" value={invoiceDaeAmount} onChange={setInvoiceDaeAmount} />
          </FormGrid> : null}
          <p className="muted">Entra na cobranca junto com a nota, como o DAE de frete. Se a nota tiver os dois, a cobranca mostra os dois valores.</p>
          <button className="invoice-action-button invoice-action-button--primary" onClick={async () => {
            const amountCents = invoiceDaeEnabled ? parseCurrency(invoiceDaeAmount) : 0;
            if (invoiceDaeEnabled && amountCents <= 0) { setMessage("Informe um valor de DAE maior que zero."); return; }
            try {
              const updated = await window.operationsCafe.updateFiscalDocument(detail.document.id, {
                ...detail.document,
                operationType: detail.operations[0]?.operationType ?? (detail.document.direction === "INBOUND" ? "PURCHASE" : "SALE"),
                invoiceDaeReference: invoiceDaeEnabled ? invoiceDaeReference.trim() || null : null,
                invoiceDaeAmountCents: amountCents
              });
              setDetail(updated);
              await onReload();
              setMessage(amountCents > 0 ? "DAE da nota salvo. O valor entrara automaticamente na cobranca desta nota." : "DAE da nota removido.");
            } catch (error) { setMessage(`Erro: ${error instanceof Error ? error.message : "Falha ao salvar o DAE da nota."}`); }
          }}>Salvar DAE da nota</button>
        </section>
        <h3>Revisao para cobranca</h3>
        <p>Contrato: <strong>{detail.document.contractNumber || "Nao informado"}</strong></p>
        {detail.operations.map((op) => <div className="operation-warning-card operation-warning-card--neutral" key={op.id}>
          <strong>{partnerName(op.responsiblePartnerId)} · {op.operationType === "SALE" ? "A receber" : "A pagar"} · {formatOperationScope(op.operationScope)}</strong>
          <span>{decimalTextBr(op.quantitySacks)} sacas × {formatCurrencyFromCents(op.appliedRateValueCents)} = {formatCurrencyFromCents(op.serviceAmountCents)}{op.appliedRateValueCents <= 0 ? " — Tarifa pendente: esta operacao nao entra na cobranca." : ""}</span>
        </div>)}
        {detail.operations.some((op) => op.operationType === "SALE") ? <section className="coffee-return-card">
          <header><span>Devolucao de cafe</span><strong>Reduz a quantidade cobrada desta nota</strong></header>
          {(() => {
            const sales = detail.operations.filter((op) => op.operationType === "SALE" && op.status !== "CANCELED");
            const gross = sales.reduce((sum, op) => sum + Number(op.grossQuantitySacks), 0);
            const returned = detail.returns.reduce((sum, item) => sum + Number(item.quantitySacks), 0);
            return <div className="coffee-return-summary"><span>Original: <strong>{decimalTextBr(String(gross))} sacas</strong></span><span>Devolvido: <strong>{decimalTextBr(String(returned))} sacas</strong></span><span>Saldo para cobranca: <strong>{decimalTextBr(String(Math.max(0, gross - returned)))} sacas</strong></span></div>;
          })()}
          <FormGrid>
            <label>Data da devolucao<input type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} /></label>
            <SelectField label="Informar em" value={returnUnit} onChange={(value) => setReturnUnit(value as "SACKS" | "KG")} options={[["SACKS", "Sacas"], ["KG", "Quilos"]]} />
            <TextField label={returnUnit === "KG" ? "Quantidade devolvida (kg)" : "Quantidade devolvida (sacas)"} value={returnQuantity} onChange={setReturnQuantity} />
            <TextField label="Motivo" value={returnReason} onChange={setReturnReason} />
          </FormGrid>
          <p className="muted">Conversao usada: 60 kg = 1 saca. A cobranca e qualquer rascunho em aberto sao recalculados automaticamente.</p>
          <button className="invoice-action-button invoice-action-button--primary" disabled={!returnQuantity.trim() || !returnReason.trim()} onClick={() => void window.operationsCafe.addFiscalDocumentReturn({ fiscalDocumentId: detail.document.id, returnDate, inputUnit: returnUnit, inputQuantity: returnQuantity, reason: returnReason }).then((updated) => { setDetail(updated); setReturnQuantity(""); setReturnReason(""); void onReload(); setMessage("Devolucao registrada e valor da cobranca recalculado."); }).catch((errorValue: unknown) => setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao registrar devolucao."}`))}>Registrar devolucao</button>
          {detail.returns.length ? <div className="coffee-return-history">
            {detail.returns.map((item) => <div key={item.id} className="coffee-return-row"><span>{formatDateOnlyBr(item.returnDate)}</span><span>{decimalTextBr(item.inputQuantity)} {item.inputUnit === "KG" ? "kg" : "sacas"}</span><span>{decimalTextBr(item.quantitySacks)} sacas abatidas</span><strong>{item.reason}</strong><button className="danger" onClick={() => void window.operationsCafe.deleteFiscalDocumentReturn(item.id).then((updated) => { setDetail(updated); void onReload(); setMessage("Devolucao removida e quantidade restaurada."); }).catch((errorValue: unknown) => setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao remover devolucao."}`))}>Remover</button></div>)}
          </div> : null}
        </section> : null}
        {detail.document.hasPendingIssues ? <p role="alert">Pendencias: {detail.document.pendingNotes}. Revise os itens antes de liberar a nota.</p> : null}
        <div className="invoice-detail-layout">
          <section className="invoice-action-card invoice-action-card--wide">
            <header><span>{detail.items.length ? "Dados da nota" : "Adicionar item"}</span><strong>{detail.items.length ? "Preenchido pelo XML/regra" : "Produto e classificacao fiscal"}</strong></header>
            {detailMainItem || detailMainOperation ? (
              <div className="invoice-auto-summary">
                <div><span>Produto</span><strong>{detailMainItem?.description ?? products.find((product) => product.id === detailMainOperation?.productId)?.name ?? "-"}</strong></div>
                <div><span>Quantidade</span><strong>{detailMainItem ? `${detailMainItem.quantity} ${formatProductUnit(detailMainItem.unit)}` : "-"}</strong></div>
                <div><span>Preco comercial</span><strong>{detailMainItem ? decimalTextBr(detailMainItem.unitPriceDecimal) : "-"}</strong></div>
                <div><span>Sacas</span><strong>{detailIsPackaging ? (packagingValueSaved ? "0 (sacaria)" : "Nao soma") : detailMainOperation?.quantitySacks ?? detailMainItem?.sacksQuantity ?? "-"}</strong></div>
                <div><span>UF da venda</span><strong>{operationTypeLabel} / {operationScopeLabel}</strong></div>
                <div><span>Servico calculado</span><strong>{detailMainOperation ? (detailIsPackaging && !packagingValueSaved ? "Informe o valor por unidade" : `${formatCurrencyFromCents(detailMainOperation.serviceAmountCents)} (${formatCurrencyFromCents(detailMainOperation.appliedRateValueCents)}/${detailIsPackaging ? "un" : "saca"})`) : "-"}</strong></div>
              </div>
            ) : null}
            {detail.items.length ? <p className="muted">Os campos abaixo servem apenas para adicionar outro item/operacao manualmente nesta nota.</p> : null}
            <p className="muted">Compra/venda: <strong>{operationType === "PURCHASE" ? "Compra" : "Venda"}</strong> (definido na criacao da nota, mesmo para todos os itens dela).</p>
            <FormGrid>
              <SelectField label="Produto" value={productId} onChange={setProductId} options={products.map((item) => [item.id, item.name])} />
              <SelectField label="UF da venda" value={scope} onChange={(value) => setScope(value as OperationScope)} options={OPERATION_SCOPE_OPTIONS} />
              <TextField label="Quantidade" value={quantity} onChange={setQuantity} />
              <TextField label="Preco unitario comercial" value={unitPrice} onChange={setUnitPrice} />
              <TextField label="Sacas" value={sacks} onChange={setSacks} />
            </FormGrid>
            <button className="invoice-action-button invoice-action-button--primary" onClick={() => void onAddItem()}>Adicionar item e operacao</button>
          </section>
          {detailIsPackaging ? (
          <section className="invoice-action-card">
            <header><span>Remessa de sacaria</span><strong>Valor por unidade</strong></header>
            <p className="muted">Big bag vazio: a nota nao soma sacas. Informe quanto cobrar por unidade{detailMainItem ? ` (${decimalTextBr(detailMainItem.quantity)} unidades)` : ""}. Use 0 para nao cobrar.</p>
            {packagingValueSaved && detailMainOperation ? <p className="muted">Atual: {formatCurrencyFromCents(detailMainOperation.appliedRateValueCents)} por unidade, total {formatCurrencyFromCents(detailMainOperation.serviceAmountCents)}.</p> : null}
            <TextField label="Valor por unidade (R$)" value={packagingUnitValue} onChange={setPackagingUnitValue} />
            <button className="invoice-action-button invoice-action-button--primary" disabled={!detail.operations.length || detail.operations.some((op) => op.billingStatus !== "UNBILLED")} onClick={() => void onSavePackagingUnitValue()}>Salvar valor por unidade</button>
          </section>
          ) : (
          <section className="invoice-action-card">
            <header><span>Servico</span><strong>Valor por saca</strong></header>
            <p className="muted">Altera manualmente a primeira operacao da nota e exige motivo.</p>
            <button className="invoice-action-button" disabled={!detail.operations.length} onClick={() => void onOverrideFirstOperation()}>Alterar valor da primeira operacao</button>
          </section>
          )}
          <section className="invoice-action-card">
            <header><span>Status</span><strong>Controle da nota</strong></header>
            <p className="muted">Confirme para liberar cobranca ou cancele quando a nota deve permanecer no historico.</p>
            <div className="invoice-action-row">
              <button className="invoice-action-button invoice-action-button--primary" disabled={detail.document.status === "CONFIRMED" || detail.document.status === "CANCELED"} onClick={() => window.operationsCafe.confirmFiscalDocument(detail.document.id).then((updated) => { setDetail(updated); void onReload(); }).catch((errorValue: unknown) => setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao confirmar."}`))}>Confirmar nota</button>
              <button className="invoice-action-button" disabled={detail.document.status === "CANCELED"} onClick={() => { void requestTextInput({ title: "Cancelar nota", label: "Motivo do cancelamento" }).then((reason) => { if (reason) void window.operationsCafe.cancelFiscalDocument(detail.document.id, reason).then((updated) => { setDetail(updated); void onReload(); }); }); }}>Cancelar nota</button>
              <button className="invoice-action-button invoice-action-button--danger" onClick={() => void onDelete()}>Excluir nota</button>
            </div>
          </section>
          <section className="invoice-action-card">
            <header><span>Empresa da nota</span><strong>Necessaria para Confirmacoes</strong></header>
            <p className="muted">Nota lancada manualmente (sem XML) nao vem com empresa/CNPJ vinculado. Sem isso ela nao aparece nas buscas de Confirmacoes por empresa ou por numero.</p>
            {(() => {
              const linkedCompany = partnerLegalEntities.find((entity) => entity.id === detail.document.partnerLegalEntityId);
              if (linkedCompany) return <p><strong>Vinculada:</strong> {linkedCompany.legalName || linkedCompany.tradeName} ({linkedCompany.cnpj ?? "CNPJ nao informado"})</p>;
              const term = detailCompanySearchTerm.trim().toUpperCase();
              const digitsTerm = term.replace(/\D/g, "");
              const matches = term ? partnerLegalEntities.filter((entity) =>
                entity.tradeName.toUpperCase().includes(term) ||
                entity.legalName.toUpperCase().includes(term) ||
                (digitsTerm && entity.cnpj?.includes(digitsTerm))
              ).slice(0, 8) : [];
              return (
                <>
                  <TextField label="Buscar empresa por nome ou CNPJ" value={detailCompanySearchTerm} onChange={setDetailCompanySearchTerm} />
                  {matches.length ? (
                    <div className="confirmation-company-results">
                      {matches.map((entity) => (
                        <div key={entity.id} className="confirmation-company-result-row">
                          <button type="button" className="partner-action-button" onClick={() => void onLinkCompany(entity.id)}>{entity.legalName || entity.tradeName} — {entity.cnpj ?? "CNPJ nao informado"}</button>
                        </div>
                      ))}
                    </div>
                  ) : term ? <p className="muted">Nenhuma empresa encontrada.</p> : null}
                </>
              );
            })()}
          </section>
        </div>
        <div className="cards">
          <article><span>Itens</span><strong>{detail.items.map((item) => `${item.description}: ${item.quantity} ${formatProductUnit(item.unit)}`).join(" | ") || "Nenhum"}</strong></article>
          <article><span>Operacoes</span><strong>{detail.operations.map((op) => `${op.operationType}/${formatOperationScope(op.operationScope)}: ${formatSacks(op.quantitySacks)} sacas - ${formatCurrencyFromCents(op.serviceAmountCents)}`).join(" | ") || "Nenhuma"}</strong></article>
          <article><span>Status</span><strong>{formatStatusLabel(detail.document.status)}</strong></article>
        </div>
        {isTriangulatedDetail ? (
          <div className="operation-warning-card operation-warning-card--neutral">
            <strong>Nota triangulada</strong>
            <span>
              Compra: {partnerName(purchaseLeg?.responsiblePartnerId)}
              {purchaseLeg ? ` — ${formatCurrencyFromCents(purchaseLeg.appliedRateValueCents)}/saca (${formatCurrencyFromCents(purchaseLeg.serviceAmountCents)})` : " — sem operacao ainda"}
              {" | "}
              Venda: {partnerName(saleLeg?.responsiblePartnerId)}
              {saleLeg ? ` — ${formatCurrencyFromCents(saleLeg.appliedRateValueCents)}/saca (${formatCurrencyFromCents(saleLeg.serviceAmountCents)})` : " — sem operacao ainda"}
            </span>
          </div>
        ) : detail.operations.length ? (
          <div className="operation-warning-card operation-warning-card--neutral">
            <strong>Completar nota triangulada</strong>
            <span>
              Use quando a nota ja foi importada antes do cadastro do outro lado do negocio. O sistema cria a operacao oposta
              para o parceiro/corretor escolhido, sem duplicar a chave da NF-e.
            </span>
            <div className="toolbar">
              <PartnerQuickSearch
                label={detailMainOperation?.operationType === "PURCHASE" ? "Cliente/corretor para cobranca" : "Fornecedor para acerto"}
                value={detailSecondaryPartnerId}
                onChange={setDetailSecondaryPartnerId}
                partners={secondaryPartners}
                legalEntities={partnerLegalEntities}
              />
              <button className="primary" disabled={!detailSecondaryPartnerId} onClick={() => void onCompleteTriangulation()}>Completar nota</button>
            </div>
          </div>
        ) : null}
        {detail.rateHistory && detail.rateHistory.length > 0 ? (
          <div className="cards">
            <article className="rate-history-card">
              <span>Historico de tarifa</span>
              <strong>
                {detail.rateHistory.map((entry) => (
                  <span key={entry.id} className="rate-history-entry">
                    {formatDateOnlyBr(entry.changedAt)}: {entry.previousRateValueCents !== null ? formatCurrencyFromCents(entry.previousRateValueCents) : "sem valor"} → {entry.newRateValueCents !== null ? formatCurrencyFromCents(entry.newRateValueCents) : "sem valor"}{entry.reason ? ` (${entry.reason})` : ""}
                  </span>
                ))}
              </strong>
            </article>
          </div>
        ) : null}
    </AdminBlock>
  );
}
