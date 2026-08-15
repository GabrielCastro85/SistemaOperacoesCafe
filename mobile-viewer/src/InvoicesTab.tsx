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
import { companyColorClass } from "./companyColor";
import type { FiscalDocumentDirection, FiscalDocumentRow } from "./types";

const PAGE_SIZE = 200;

const DIRECTION_LABELS: Record<FiscalDocumentDirection, string> = {
  INBOUND: "Entrada",
  OUTBOUND: "Saída",
  UNKNOWN: "Não identificada"
};

type FilterMode = "ALL" | FiscalDocumentDirection;

export function InvoicesTab(): JSX.Element {
  const { legalEntityId } = useActiveContext();
  const [documents, setDocuments] = useState<FiscalDocumentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("ALL");

  useEffect(() => {
    if (!legalEntityId) return;
    void load(0);
  }, [legalEntityId]);

  async function load(offset: number): Promise<void> {
    setError(null);
    if (offset === 0) setDocuments(null);
    else setLoadingMore(true);
    const { data, error: loadError } = await supabase
      .from("fiscal_documents")
      .select(
        `id, document_number, series, issue_date, total_amount_cents, status, direction,
         own_legal_entity:legal_entities(trade_name),
         responsible_partner:business_partners(display_name)`
      )
      .eq("own_legal_entity_id", legalEntityId)
      .neq("status", "CANCELED")
      .order("issue_date", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    setLoadingMore(false);
    if (loadError) {
      setError(loadError.message);
      return;
    }
    const page = (data ?? []) as unknown as FiscalDocumentRow[];
    setHasMore(page.length === PAGE_SIZE);
    setDocuments((prev) => (offset === 0 ? page : [...(prev ?? []), ...page]));
  }

  const filtered = useMemo(() => {
    if (!documents) return [];
    const term = search.trim().toLowerCase();
    return documents.filter((document) => {
      if (filter !== "ALL" && document.direction !== filter) return false;
      if (term) {
        const haystack = `${document.document_number} ${document.responsible_partner?.display_name ?? ""} ${
          document.own_legal_entity?.trade_name ?? ""
        }`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [documents, search, filter]);

  return (
    <>
      <PageHeader eyebrow="Operações" title="Notas e operações" description="Notas fiscais lançadas no PC principal (manualmente ou por importação de XML/planilha)." />
      {error ? <Alert tone="danger" title="Falha ao carregar notas">{error}</Alert> : null}
      {!error && !documents ? <LoadingState label="Carregando notas..." /> : null}
      {documents ? (
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
              placeholder="Buscar número, parceiro ou empresa..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="viewer-chip-row">
              <Button variant={filter === "ALL" ? "primary" : "secondary"} onClick={() => setFilter("ALL")}>
                Todas
              </Button>
              <Button variant={filter === "INBOUND" ? "primary" : "secondary"} onClick={() => setFilter("INBOUND")}>
                Entrada
              </Button>
              <Button variant={filter === "OUTBOUND" ? "primary" : "secondary"} onClick={() => setFilter("OUTBOUND")}>
                Saída
              </Button>
            </div>
          </FilterBar>
          {filtered.length === 0 ? (
            <EmptyState title="Nenhuma nota encontrada" description="Ajuste a busca ou o filtro para ver outros resultados." />
          ) : (
            <div className="viewer-card-grid">
              {filtered.map((document) => (
                <Card
                  key={document.id}
                  title={document.document_number ? `NF ${document.document_number}${document.series ? `/${document.series}` : ""}` : "Sem número"}
                  actions={<StatusBadge status={document.status} />}
                  className={companyColorClass(document.own_legal_entity?.trade_name)}
                >
                  <p className="viewer-card-line">{document.responsible_partner?.display_name ?? "Parceiro não identificado"}</p>
                  <p className="viewer-card-line">
                    {document.own_legal_entity?.trade_name ?? ""} · {DIRECTION_LABELS[document.direction]}
                  </p>
                  <p className="viewer-card-line">
                    {formatDateBr(document.issue_date)} · {formatCurrencyBr(document.total_amount_cents)}
                  </p>
                </Card>
              ))}
            </div>
          )}
          {hasMore ? (
            <div className="viewer-load-more">
              <Button variant="ghost" loading={loadingMore} onClick={() => void load(documents.length)}>
                Carregar mais
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}
