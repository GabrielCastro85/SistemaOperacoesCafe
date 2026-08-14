import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { formatCurrencyBr, formatDateBr, openStorageFile } from "./storage";
import { PageHeader } from "./renderer/design-system/components/PageHeader";
import { FilterBar } from "./renderer/design-system/components/FilterBar";
import { Card } from "./renderer/design-system/components/Card";
import { Button } from "./renderer/design-system/components/Button";
import { StatusBadge } from "./renderer/design-system/components/Badge";
import { EmptyState } from "./renderer/design-system/components/EmptyState";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { Alert } from "./renderer/design-system/components/Alert";
import type { ClientCharge, ClientChargeStatus, PendingBillingGroup, UnbilledOperationRow } from "./types";

const OPEN_STATUSES: ClientChargeStatus[] = ["DRAFT", "PENDING_REVIEW", "ISSUED", "PARTIALLY_PAID", "OVERDUE"];
const PAGE_SIZE = 200;
const UNBILLED_LIMIT = 3000;

type FilterMode = "OPEN" | "PAID" | "ALL";

const FILTER_LABELS: Record<FilterMode, string> = { OPEN: "Em aberto", PAID: "Pagas", ALL: "Todas" };

function groupUnbilledOperations(rows: UnbilledOperationRow[]): PendingBillingGroup[] {
  const groups = new Map<string, PendingBillingGroup>();
  for (const row of rows) {
    const clientName = row.responsible_partner?.display_name ?? "Cliente não identificado";
    const legalEntityName = row.own_legal_entity?.trade_name ?? "";
    const key = `${clientName}__${legalEntityName}`;
    const existing = groups.get(key);
    const sacks = Number(row.quantity_sacks) || 0;
    if (existing) {
      existing.operationCount += 1;
      existing.amountCents += row.service_amount_cents ?? 0;
      existing.sacks += sacks;
      if (row.operation_date < existing.periodStart) existing.periodStart = row.operation_date;
      if (row.operation_date > existing.periodEnd) existing.periodEnd = row.operation_date;
    } else {
      groups.set(key, {
        key,
        clientName,
        legalEntityName,
        operationCount: 1,
        amountCents: row.service_amount_cents ?? 0,
        sacks,
        periodStart: row.operation_date,
        periodEnd: row.operation_date
      });
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.amountCents - a.amountCents);
}

export function ChargesTab(): JSX.Element {
  const [charges, setCharges] = useState<ClientCharge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("OPEN");
  const [pendingGroups, setPendingGroups] = useState<PendingBillingGroup[] | null>(null);
  const [pendingError, setPendingError] = useState<string | null>(null);

  useEffect(() => {
    void load(0);
    void loadPendingBilling();
  }, []);

  async function loadPendingBilling(): Promise<void> {
    setPendingError(null);
    const { data, error: loadError } = await supabase
      .from("operations")
      .select(
        `id, operation_date, service_amount_cents, quantity_sacks,
         responsible_partner:business_partners(display_name),
         own_legal_entity:legal_entities(trade_name)`
      )
      .eq("billing_status", "UNBILLED")
      .order("operation_date")
      .limit(UNBILLED_LIMIT);
    if (loadError) {
      setPendingError(loadError.message);
      return;
    }
    setPendingGroups(groupUnbilledOperations((data ?? []) as unknown as UnbilledOperationRow[]));
  }

  async function load(offset: number): Promise<void> {
    setError(null);
    if (offset === 0) setCharges(null);
    else setLoadingMore(true);
    const { data, error: loadError } = await supabase
      .from("client_charges")
      .select(
        `id, charge_number, reference_code, period_start, period_end, due_date, status,
         final_amount_cents, paid_amount_cents, open_amount_cents,
         client:business_partners(display_name),
         documents:charge_document_versions(id, version, pdf_storage_object_path, excel_storage_object_path)`
      )
      .order("period_start", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    setLoadingMore(false);
    if (loadError) {
      setError(loadError.message);
      return;
    }
    const page = (data ?? []) as unknown as ClientCharge[];
    setHasMore(page.length === PAGE_SIZE);
    setCharges((prev) => (offset === 0 ? page : [...(prev ?? []), ...page]));
  }

  const filtered = useMemo(() => {
    if (!charges) return [];
    const term = search.trim().toLowerCase();
    return charges.filter((charge) => {
      if (filter === "OPEN" && !OPEN_STATUSES.includes(charge.status)) return false;
      if (filter === "PAID" && charge.status !== "PAID") return false;
      if (term && !(charge.client?.display_name ?? "").toLowerCase().includes(term)) return false;
      return true;
    });
  }, [charges, search, filter]);

  return (
    <>
      <PageHeader eyebrow="Recebimentos" title="Cobranças" description="Planilhas e PDFs de cobrança gerados pelo PC principal, incluindo as ainda em aberto." />

      <Card eyebrow="Ainda não cobrado" title="Em andamento">
        {pendingError ? <Alert tone="danger" title="Falha ao carregar operações em andamento">{pendingError}</Alert> : null}
        {!pendingError && !pendingGroups ? <LoadingState label="Carregando operações em andamento..." /> : null}
        {pendingGroups && pendingGroups.length === 0 ? (
          <p className="viewer-card-line viewer-card-line--muted">Nenhuma nota pendente de cobrança no momento — tudo já foi agrupado numa cobrança.</p>
        ) : null}
        {pendingGroups && pendingGroups.length > 0 ? (
          <div className="viewer-card-grid">
            {pendingGroups.map((group) => (
              <Card key={group.key} title={group.clientName}>
                <p className="viewer-card-line">{group.legalEntityName}</p>
                <p className="viewer-card-line">
                  {formatDateBr(group.periodStart)} a {formatDateBr(group.periodEnd)} · {group.operationCount} nota(s) · {group.sacks.toLocaleString("pt-BR")} sacas
                </p>
                <p className="viewer-card-line">
                  <strong>{formatCurrencyBr(group.amountCents)}</strong> acumulado até agora
                </p>
              </Card>
            ))}
          </div>
        ) : null}
      </Card>

      {error ? <Alert tone="danger" title="Falha ao carregar cobranças">{error}</Alert> : null}
      {!error && !charges ? <LoadingState label="Carregando cobranças..." /> : null}
      {charges ? (
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
            <EmptyState title="Nenhuma cobrança encontrada" description="Ajuste a busca ou o filtro para ver outros resultados." />
          ) : (
            <div className="viewer-card-grid">
              {filtered.map((charge) => {
                const latestDocument =
                  charge.documents.length > 0 ? charge.documents.reduce((a, b) => (a.version > b.version ? a : b)) : null;
                return (
                  <Card key={charge.id} title={charge.client?.display_name ?? "Cliente"} actions={<StatusBadge status={charge.status} />}>
                    <p className="viewer-card-line">
                      {charge.charge_number ? `Cobrança ${charge.charge_number}` : "Sem número"} · {formatDateBr(charge.period_start)} a{" "}
                      {formatDateBr(charge.period_end)}
                    </p>
                    <p className="viewer-card-line">
                      Total: {formatCurrencyBr(charge.final_amount_cents)}
                      {charge.open_amount_cents > 0 ? ` · Em aberto: ${formatCurrencyBr(charge.open_amount_cents)}` : ""}
                    </p>
                    {!latestDocument ? <p className="viewer-card-line viewer-card-line--muted">Planilha ainda não gerada</p> : null}
                    <div className="viewer-card-actions">
                      <Button
                        variant="secondary"
                        disabled={!latestDocument?.pdf_storage_object_path}
                        onClick={() => latestDocument?.pdf_storage_object_path && void openStorageFile(latestDocument.pdf_storage_object_path)}
                      >
                        Baixar PDF
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={!latestDocument?.excel_storage_object_path}
                        onClick={() =>
                          latestDocument?.excel_storage_object_path && void openStorageFile(latestDocument.excel_storage_object_path)
                        }
                      >
                        Baixar planilha
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
          {hasMore ? (
            <div className="viewer-load-more">
              <Button variant="ghost" loading={loadingMore} onClick={() => void load(charges.length)}>
                Carregar mais
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}
