import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { useActiveContext } from "./activeContext";
import { formatCurrencyBr, formatDateBr } from "./storage";
import { PageHeader } from "./renderer/design-system/components/PageHeader";
import { FilterBar } from "./renderer/design-system/components/FilterBar";
import { Card } from "./renderer/design-system/components/Card";
import { Button } from "./renderer/design-system/components/Button";
import { StatusBadge } from "./renderer/design-system/components/Badge";
import { EmptyState } from "./renderer/design-system/components/EmptyState";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { Alert } from "./renderer/design-system/components/Alert";
import type { ClientLedgerEntryRow, LedgerEntryType } from "./types";

const PAGE_SIZE = 300;

const ENTRY_TYPE_LABELS: Record<LedgerEntryType, string> = {
  SERVICE_CHARGE: "Cobrança de serviço",
  ADVANCE_RECEIVED: "Adiantamento recebido",
  PAYMENT_RECEIVED: "Pagamento recebido",
  DISCOUNT: "Desconto",
  CREDIT: "Crédito",
  SURCHARGE: "Acréscimo",
  REIMBURSEMENT: "Reembolso",
  PREVIOUS_BALANCE: "Saldo anterior",
  MANUAL_ADJUSTMENT: "Ajuste manual",
  REVERSAL: "Estorno",
  OTHER: "Outro"
};

type FilterMode = "ALL" | "INCREASE_RECEIVABLE" | "REDUCE_RECEIVABLE";

const FILTER_LABELS: Record<FilterMode, string> = { ALL: "Todos", INCREASE_RECEIVABLE: "Aumentam saldo", REDUCE_RECEIVABLE: "Reduzem saldo" };

export function LedgerTab(): JSX.Element {
  const { legalEntityId } = useActiveContext();
  const [entries, setEntries] = useState<ClientLedgerEntryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("ALL");

  useEffect(() => {
    if (!legalEntityId) return;
    void load();
  }, [legalEntityId]);

  async function load(): Promise<void> {
    setError(null);
    const { data, error: loadError } = await supabase
      .from("client_ledger_entries")
      .select("id, entry_type, effect, amount_cents, entry_date, description, status, client:business_partners(display_name)")
      .eq("own_legal_entity_id", legalEntityId)
      .neq("status", "CANCELLED")
      .order("entry_date", { ascending: false })
      .limit(PAGE_SIZE);
    if (loadError) {
      setError(loadError.message);
      return;
    }
    setEntries((data ?? []) as unknown as ClientLedgerEntryRow[]);
  }

  const filtered = useMemo(() => {
    if (!entries) return [];
    const term = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (filter !== "ALL" && entry.effect !== filter) return false;
      if (term && !(entry.client?.display_name ?? "").toLowerCase().includes(term)) return false;
      return true;
    });
  }, [entries, search, filter]);

  return (
    <>
      <PageHeader eyebrow="Recebimentos" title="Conta-corrente" description="Lançamentos de conta-corrente dos clientes, gerados pelo PC principal." />
      {error ? <Alert tone="danger" title="Falha ao carregar conta-corrente">{error}</Alert> : null}
      {!error && !entries ? <LoadingState label="Carregando lançamentos..." /> : null}
      {entries ? (
        <>
          <FilterBar
            activeCount={(filter !== "ALL" ? 1 : 0) + (search.trim() ? 1 : 0)}
            onClear={() => {
              setSearch("");
              setFilter("ALL");
            }}
          >
            <input type="search" className="ui-input" placeholder="Buscar cliente..." value={search} onChange={(event) => setSearch(event.target.value)} />
            <div className="viewer-chip-row">
              {(Object.keys(FILTER_LABELS) as FilterMode[]).map((mode) => (
                <Button key={mode} variant={filter === mode ? "primary" : "secondary"} onClick={() => setFilter(mode)}>
                  {FILTER_LABELS[mode]}
                </Button>
              ))}
            </div>
          </FilterBar>
          {filtered.length === 0 ? (
            <EmptyState title="Nenhum lançamento encontrado" description="Ajuste a busca ou o filtro para ver outros resultados." />
          ) : (
            <div className="viewer-card-grid">
              {filtered.map((entry) => (
                <Card key={entry.id} title={entry.client?.display_name ?? "Cliente"} actions={<StatusBadge status={entry.status} />}>
                  <p className="viewer-card-line">{ENTRY_TYPE_LABELS[entry.entry_type] ?? entry.entry_type}</p>
                  <p className="viewer-card-line">
                    {entry.effect === "INCREASE_RECEIVABLE" ? "+ " : "− "}
                    {formatCurrencyBr(entry.amount_cents)} · {formatDateBr(entry.entry_date)}
                  </p>
                  <p className="viewer-card-line viewer-card-line--muted">{entry.description}</p>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : null}
    </>
  );
}
