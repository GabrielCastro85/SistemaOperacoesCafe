import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { useActiveContext } from "./activeContext";
import { formatDateBr, openStorageFile } from "./storage";
import { PageHeader } from "./renderer/design-system/components/PageHeader";
import { FilterBar } from "./renderer/design-system/components/FilterBar";
import { Card } from "./renderer/design-system/components/Card";
import { Button } from "./renderer/design-system/components/Button";
import { StatusBadge } from "./renderer/design-system/components/Badge";
import { EmptyState } from "./renderer/design-system/components/EmptyState";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { Alert } from "./renderer/design-system/components/Alert";
import { companyColorClass } from "./companyColor";
import type { DealConfirmation, DealConfirmationStatus } from "./types";

const OPEN_STATUSES: DealConfirmationStatus[] = ["DRAFT", "PENDING_REVIEW", "ISSUED", "SENT_FOR_SIGNATURE"];
const PAGE_SIZE = 200;

type FilterMode = "OPEN" | "SIGNED" | "ALL";

const FILTER_LABELS: Record<FilterMode, string> = { OPEN: "Em aberto", SIGNED: "Assinadas", ALL: "Todas" };

export function ConfirmationsTab(): JSX.Element {
  const { legalEntityId } = useActiveContext();
  const [confirmations, setConfirmations] = useState<DealConfirmation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("OPEN");

  useEffect(() => {
    if (!legalEntityId) return;
    void load(0);
  }, [legalEntityId]);

  async function load(offset: number): Promise<void> {
    setError(null);
    if (offset === 0) setConfirmations(null);
    else setLoadingMore(true);
    const { data, error: loadError } = await supabase
      .from("deal_confirmations")
      .select(
        `id, confirmation_number, temporary_reference, confirmation_date, status,
         total_quantity_sacks_decimal, total_commercial_amount_cents,
         own_legal_entity:legal_entities(trade_name),
         documents:deal_confirmation_document_versions(id, document_type, is_current, storage_object_path)`
      )
      .eq("own_legal_entity_id", legalEntityId)
      .order("confirmation_date", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    setLoadingMore(false);
    if (loadError) {
      setError(loadError.message);
      return;
    }
    const page = (data ?? []) as unknown as DealConfirmation[];
    setHasMore(page.length === PAGE_SIZE);
    setConfirmations((prev) => (offset === 0 ? page : [...(prev ?? []), ...page]));
  }

  const filtered = useMemo(() => {
    if (!confirmations) return [];
    const term = search.trim().toLowerCase();
    return confirmations.filter((confirmation) => {
      if (filter === "OPEN" && !OPEN_STATUSES.includes(confirmation.status)) return false;
      if (filter === "SIGNED" && confirmation.status !== "SIGNED") return false;
      if (term) {
        const haystack = `${confirmation.confirmation_number ?? ""} ${confirmation.temporary_reference} ${
          confirmation.own_legal_entity?.trade_name ?? ""
        }`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [confirmations, search, filter]);

  return (
    <>
      <PageHeader eyebrow="Comercial" title="Confirmações" description="Confirmações de negócio emitidas pelo PC principal, incluindo as ainda em aberto." />
      {error ? <Alert tone="danger" title="Falha ao carregar confirmações">{error}</Alert> : null}
      {!error && !confirmations ? <LoadingState label="Carregando confirmações..." /> : null}
      {confirmations ? (
        <>
          <FilterBar
            activeCount={(filter !== "ALL" ? 1 : 0) + (search.trim() ? 1 : 0)}
            onClear={() => {
              setSearch("");
              setFilter("ALL");
            }}
          >
            <input
              type="search"
              className="ui-input"
              placeholder="Buscar número ou empresa..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="viewer-chip-row">
              {(Object.keys(FILTER_LABELS) as FilterMode[]).map((mode) => (
                <Button key={mode} variant={filter === mode ? "primary" : "secondary"} onClick={() => setFilter(mode)}>
                  {FILTER_LABELS[mode]}
                </Button>
              ))}
            </div>
          </FilterBar>
          {filtered.length === 0 ? (
            <EmptyState title="Nenhuma confirmação encontrada" description="Ajuste a busca ou o filtro para ver outros resultados." />
          ) : (
            <div className="viewer-card-grid">
              {filtered.map((confirmation) => {
                const issuedDocument =
                  confirmation.documents.find((doc) => doc.document_type === "ISSUED_ORIGINAL" && doc.is_current) ?? null;
                return (
                  <Card
                    key={confirmation.id}
                    title={confirmation.confirmation_number ?? confirmation.temporary_reference}
                    actions={<StatusBadge status={confirmation.status} />}
                    className={companyColorClass(confirmation.own_legal_entity?.trade_name)}
                  >
                    <p className="viewer-card-line">
                      {confirmation.own_legal_entity?.trade_name ?? ""} · {formatDateBr(confirmation.confirmation_date)}
                    </p>
                    <p className="viewer-card-line">{confirmation.total_quantity_sacks_decimal} sacas</p>
                    {!issuedDocument ? <p className="viewer-card-line viewer-card-line--muted">PDF ainda não emitido</p> : null}
                    <div className="viewer-card-actions">
                      <Button
                        variant="secondary"
                        disabled={!issuedDocument?.storage_object_path}
                        onClick={() => issuedDocument?.storage_object_path && void openStorageFile(issuedDocument.storage_object_path)}
                      >
                        Baixar PDF
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
          {hasMore ? (
            <div className="viewer-load-more">
              <Button variant="ghost" loading={loadingMore} onClick={() => void load(confirmations.length)}>
                Carregar mais
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}
