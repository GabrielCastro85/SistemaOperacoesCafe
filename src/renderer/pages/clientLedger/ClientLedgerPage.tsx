import React, { useCallback, useEffect, useState } from "react";
import type { BootstrapData, BusinessPartner, BusinessPartnerLegalEntity, ClientLedgerEntry, Operation } from "../../../shared/types/domain";
import { formatCnpj, formatCurrencyFromCents, formatDateBr, parseCurrencyToCents } from "../../../shared/utils/format";
import { BuildingIcon, DateInput, EmptyState, FilterBar, PageHeader } from "../../design-system";
import { Feedback } from "../../components/feedback/Feedback";
import { SelectField, TextField } from "../../components/forms/LegacyFields";
import { PartnerQuickSearch } from "../../components/forms/PartnerQuickSearch";
import { AdminBlock, FormGrid } from "../../components/layout/SectionPrimitives";
import { ClientLedgerTable } from "./components/ClientLedgerTable";

function localDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentMonthToDateRange(): { periodStart: string; periodEnd: string } {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return { periodStart: localDateInputValue(start), periodEnd: localDateInputValue(today) };
}

export function ClientLedgerPage({ data }: { data: BootstrapData }): JSX.Element {
  const organizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "";
  const ownLegalEntityId = data.profile?.defaultLegalEntityId ?? data.legalEntities.find((item) => item.organizationId === organizationId)?.id ?? "";
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [clientId, setClientId] = useState("");
  const [partnerLegalEntities, setPartnerLegalEntities] = useState<BusinessPartnerLegalEntity[]>([]);
  const [clientLegalEntities, setClientLegalEntities] = useState<BusinessPartnerLegalEntity[]>([]);
  const [showClientDetails, setShowClientDetails] = useState(false);
  const [entries, setEntries] = useState<ClientLedgerEntry[]>([]);
  const [confirmedOperations, setConfirmedOperations] = useState<Operation[]>([]);
  const [amount, setAmount] = useState("5000,00");
  const [entryDate, setEntryDate] = useState(() => localDateInputValue(new Date()));
  const [applyNow, setApplyNow] = useState(true);
  const [movementKind, setMovementKind] = useState<"ADIANTAMENTO" | "ACRESCIMO" | "EMPRESTIMO">("ADIANTAMENTO");
  const [periodStart, setPeriodStart] = useState(() => currentMonthToDateRange().periodStart);
  const [periodEnd, setPeriodEnd] = useState(() => currentMonthToDateRange().periodEnd);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const clients = await window.operationsCafe.listBusinessPartners({ role: "CLIENT", status: "active" });
    setPartners(clients);
    // Empresas/CNPJs sem cliente/corretor dono nao aparecem percorrendo os
    // parceiros -- precisa buscar as soltas separadamente e juntar (ver
    // mesmo padrao em PartnersPage/OperationsPage/ChargesPage).
    const [linkedLegalEntities, unlinkedLegalEntities] = await Promise.all([
      Promise.all(clients.map((partner) => window.operationsCafe.listPartnerLegalEntities(partner.id))),
      organizationId ? window.operationsCafe.listUnlinkedPartnerLegalEntities(organizationId) : Promise.resolve([])
    ]);
    setPartnerLegalEntities([...linkedLegalEntities.flat(), ...unlinkedLegalEntities]);
    const selected = clientId;
    if (selected) {
      setEntries(await window.operationsCafe.listLedgerEntries({ organizationId, ownLegalEntityId, clientPartnerId: selected, periodStart: periodStart || null, periodEnd: periodEnd || null }));
      // Notas confirmadas ainda sem cobranca emitida tambem entram no total --
      // o dono quer ver o que o cliente deve desde o lancamento da nota, nao
      // so' depois que a cobranca formal for gerada.
      setConfirmedOperations(await window.operationsCafe.listOperations({ organizationId, ownLegalEntityId, responsiblePartnerId: selected, status: "CONFIRMED", periodStart: periodStart || undefined, periodEnd: periodEnd || undefined }));
      setClientLegalEntities(await window.operationsCafe.listPartnerLegalEntities(selected));
    } else {
      setEntries([]);
      setConfirmedOperations([]);
    }
  }, [organizationId, ownLegalEntityId, clientId, periodStart, periodEnd]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setShowClientDetails(false); }, [clientId]);

  const MOVEMENT_KIND_CONFIG: Record<typeof movementKind, { entryType: "ADVANCE_RECEIVED" | "SURCHARGE" | "MANUAL_ADJUSTMENT"; effect: "REDUCE_RECEIVABLE" | "INCREASE_RECEIVABLE"; description: string; actionLabel: string; confirmedMessage: string; draftMessage: string }> = {
    ADIANTAMENTO: { entryType: "ADVANCE_RECEIVED", effect: "REDUCE_RECEIVABLE", description: "Adiantamento recebido", actionLabel: "Registrar adiantamento", confirmedMessage: "Adiantamento registrado e ja abatido do saldo.", draftMessage: "Adiantamento registrado, mas ainda nao abate do saldo (confirme depois quando quiser aplicar)." },
    ACRESCIMO: { entryType: "SURCHARGE", effect: "INCREASE_RECEIVABLE", description: "Acrescimo", actionLabel: "Registrar acrescimo", confirmedMessage: "Acrescimo registrado e ja somado ao saldo.", draftMessage: "Acrescimo registrado, mas ainda nao soma no saldo (confirme depois quando quiser aplicar)." },
    EMPRESTIMO: { entryType: "MANUAL_ADJUSTMENT", effect: "INCREASE_RECEIVABLE", description: "Emprestimo", actionLabel: "Registrar emprestimo", confirmedMessage: "Emprestimo registrado e ja somado ao saldo.", draftMessage: "Emprestimo registrado, mas ainda nao soma no saldo (confirme depois quando quiser aplicar)." }
  };

  async function createLedgerMovement(): Promise<void> {
    const amountCents = parseCurrencyToCents(amount);
    const config = MOVEMENT_KIND_CONFIG[movementKind];
    await window.operationsCafe.createLedgerEntry({ organizationId, ownLegalEntityId, clientPartnerId: clientId, clientChargeId: null, entryType: config.entryType, effect: config.effect, amountCents, entryDate, description: config.description, referenceNumber: null, notes: null, attachmentPath: null, availableAmountCents: amountCents, status: applyNow ? "CONFIRMED" : "DRAFT" });
    setMessage(applyNow ? config.confirmedMessage : config.draftMessage);
    setEntryDate(localDateInputValue(new Date()));
    await load();
  }

  const client = partners.find((item) => item.id === clientId) ?? null;
  const primaryLegalEntity = clientLegalEntities.find((item) => item.isPrimary) ?? clientLegalEntities[0] ?? null;

  const sumByType = (type: ClientLedgerEntry["entryType"]) => entries.filter((entry) => entry.status === "CONFIRMED" && entry.entryType === type).reduce((sum, entry) => sum + entry.amountCents, 0);
  // Servico ja lancado (nota confirmada) mas ainda sem cobranca formal emitida
  // -- billingStatus so' vira 'BILLED' quando a cobranca e' emitida, entao
  // qualquer coisa antes disso (UNBILLED ou RESERVED num rascunho) ainda nao
  // tem lancamento SERVICE_CHARGE na conta-corrente. Somamos aqui pra nao
  // esperar a cobranca existir pra aparecer o que o cliente deve.
  const liveUnbilledServiceCents = confirmedOperations
    .filter((operation) => operation.operationType !== "PURCHASE" && operation.billingStatus !== "BILLED")
    .reduce((sum, operation) => sum + operation.serviceAmountCents, 0);
  const totalServiceCents = sumByType("SERVICE_CHARGE") + liveUnbilledServiceCents;
  const advanceCents = sumByType("ADVANCE_RECEIVED");
  const creditCents = sumByType("CREDIT");
  const paymentCents = sumByType("PAYMENT_RECEIVED");
  const surchargeCents = sumByType("SURCHARGE") + sumByType("MANUAL_ADJUSTMENT");
  const balanceCents = entries.filter((entry) => entry.status === "CONFIRMED").reduce((sum, entry) => sum + (entry.effect === "INCREASE_RECEIVABLE" ? entry.amountCents : -entry.amountCents), 0) + liveUnbilledServiceCents;

  return (
    <section className="content-section settings">
      <PageHeader eyebrow="Conta-corrente" title="Conta-corrente do cliente" description="Adiantamentos, creditos, pagamentos e saldo do cliente selecionado." />

      <AdminBlock title="Cliente">
        <FormGrid>
          <PartnerQuickSearch label="Cliente" value={clientId} onChange={setClientId} partners={partners} legalEntities={partnerLegalEntities} />
        </FormGrid>
        {client ? (
          <div className="client-header-card">
            <span className="client-header-card__icon"><BuildingIcon /></span>
            <div className="client-header-card__info">
              <strong>{client.displayName}</strong>
              <span className="muted">Cliente desde {formatDateBr(client.createdAt)}{primaryLegalEntity?.cnpj ? ` - CNPJ ${formatCnpj(primaryLegalEntity.cnpj)}` : ""}</span>
            </div>
            <button onClick={() => setShowClientDetails((current) => !current)}>{showClientDetails ? "Ocultar dados" : "Ver dados do cliente"}</button>
          </div>
        ) : null}
        {showClientDetails && primaryLegalEntity ? (
          <dl className="kv-list">
            <div><dt>Razao social</dt><dd>{primaryLegalEntity.legalName}</dd></div>
            <div><dt>Cidade/UF</dt><dd>{primaryLegalEntity.city ?? "-"}/{primaryLegalEntity.state ?? "-"}</dd></div>
            <div><dt>E-mail</dt><dd>{primaryLegalEntity.email ?? "-"}</dd></div>
            <div><dt>Telefone</dt><dd>{primaryLegalEntity.phone ?? "-"}</dd></div>
          </dl>
        ) : null}
      </AdminBlock>

      <FilterBar activeCount={[periodStart, periodEnd].filter(Boolean).length} onClear={() => { const defaults = currentMonthToDateRange(); setPeriodStart(defaults.periodStart); setPeriodEnd(defaults.periodEnd); }}>
        <DateInput label="Periodo - inicio" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
        <DateInput label="Periodo - fim" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
      </FilterBar>

      <AdminBlock title="Resumo da conta-corrente">
        <div className="ledger-summary-row">
          <article><span>Total dos servicos</span><strong>{formatCurrencyFromCents(totalServiceCents)}</strong></article>
          <span className="ledger-summary-row__op">+</span>
          <article><span>Acrescimos/Emprestimos</span><strong>{formatCurrencyFromCents(surchargeCents)}</strong></article>
          <span className="ledger-summary-row__op">-</span>
          <article><span>Adiantamentos</span><strong>{formatCurrencyFromCents(advanceCents)}</strong></article>
          <span className="ledger-summary-row__op">-</span>
          <article><span>Creditos</span><strong>{formatCurrencyFromCents(creditCents)}</strong></article>
          <span className="ledger-summary-row__op">-</span>
          <article><span>Pagamentos recebidos</span><strong>{formatCurrencyFromCents(paymentCents)}</strong></article>
          <span className="ledger-summary-row__op">=</span>
          <article className="ledger-summary-row__final"><span>Saldo a receber</span><strong>{formatCurrencyFromCents(balanceCents)}</strong></article>
        </div>
        {liveUnbilledServiceCents > 0 ? <p className="muted">Inclui {formatCurrencyFromCents(liveUnbilledServiceCents)} de notas ja confirmadas mas ainda sem cobranca emitida.</p> : null}
      </AdminBlock>

      <AdminBlock title="Lancamentos extras">
        <FormGrid>
          <SelectField
            label="Tipo de lancamento"
            value={movementKind}
            onChange={(value) => setMovementKind(value as typeof movementKind)}
            options={[
              ["ADIANTAMENTO", "Adiantamento (abate o saldo)"],
              ["ACRESCIMO", "Acrescimo (soma no saldo)"],
              ["EMPRESTIMO", "Emprestimo (soma no saldo)"]
            ]}
          />
          <TextField label="Valor (R$)" value={amount} onChange={setAmount} />
          <DateInput label="Data do lancamento" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} />
          <label className="checkbox">
            <input type="checkbox" checked={applyNow} onChange={(event) => setApplyNow(event.target.checked)} /> Ja abater/somar no saldo agora
          </label>
          <button className="primary" onClick={() => void createLedgerMovement()}>{MOVEMENT_KIND_CONFIG[movementKind].actionLabel}</button>
        </FormGrid>
        {!applyNow ? <p className="muted">Sem marcar, o lancamento fica registrado no historico mas nao entra no saldo ate ser confirmado.</p> : null}
        {movementKind !== "ADIANTAMENTO" ? <p className="muted">Acrescimos e emprestimos aumentam o quanto o cliente deve -- quando houver uma cobranca em aberto para ele, esse valor aparece automaticamente em "Acrescimos" na tela de Cobrancas.</p> : null}
      </AdminBlock>

      <AdminBlock title="Historico de lancamentos">
        {entries.length ? <ClientLedgerTable entries={entries} /> : <EmptyState title="Nenhum lancamento" description="Este cliente ainda nao possui movimentos na conta-corrente no periodo selecionado." />}
      </AdminBlock>
      <Feedback message={message} />
    </section>
  );
}
