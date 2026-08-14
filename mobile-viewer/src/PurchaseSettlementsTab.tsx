import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { formatCurrencyBr, formatDateBr } from "./storage";
import { PageHeader } from "./renderer/design-system/components/PageHeader";
import { FilterBar } from "./renderer/design-system/components/FilterBar";
import { Card } from "./renderer/design-system/components/Card";
import { Button } from "./renderer/design-system/components/Button";
import { StatusBadge } from "./renderer/design-system/components/Badge";
import { EmptyState } from "./renderer/design-system/components/EmptyState";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { Alert } from "./renderer/design-system/components/Alert";
import type { AccountPayableRow, AccountPayableStatus } from "./types";

const PAGE_SIZE = 300;

const OPEN_STATUSES: AccountPayableStatus[] = ["DRAFT", "SCHEDULED", "OPEN", "PARTIALLY_PAID", "OVERDUE", "CONTESTED"];

type FilterMode = "OPEN" | "PAID" | "ALL";

const FILTER_LABELS: Record<FilterMode, string> = { OPEN: "Em aberto", PAID: "Pagos", ALL: "Todos" };

export function PurchaseSettlementsTab(): JSX.Element {
  const [payables, setPayables] = useState<AccountPayableRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("OPEN");

  useEffect(() => {
    void load();
  }, []);

  async function load(): Promise<void> {
    setError(null);
    const { data, error: loadError } = await supabase
      .from("accounts_payable")
      .select(
        `id, payee_name_snapshot, description, document_number, due_date, final_amount_cents, paid_amount_cents, open_amount_cents, status,
         supplier:business_partners(display_name)`
      )
      .order("due_date", { ascending: false })
      .limit(PAGE_SIZE);
    if (loadError) {
      setError(loadError.message);
      return;
    }
    setPayables((data ?? []) as unknown as AccountPayableRow[]);
  }

  const filtered = useMemo(() => {
    if (!payables) return [];
    const term = search.trim().toLowerCase();
    return payables.filter((payable) => {
      if (filter === "OPEN" && !OPEN_STATUSES.includes(payable.status)) return false;
      if (filter === "PAID" && payable.status !== "PAID") return false;
      if (term) {
        const haystack = `${payable.supplier?.display_name ?? ""} ${payable.payee_name_snapshot} ${payable.description}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [payables, search, filter]);

  return (
    <>
      <PageHeader eyebrow="Pagamentos" title="Acertos de entrada" description="Contas a pagar a fornecedores, geradas pelo PC principal." />
      {error ? <Alert tone="danger" title="Falha ao carregar acertos">{error}</Alert> : null}
      {!error && !payables ? <LoadingState label="Carregando acertos..." /> : null}
      {payables ? (
        <>
          <FilterBar
            activeCount={(filter !== "ALL" ? 1 : 0) + (search.trim() ? 1 : 0)}
            onClear={() => {
              setSearch("");
              setFilter("ALL");
            }}
          >
            <input type="search" className="ui-input" placeholder="Buscar fornecedor..." value={search} onChange={(event) => setSearch(event.target.value)} />
            <div className="viewer-chip-row">
              {(Object.keys(FILTER_LABELS) as FilterMode[]).map((mode) => (
                <Button key={mode} variant={filter === mode ? "primary" : "secondary"} onClick={() => setFilter(mode)}>
                  {FILTER_LABELS[mode]}
                </Button>
              ))}
            </div>
          </FilterBar>
          {filtered.length === 0 ? (
            <EmptyState title="Nenhum acerto encontrado" description="Ajuste a busca ou o filtro para ver outros resultados." />
          ) : (
            <div className="viewer-card-grid">
              {filtered.map((payable) => (
                <Card
                  key={payable.id}
                  title={payable.supplier?.display_name ?? payable.payee_name_snapshot}
                  actions={<StatusBadge status={payable.status} />}
                >
                  <p className="viewer-card-line">{payable.description}</p>
                  <p className="viewer-card-line">
                    Vencimento: {formatDateBr(payable.due_date)}
                    {payable.document_number ? ` · Doc. ${payable.document_number}` : ""}
                  </p>
                  <p className="viewer-card-line">
                    Total: {formatCurrencyBr(payable.final_amount_cents ?? 0)}
                    {(payable.open_amount_cents ?? 0) > 0 ? ` · Em aberto: ${formatCurrencyBr(payable.open_amount_cents ?? 0)}` : ""}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : null}
    </>
  );
}
