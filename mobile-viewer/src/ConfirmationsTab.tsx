import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { formatDateBr, openStorageFile } from "./storage";
import type { DealConfirmation, DealConfirmationStatus } from "./types";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  PENDING_REVIEW: "Em conferencia",
  ISSUED: "Emitida",
  SENT_FOR_SIGNATURE: "Enviada para assinatura",
  SIGNED: "Assinada",
  CANCELLED: "Cancelada",
  REPLACED: "Substituida"
};

const OPEN_STATUSES: DealConfirmationStatus[] = ["DRAFT", "PENDING_REVIEW", "ISSUED", "SENT_FOR_SIGNATURE"];
const PAGE_SIZE = 200;

type FilterMode = "OPEN" | "SIGNED" | "ALL";

export function ConfirmationsTab(): JSX.Element {
  const [confirmations, setConfirmations] = useState<DealConfirmation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("OPEN");

  useEffect(() => {
    void load(0);
  }, []);

  async function load(offset: number): Promise<void> {
    setError(null);
    if (offset === 0) setConfirmations(null);
    else setLoadingMore(true);
    const { data, error } = await supabase
      .from("deal_confirmations")
      .select(
        `id, confirmation_number, temporary_reference, confirmation_date, status,
         total_quantity_sacks_decimal, total_commercial_amount_cents,
         own_legal_entity:legal_entities(trade_name),
         documents:deal_confirmation_document_versions(id, document_type, is_current, storage_object_path)`
      )
      .order("confirmation_date", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    setLoadingMore(false);
    if (error) {
      setError(error.message);
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

  if (error) return <p className="error">Falha ao carregar confirmacoes: {error}</p>;
  if (!confirmations) return <p className="loading">Carregando confirmacoes...</p>;

  return (
    <>
      <div className="filter-bar">
        <input
          type="search"
          className="search-input"
          placeholder="Buscar numero ou empresa..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="filter-chips">
          <button className={filter === "OPEN" ? "chip chip--active" : "chip"} onClick={() => setFilter("OPEN")}>
            Em aberto
          </button>
          <button className={filter === "SIGNED" ? "chip chip--active" : "chip"} onClick={() => setFilter("SIGNED")}>
            Assinadas
          </button>
          <button className={filter === "ALL" ? "chip chip--active" : "chip"} onClick={() => setFilter("ALL")}>
            Todas
          </button>
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="empty">Nenhuma confirmacao encontrada.</p>
      ) : (
        <ul className="card-list">
          {filtered.map((confirmation) => {
            const issuedDocument =
              confirmation.documents.find((doc) => doc.document_type === "ISSUED_ORIGINAL" && doc.is_current) ?? null;
            return (
              <li key={confirmation.id} className="card">
                <div className="card-header">
                  <strong>{confirmation.confirmation_number ?? confirmation.temporary_reference}</strong>
                  <span className={`status status--${confirmation.status.toLowerCase()}`}>
                    {STATUS_LABELS[confirmation.status] ?? confirmation.status}
                  </span>
                </div>
                <p className="card-line">
                  {confirmation.own_legal_entity?.trade_name ?? ""} · {formatDateBr(confirmation.confirmation_date)}
                </p>
                <p className="card-line">{confirmation.total_quantity_sacks_decimal} sacas</p>
                {!issuedDocument ? <p className="card-line card-line--muted">PDF ainda nao emitido</p> : null}
                <div className="card-actions">
                  <button
                    disabled={!issuedDocument?.storage_object_path}
                    onClick={() => issuedDocument?.storage_object_path && void openStorageFile(issuedDocument.storage_object_path)}
                  >
                    Baixar PDF
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {hasMore ? (
        <button className="load-more" disabled={loadingMore} onClick={() => void load(confirmations.length)}>
          {loadingMore ? "Carregando..." : "Carregar mais"}
        </button>
      ) : null}
    </>
  );
}
