import type { BusinessPartner, BusinessPartnerLegalEntity, FiscalDocument, BootstrapData } from "../../../../shared/types/domain";
import { formatCurrencyFromCents } from "../../../../shared/utils/format";
import { DateInput } from "../../../design-system";
import { SelectField, TextField } from "../../../components/forms/LegacyFields";
import { PartnerQuickSearch } from "../../../components/forms/PartnerQuickSearch";
import { FormGrid } from "../../../components/layout/SectionPrimitives";
import { formatCnpjCompact } from "../operationsFormatters";
import type { useManualFiscalDocumentForm } from "../hooks/useManualFiscalDocumentForm";

// Formulario de lancamento manual de nota (parte de cima da aba). O estado vem do
// hook useManualFiscalDocumentForm; a lista de notas continua na pagina.
export function ManualFiscalDocumentForm({ form, documents, ownLegalEntity, partners, secondaryPartners, partnerLegalEntities, visibleServiceCents, onCreate }: {
  form: ReturnType<typeof useManualFiscalDocumentForm>;
  documents: FiscalDocument[];
  ownLegalEntity: BootstrapData["legalEntities"][number] | null;
  partners: BusinessPartner[];
  secondaryPartners: BusinessPartner[];
  partnerLegalEntities: BusinessPartnerLegalEntity[];
  visibleServiceCents: number;
  onCreate: () => void;
}): JSX.Element {
  const { partnerId, setPartnerId, number, setNumber, contractNumber, setContractNumber, accessKey, setAccessKey, total, setTotal, issueDate, setIssueDate, operationType, setOperationType, billingObservations, setBillingObservations, manualIssuerSearchTerm, setManualIssuerSearchTerm, manualIssuerPartnerLegalEntityId, setManualIssuerPartnerLegalEntityId, manualCounterpartyLegalEntityId, setManualCounterpartyLegalEntityId, manualSecondaryPartnerId, setManualSecondaryPartnerId } = form;
  return (
    <>
        <div className="notes-flow-intro">
          <div>
            <span className="notes-flow-intro__eyebrow">Alternativa ao XML</span>
            <strong>Use este formulario somente quando a nota nao estiver disponivel na busca automatica.</strong>
            <details className="notes-flow-intro__details"><summary>Como preencher</summary><small>Primeiro escolha se e compra ou venda, depois o responsavel e o CNPJ exato que aparece na NF-e.</small></details>
          </div>
        </div>
        <div className="operation-context-note">
          <span>CNPJ ativo para notas</span>
          <strong>{ownLegalEntity ? (ownLegalEntity.legalName || ownLegalEntity.tradeName) : "Nao selecionado"}</strong>
          <small>{ownLegalEntity?.cnpj ?? "CNPJ pendente"} - a lista abaixo mostra somente notas desse CNPJ.</small>
        </div>
        <div className="operation-context-note">
          <span>Empresa emissora (opcional)</span>
          <strong>{manualIssuerPartnerLegalEntityId ? (() => { const selected = partnerLegalEntities.find((entity) => entity.id === manualIssuerPartnerLegalEntityId); return selected ? (selected.legalName || selected.tradeName) : "Selecionada"; })() : "Nenhuma -- emissora e' o CNPJ proprio ativo acima"}</strong>
          {manualIssuerPartnerLegalEntityId ? (
            <small>Nota triangulada: nem emitente nem destinatario e' sua empresa. Informe abaixo o fornecedor (emissor) e o cliente da revenda -- cada item lancado ja cria as duas operacoes (compra e venda) automaticamente.</small>
          ) : (
            <small>Deixe vazio se a nota foi emitida pela sua propria empresa. Escolha outra empresa aqui quando a nota e' de terceiro (nem emitente nem destinatario e' sua empresa).</small>
          )}
          {manualIssuerPartnerLegalEntityId ? (
            <button type="button" onClick={() => { setManualIssuerPartnerLegalEntityId(null); setManualIssuerSearchTerm(""); setManualSecondaryPartnerId(""); }}>Remover empresa emissora</button>
          ) : (
            <>
              <TextField label="Buscar empresa emissora por nome ou CNPJ" value={manualIssuerSearchTerm} onChange={setManualIssuerSearchTerm} />
              {manualIssuerSearchTerm.trim() ? (
                <div className="confirmation-company-results">
                  {partnerLegalEntities
                    .filter((entity) => {
                      const term = manualIssuerSearchTerm.trim().toUpperCase();
                      const digitsTerm = term.replace(/\D/g, "");
                      return entity.tradeName.toUpperCase().includes(term) || entity.legalName.toUpperCase().includes(term) || (digitsTerm.length > 0 && (entity.cnpj?.includes(digitsTerm) ?? false));
                    })
                    .slice(0, 8)
                    .map((entity) => (
                      <div key={entity.id} className="confirmation-company-result-row">
                        <button type="button" className="partner-action-button" onClick={() => { setManualIssuerPartnerLegalEntityId(entity.id); setManualIssuerSearchTerm(""); setOperationType("PURCHASE"); }}>{entity.legalName || entity.tradeName} — {entity.cnpj ?? "CNPJ nao informado"}</button>
                      </div>
                    ))}
                </div>
              ) : null}
            </>
          )}
        </div>
        <div className="cards">
          <article><span>Notas deste CNPJ</span><strong>{documents.length}</strong></article>
          <article><span>Pendencias</span><strong>{documents.filter((doc) => doc.status === "PENDING" || doc.hasPendingIssues).length}</strong></article>
          <article><span>Servico calculado</span><strong>{formatCurrencyFromCents(visibleServiceCents)}</strong></article>
        </div>
        <FormGrid>
          {manualIssuerPartnerLegalEntityId ? (
            <>
              <PartnerQuickSearch label="Fornecedor (emissor)" value={partnerId} onChange={setPartnerId} partners={partners} legalEntities={partnerLegalEntities} />
              <PartnerQuickSearch label="Cliente (revenda)" value={manualSecondaryPartnerId} onChange={setManualSecondaryPartnerId} partners={secondaryPartners} legalEntities={partnerLegalEntities} />
            </>
          ) : (
            <>
              <SelectField label="Tipo da nota" value={operationType} onChange={(value) => { setOperationType(value as "PURCHASE" | "SALE"); setPartnerId(""); setManualCounterpartyLegalEntityId(""); }} options={[["PURCHASE", "Nota recebida (compra/entrada)"], ["SALE", "Nota emitida (venda/saida)"]]} />
              <PartnerQuickSearch label={operationType === "PURCHASE" ? "Fornecedor" : "Cliente/corretor"} value={partnerId} onChange={(value) => { setPartnerId(value); setManualCounterpartyLegalEntityId(""); }} partners={partners} legalEntities={partnerLegalEntities} />
              <SelectField
                label={operationType === "PURCHASE" ? "CNPJ emissor da nota" : "CNPJ destinatario da nota"}
                value={manualCounterpartyLegalEntityId}
                onChange={setManualCounterpartyLegalEntityId}
                options={[
                  ["", partnerId ? "Selecione o CNPJ exato" : "Escolha primeiro o responsavel"],
                  ...partnerLegalEntities
                    .filter((entity) => entity.businessPartnerId === partnerId && entity.isActive)
                    .map((entity) => [entity.id, `${entity.legalName || entity.tradeName} — ${formatCnpjCompact(entity.cnpj)}`] as [string, string])
                ]}
              />
            </>
          )}
          <TextField label="Numero da nota" value={number} onChange={setNumber} />
          <TextField label="Contrato" value={contractNumber} onChange={setContractNumber} />
          <label>Observacoes da nota (sai na cobranca)<textarea rows={3} maxLength={500} value={billingObservations} onChange={(event) => setBillingObservations(event.target.value)} placeholder="Ex.: lote 123, contrato ABC, referencia do pedido" /></label>
          <TextField label="Chave de acesso" value={accessKey} onChange={setAccessKey} />
          <DateInput label="Data de emissão" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
          <TextField label="Valor total" value={total} onChange={setTotal} />
          <button
            className="primary"
            disabled={manualIssuerPartnerLegalEntityId
              ? (!partnerId || !manualSecondaryPartnerId || partnerId === manualSecondaryPartnerId)
              : (!partnerId || !manualCounterpartyLegalEntityId)}
            onClick={() => void onCreate()}
          >
            Criar nota
          </button>
        </FormGrid>
        {manualIssuerPartnerLegalEntityId && partnerId && manualSecondaryPartnerId && partnerId === manualSecondaryPartnerId ? (
          <p className="feedback" role="status" aria-live="polite">Fornecedor e cliente da nota triangulada precisam ser parceiros diferentes.</p>
        ) : null}
    </>
  );
}
