import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson, queryString } from "./api";
import { formatCurrencyBr, formatDateBr } from "./viewerFormat";
import { PageHeader } from "./renderer/design-system/components/PageHeader";
import { FilterBar } from "./renderer/design-system/components/FilterBar";
import { Card } from "./renderer/design-system/components/Card";
import { StatusBadge } from "./renderer/design-system/components/Badge";
import { EmptyState } from "./renderer/design-system/components/EmptyState";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { Alert } from "./renderer/design-system/components/Alert";

interface ReconciliationRow {
  id: string;
  clientName: string;
  counterpartyRole: "CLIENT" | "SUPPLIER";
  sourceMode: "INVOICES" | "MANUAL";
  referenceDate: string;
  title: string | null;
  notes: string | null;
  status: string;
  totalSourceCents: number;
  totalPaymentsCents: number;
  balanceCents: number;
  invoiceCount: number;
  paymentCount: number;
}

export function TransferReconciliationsTab({ organizationId, legalEntityId }: { organizationId: string; legalEntityId?: string }): JSX.Element {
  const [rows, setRows] = useState<ReconciliationRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setRows(null);
    setError(null);
    try {
      setRows(await apiJson<ReconciliationRow[]>(`/v1/viewer/transfer-reconciliations?${queryString({ organizationId, legalEntityId })}`));
    } catch (value) {
      setError(value instanceof Error ? value.message : "Falha ao carregar repasses.");
    }
  }, [organizationId, legalEntityId]);
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (rows ?? []).filter((row) => !term || `${row.clientName} ${row.title ?? ""} ${row.status}`.toLowerCase().includes(term));
  }, [rows, search]);
  return <>
    <PageHeader eyebrow="Recebimentos" title="Conferência de repasses" description="Conferências de notas e pagamentos registradas no sistema, sem alterar cobranças ou o financeiro." />
    {error ? <Alert tone="danger" title="Falha ao carregar repasses">{error}</Alert> : null}
    {!error && !rows ? <LoadingState label="Carregando conferências..." /> : null}
    {rows ? <>
      <FilterBar activeCount={search.trim() ? 1 : 0} onClear={() => setSearch("")}>
        <input className="ui-input" type="search" placeholder="Buscar cliente, fornecedor ou título..." value={search} onChange={(event) => setSearch(event.target.value)} />
      </FilterBar>
      {filtered.length === 0 ? <EmptyState title="Nenhuma conferência encontrada" description="Ajuste a busca ou crie a conferência pelo aplicativo." /> :
        <div className="viewer-card-grid">{filtered.map((row) => <Card key={row.id} title={row.clientName} actions={<StatusBadge status={row.status} />}>
          <p className="viewer-card-line">{row.counterpartyRole === "SUPPLIER" ? "Fornecedor" : "Cliente"} · {formatDateBr(row.referenceDate)}</p>
          {row.title ? <p className="viewer-card-line">{row.title}</p> : null}
          <p className="viewer-card-line">Origem: {row.sourceMode === "MANUAL" ? "Valor informado" : `${row.invoiceCount} nota(s)`} · {row.paymentCount} pagamento(s)</p>
          <p className="viewer-card-line">Valor: {formatCurrencyBr(row.totalSourceCents)} · Pago: {formatCurrencyBr(row.totalPaymentsCents)}</p>
          <p className="viewer-card-line"><strong>Saldo: {formatCurrencyBr(row.balanceCents)}</strong></p>
        </Card>)}</div>}
    </> : null}
  </>;
}
