import React from "react";
import type { XmlFileInspection } from "../../../../shared/types/domain";
import { EmptyState, StatusBadge } from "../../../design-system";
import type { buildSelectedXmlView } from "../operationsFormatters";
import { formatCurrencyFromCents, formatDateBr } from "../../../../shared/utils/format";
import { decimalTextBr } from "../operationsFormatters";
import type { useXmlImportState } from "../hooks/useXmlImportState";

type SelectedXmlView = ReturnType<typeof buildSelectedXmlView>;

// Coluna 'Dados extraidos' da importacao de XML: mostra o que foi lido do XML selecionado.
// Os valores vem prontos da pagina (buildSelectedXmlView); aqui so se desenha.
export function XmlImportDataColumn({ selectedXmlFile, view, xml, setMessage }: {
  selectedXmlFile: XmlFileInspection | null;
  view: SelectedXmlView;
  xml: ReturnType<typeof useXmlImportState>;
  setMessage: React.Dispatch<React.SetStateAction<string | null>>;
}): JSX.Element {
  const { xmlBillingObservations, xmlContractNumbers, xmlFinancialServiceEnabled, xmlFreightDaeAmounts, xmlFreightDaeEnabled, xmlFreightDaeReferences, xmlInvoiceDaeAmounts, xmlInvoiceDaeEnabled, xmlInvoiceDaeReferences, setXmlBillingObservations, setXmlContractNumbers, setXmlFinancialServiceEnabled, setXmlFreightDaeAmounts, setXmlFreightDaeEnabled, setXmlFreightDaeReferences, setXmlInvoiceDaeAmounts, setXmlInvoiceDaeEnabled, setXmlInvoiceDaeReferences, setXmlJob } = xml;
  const { selectedXmlIsEvent, selectedXmlEvent, selectedXmlPartnerId, selectedXmlPreview, selectedWarehouseMovement, selectedXmlExtractedContract, selectedXmlParties, selectedXmlItem, selectedXmlSacks, selectedXmlInferredScope, selectedXmlScope, selectedXmlOperationType, selectedXmlOwnMismatch } = view;
  return (
    <>
            <h3>Dados extraídos</h3>
            {selectedXmlEvent ? (
              <>
                <div className="operation-warning-card operation-warning-card--neutral">
                  <strong>Cancelamento autorizado encontrado na Vulpe</strong>
                  <span>Este evento sera ligado a nota pela chave de acesso quando a fila for concluida.</span>
                </div>
                <dl className="kv-list">
                  <div><dt>Chave da NF-e</dt><dd>{String(selectedXmlEvent.accessKey ?? selectedXmlFile?.accessKey ?? "-")}</dd></div>
                  <div><dt>Data do evento</dt><dd>{selectedXmlEvent.eventDate ? formatDateBr(String(selectedXmlEvent.eventDate)) : "-"}</dd></div>
                  <div><dt>Protocolo</dt><dd>{String(selectedXmlEvent.protocolNumber ?? "-")}</dd></div>
                  <div><dt>Situação SEFAZ</dt><dd>{String(selectedXmlEvent.statusCode ?? "-")} - {String(selectedXmlEvent.statusMessage ?? "-")}</dd></div>
                </dl>
              </>
            ) : selectedXmlPreview ? (
              <>
                {selectedXmlOwnMismatch ? (
                  <div className="operation-warning-card operation-warning-card--inline">
                    <strong>Outro CNPJ</strong>
                    <span>Esta nota sera salva na empresa do XML ({selectedXmlParties.ownEntityLabel}).</span>
                  </div>
                ) : null}
                {selectedXmlParties.isThirdPartyOrigin ? (
                  <div className="operation-warning-card operation-warning-card--neutral operation-warning-card--inline">
                    <strong>Empresa externa</strong>
                    <span>Não é um CNPJ Villa ou Grão. Se emitente e destinatario ja estiverem cadastrados, gera compra e venda automaticamente.</span>
                  </div>
                ) : null}
                <div className="xml-detail-parties">
                  <div className="xml-detail-card">
                    <span className="xml-detail-label">Emitente</span>
                    <strong title={selectedXmlParties.issuerLabel ?? undefined}>{selectedXmlParties.issuerLabel ?? "Não identificado"}</strong>
                    <small>Origem: {selectedXmlParties.originLabel}</small>
                  </div>
                  <div className="xml-detail-card">
                    <span className="xml-detail-label">Destinatário</span>
                    <strong title={selectedXmlParties.recipientLabel ?? undefined}>{selectedXmlParties.recipientLabel ?? "Não identificado"}</strong>
                  </div>
                </div>
                <div className="xml-detail-card xml-detail-card--total">
                  <div>
                    <span className="xml-detail-label">Produto</span>
                    <strong>{selectedXmlItem?.description ?? "-"}</strong>
                    <small>{decimalTextBr(selectedXmlSacks)} sacas{selectedXmlItem?.commercialUnitValue ? ` · ${formatCurrencyFromCents(Math.round(Number(selectedXmlItem.commercialUnitValue) * 100))} por saca` : ""}</small>
                  </div>
                  <div className="xml-detail-total">
                    <span className="xml-detail-label">Total dos produtos</span>
                    <strong>{selectedXmlPreview.productsAmountCents != null ? formatCurrencyFromCents(selectedXmlPreview.productsAmountCents) : "-"}</strong>
                  </div>
                </div>
                <div className="xml-detail-card">
                  <span className="xml-detail-label">Documento</span>
                  <dl className="kv-list">
                    <div><dt>Emissão</dt><dd>{selectedXmlPreview.issuedAt ? formatDateBr(selectedXmlPreview.issuedAt) : "-"}</dd></div>
                    <div><dt>Número/Série</dt><dd>{selectedXmlPreview.number ?? "-"}/{selectedXmlPreview.series ?? "-"}</dd></div>
                    <div><dt>Modelo</dt><dd>{selectedXmlPreview.model ?? "-"}</dd></div>
                    <div><dt>Natureza da operação</dt><dd>{selectedXmlPreview.nature ?? "-"}</dd></div>
                    <div><dt>Transportadora</dt><dd>{selectedXmlPreview.transportCarrierName ?? "-"}</dd></div>
                    <div><dt>Chave da NF-e</dt><dd className="xml-detail-key">
                      <span title={selectedXmlPreview.accessKey ?? undefined}>{selectedXmlPreview.accessKey ?? "-"}</span>
                      {selectedXmlPreview.accessKey ? <button type="button" className="xml-copy-key" onClick={() => void navigator.clipboard.writeText(selectedXmlPreview.accessKey ?? "").then(() => setMessage("Chave da NF-e copiada.")).catch(() => setMessage("Nao foi possivel copiar a chave."))}>Copiar</button> : null}
                    </dd></div>
                  </dl>
                </div>
                {selectedXmlFile && !selectedWarehouseMovement ? (
                  <div className="xml-notes-block">
                    <label>Contrato desta nota<input maxLength={200} value={xmlContractNumbers[selectedXmlFile.token] ?? selectedXmlExtractedContract} onChange={(event) => setXmlContractNumbers((current) => ({ ...current, [selectedXmlFile.token]: event.target.value }))} placeholder="Ex.: contrato 123/2026" /></label>
                    <label>Observações desta nota (saem na cobrança)<textarea rows={3} maxLength={500} value={xmlBillingObservations[selectedXmlFile.token] ?? ""} onChange={(event) => setXmlBillingObservations((current) => ({ ...current, [selectedXmlFile.token]: event.target.value }))} placeholder="Ex.: lote, pedido ou referencia comercial" /></label>
                    <div className="note-options" role="group" aria-label="Itens desta nota que entram na cobranca">
                      <span className="note-options__title">O que esta nota tem</span>
                      <div className={`note-option${xmlFinancialServiceEnabled[selectedXmlFile.token] ? " is-on" : ""}`}>
                        <label className="note-option__head">
                          <input type="checkbox" checked={xmlFinancialServiceEnabled[selectedXmlFile.token] === true} onChange={(event) => {
                            setXmlJob(null);
                            setXmlFinancialServiceEnabled((current) => ({ ...current, [selectedXmlFile.token]: event.target.checked }));
                          }} />
                          <span><strong>Financeiro</strong><small>Usa o valor por saca "com financeiro" do cliente</small></span>
                        </label>
                      </div>
                      {([
                        { key: "freight", title: "DAE de frete", hint: "Valor do DAE de frete cobrado junto com a nota", enabled: xmlFreightDaeEnabled, setEnabled: setXmlFreightDaeEnabled, refs: xmlFreightDaeReferences, setRefs: setXmlFreightDaeReferences, amounts: xmlFreightDaeAmounts, setAmounts: setXmlFreightDaeAmounts },
                        { key: "invoice", title: "DAE da nota fiscal", hint: "Valor do DAE referente à nota, cobrado junto com ela", enabled: xmlInvoiceDaeEnabled, setEnabled: setXmlInvoiceDaeEnabled, refs: xmlInvoiceDaeReferences, setRefs: setXmlInvoiceDaeReferences, amounts: xmlInvoiceDaeAmounts, setAmounts: setXmlInvoiceDaeAmounts }
                      ] as const).map((option) => {
                        const token = selectedXmlFile.token;
                        const on = option.enabled[token] === true;
                        return <div key={option.key} className={`note-option${on ? " is-on" : ""}`}>
                          <label className="note-option__head">
                            <input type="checkbox" checked={on} onChange={(event) => {
                              const checked = event.target.checked;
                              setXmlJob(null);
                              option.setEnabled((current) => ({ ...current, [token]: checked }));
                              if (!checked) {
                                option.setRefs((current) => ({ ...current, [token]: "" }));
                                option.setAmounts((current) => ({ ...current, [token]: "" }));
                              }
                            }} />
                            <span><strong>{option.title}</strong><small>{option.hint}</small></span>
                          </label>
                          {on ? <div className="note-option__fields">
                            <label>Valor a cobrar (R$)<input value={option.amounts[token] ?? ""} onChange={(event) => { setXmlJob(null); option.setAmounts((current) => ({ ...current, [token]: event.target.value })); }} placeholder="R$ 0,00" /></label>
                            <label>Número do DAE (opcional)<input maxLength={120} value={option.refs[token] ?? ""} onChange={(event) => { setXmlJob(null); option.setRefs((current) => ({ ...current, [token]: event.target.value })); }} placeholder="Ex.: 12345" /></label>
                          </div> : null}
                        </div>;
                      })}
                    </div>
                  </div>
                ) : null}
              </>
            ) : selectedXmlFile?.status === "ERROR" ? (
              <EmptyState title="XML não lido" description={selectedXmlFile.errorMessage ?? "O arquivo selecionado não pode ser lido. Confira se ele não está vazio ou corrompido."} />
            ) : (
              <EmptyState title="Sem dados ainda" description="Selecione um arquivo na lista ao lado para ver os dados extraídos automaticamente." />
            )}
    </>
  );
}
