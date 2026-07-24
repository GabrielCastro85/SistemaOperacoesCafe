import React, { useCallback, useEffect, useState } from "react";
import type { BootstrapData, BusinessPartner, BusinessPartnerLegalEntity, ClientLedgerEntry } from "../../../shared/types/domain";
import { formatCnpj, formatCurrencyFromCents, formatDateBr, parseCurrencyToCents } from "../../../shared/utils/format";
import { BuildingIcon, EmptyState, PageHeader } from "../../design-system";
import { Feedback } from "../../components/feedback/Feedback";
import { TextField } from "../../components/forms/LegacyFields";
import { PartnerQuickSearch } from "../../components/forms/PartnerQuickSearch";
import { AdminBlock, FormGrid } from "../../components/layout/SectionPrimitives";
import { ClientLedgerTable } from "./components/ClientLedgerTable";

export function ClientLedgerPage({ data }: { data: BootstrapData }): JSX.Element {
  const organizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "";
  const ownLegalEntityId = data.profile?.defaultLegalEntityId ?? data.legalEntities.find((item) => item.organizationId === organizationId)?.id ?? "";
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [clientId, setClientId] = useState("");
  const [partnerLegalEntities, setPartnerLegalEntities] = useState<BusinessPartnerLegalEntity[]>([]);
  const [clientLegalEntities, setClientLegalEntities] = useState<BusinessPartnerLegalEntity[]>([]);
  const [showClientDetails, setShowClientDetails] = useState(false);
  const [entries, setEntries] = useState<ClientLedgerEntry[]>([]);
  const [amount, setAmount] = useState("5000,00");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const clients = await window.operationsCafe.listBusinessPartners({ role: "CLIENT", status: "active" });
    setPartners(clients);
    setPartnerLegalEntities((await Promise.all(clients.map((partner) => window.operationsCafe.listPartnerLegalEntities(partner.id)))).flat());
    const selected = clientId || clients[0]?.id || "";
    setClientId(selected);
    if (selected) {
      setEntries(await window.operationsCafe.listLedgerEntries({ organizationId, ownLegalEntityId, clientPartnerId: selected }));
      setClientLegalEntities(await window.operationsCafe.listPartnerLegalEntities(selected));
    }
  }, [organizationId, ownLegalEntityId, clientId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setShowClientDetails(false); }, [clientId]);

  async function createAdvance(): Promise<void> {
    const amountCents = parseCurrencyToCents(amount);
    await window.operationsCafe.createAdvance({ organizationId, ownLegalEntityId, clientPartnerId: clientId, clientChargeId: null, entryType: "ADVANCE_RECEIVED", effect: "REDUCE_RECEIVABLE", amountCents, entryDate: new Date().toISOString().slice(0, 10), description: "Adiantamento recebido", referenceNumber: null, notes: null, attachmentPath: null, availableAmountCents: amountCents });
    setMessage("Adiantamento registrado.");
    await load();
  }

  const client = partners.find((item) => item.id === clientId) ?? null;
  const primaryLegalEntity = clientLegalEntities.find((item) => item.isPrimary) ?? clientLegalEntities[0] ?? null;

  const sumByType = (type: ClientLedgerEntry["entryType"]) => entries.filter((entry) => entry.status === "CONFIRMED" && entry.entryType === type).reduce((sum, entry) => sum + entry.amountCents, 0);
  const totalServiceCents = sumByType("SERVICE_CHARGE");
  const advanceCents = sumByType("ADVANCE_RECEIVED");
  const creditCents = sumByType("CREDIT");
  const paymentCents = sumByType("PAYMENT_RECEIVED");
  const balanceCents = entries.filter((entry) => entry.status === "CONFIRMED").reduce((sum, entry) => sum + (entry.effect === "INCREASE_RECEIVABLE" ? entry.amountCents : -entry.amountCents), 0);

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

      <AdminBlock title="Resumo da conta-corrente">
        <div className="ledger-summary-row">
          <article><span>Total dos servicos</span><strong>{formatCurrencyFromCents(totalServiceCents)}</strong></article>
          <span className="ledger-summary-row__op">-</span>
          <article><span>Adiantamentos</span><strong>{formatCurrencyFromCents(advanceCents)}</strong></article>
          <span className="ledger-summary-row__op">-</span>
          <article><span>Creditos</span><strong>{formatCurrencyFromCents(creditCents)}</strong></article>
          <span className="ledger-summary-row__op">-</span>
          <article><span>Pagamentos recebidos</span><strong>{formatCurrencyFromCents(paymentCents)}</strong></article>
          <span className="ledger-summary-row__op">=</span>
          <article className="ledger-summary-row__final"><span>Saldo a receber</span><strong>{formatCurrencyFromCents(balanceCents)}</strong></article>
        </div>
      </AdminBlock>

      <AdminBlock title="Lancamentos extras">
        <FormGrid>
          <TextField label="Valor (R$)" value={amount} onChange={setAmount} />
          <button className="primary" onClick={() => void createAdvance()}>Registrar adiantamento</button>
        </FormGrid>
      </AdminBlock>

      <AdminBlock title="Historico de lancamentos">
        {entries.length ? <ClientLedgerTable entries={entries} /> : <EmptyState title="Nenhum lancamento" description="Este cliente ainda nao possui movimentos na conta-corrente." />}
      </AdminBlock>
      <Feedback message={message} />
    </section>
  );
}
