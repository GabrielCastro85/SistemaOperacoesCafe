import React, { useCallback, useEffect, useState } from "react";
import type { BootstrapData, BusinessPartner, ClientLedgerEntry } from "../../../shared/types/domain";
import { formatCurrencyFromCents } from "../../../shared/utils/format";
import { PageHeader } from "../../design-system";
import { Feedback } from "../../components/feedback/Feedback";
import { SelectField, TextField } from "../../components/forms/LegacyFields";
import { AdminBlock, FormGrid } from "../../components/layout/SectionPrimitives";
export function ClientLedgerPage({ data }: { data: BootstrapData }): JSX.Element {
  const organizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "";
  const ownLegalEntityId = data.profile?.defaultLegalEntityId ?? data.legalEntities.find((item) => item.organizationId === organizationId)?.id ?? "";
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [clientId, setClientId] = useState("");
  const [entries, setEntries] = useState<ClientLedgerEntry[]>([]);
  const [amount, setAmount] = useState("500000");
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(async () => {
    const clients = await window.operationsCafe.listBusinessPartners({ organizationId, role: "CLIENT", status: "active" });
    setPartners(clients);
    const selected = clientId || clients[0]?.id || "";
    setClientId(selected);
    if (selected) setEntries(await window.operationsCafe.listLedgerEntries({ organizationId, ownLegalEntityId, clientPartnerId: selected }));
  }, [organizationId, ownLegalEntityId, clientId]);
  useEffect(() => { void load(); }, [load]);
  async function createAdvance(): Promise<void> {
    await window.operationsCafe.createAdvance({ organizationId, ownLegalEntityId, clientPartnerId: clientId, clientChargeId: null, entryType: "ADVANCE_RECEIVED", effect: "REDUCE_RECEIVABLE", amountCents: Number(amount), entryDate: new Date().toISOString().slice(0, 10), description: "Adiantamento recebido", referenceNumber: null, notes: null, attachmentPath: null, availableAmountCents: Number(amount) });
    setMessage("Adiantamento registrado.");
    await load();
  }
  return (
    <section className="content-section settings">
      <PageHeader eyebrow="Conta-corrente" title="Conta-corrente do cliente" description="Acompanhe saldos, adiantamentos e movimentos financeiros relacionados ao cliente selecionado." />
      <AdminBlock title="Conta-corrente do cliente">
        <FormGrid>
          <SelectField label="Cliente" value={clientId} onChange={setClientId} options={partners.map((item) => [item.id, item.displayName])} />
          <TextField label="Valor em centavos" value={amount} onChange={setAmount} />
          <button className="primary" onClick={() => void createAdvance()}>Registrar adiantamento</button>
        </FormGrid>
        <div className="table"><div className="table-head ledger-grid"><span>Data</span><span>Tipo</span><span>Descricao</span><span>Efeito</span><span>Valor</span><span>Disponivel</span><span>Status</span></div>{entries.map((entry) => <div key={entry.id} className="table-row ledger-grid"><span>{entry.entryDate}</span><span>{entry.entryType}</span><span>{entry.description}</span><span>{entry.effect}</span><span>{formatCurrencyFromCents(entry.amountCents)}</span><span>{formatCurrencyFromCents(entry.availableAmountCents ?? 0)}</span><span>{entry.status}</span></div>)}</div>
      </AdminBlock>
      <Feedback message={message} />
    </section>
  );
}


