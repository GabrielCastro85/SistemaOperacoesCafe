import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { formatCurrencyBr, formatDateBr, openStorageFile } from "./storage";
import type { ClientCharge, ClientChargeStatus } from "./types";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  PENDING_REVIEW: "Em conferencia",
  ISSUED: "Emitida",
  PARTIALLY_PAID: "Parcialmente paga",
  PAID: "Paga",
  OVERDUE: "Vencida",
  CANCELLED: "Cancelada",
  REPLACED: "Substituida"
};

const OPEN_STATUSES: ClientChargeStatus[] = ["DRAFT", "PENDING_REVIEW", "ISSUED", "PARTIALLY_PAID", "OVERDUE"];
const PAGE_SIZE = 200;

type FilterMode = "OPEN" | "PAID" | "ALL";

export function ChargesTab(): JSX.Element {
  const [charges, setCharges] = useState<ClientCharge[] | null>(null);
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
    if (offset === 0) setCharges(null);
    else setLoadingMore(true);
    const { data, error } = await supabase
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
    if (error) {
      setError(error.message);
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

  if (error) return <p className="error">Falha ao carregar cobrancas: {error}</p>;
  if (!charges) return <p className="loading">Carregando cobrancas...</p>;

  return (
    <>
      <div className="filter-bar">
        <input
          type="search"
          className="search-input"
          placeholder="Buscar cliente..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="filter-chips">
          <button className={filter === "OPEN" ? "chip chip--active" : "chip"} onClick={() => setFilter("OPEN")}>
            Em aberto
          </button>
          <button className={filter === "PAID" ? "chip chip--active" : "chip"} onClick={() => setFilter("PAID")}>
            Pagas
          </button>
          <button className={filter === "ALL" ? "chip chip--active" : "chip"} onClick={() => setFilter("ALL")}>
            Todas
          </button>
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="empty">Nenhuma cobranca encontrada.</p>
      ) : (
        <ul className="card-list">
          {filtered.map((charge) => {
            const latestDocument =
              charge.documents.length > 0 ? charge.documents.reduce((a, b) => (a.version > b.version ? a : b)) : null;
            return (
              <li key={charge.id} className="card">
                <div className="card-header">
                  <strong>{charge.client?.display_name ?? "Cliente"}</strong>
                  <span className={`status status--${charge.status.toLowerCase()}`}>
                    {STATUS_LABELS[charge.status] ?? charge.status}
                  </span>
                </div>
                <p className="card-line">
                  {charge.charge_number ? `Cobranca ${charge.charge_number}` : "Sem numero"} · {formatDateBr(charge.period_start)} a{" "}
                  {formatDateBr(charge.period_end)}
                </p>
                <p className="card-line">
                  Total: {formatCurrencyBr(charge.final_amount_cents)}
                  {charge.open_amount_cents > 0 ? ` · Em aberto: ${formatCurrencyBr(charge.open_amount_cents)}` : ""}
                </p>
                {!latestDocument ? <p className="card-line card-line--muted">Planilha ainda nao gerada</p> : null}
                <div className="card-actions">
                  <button
                    disabled={!latestDocument?.pdf_storage_object_path}
                    onClick={() => latestDocument?.pdf_storage_object_path && void openStorageFile(latestDocument.pdf_storage_object_path)}
                  >
                    Baixar PDF
                  </button>
                  <button
                    disabled={!latestDocument?.excel_storage_object_path}
                    onClick={() =>
                      latestDocument?.excel_storage_object_path && void openStorageFile(latestDocument.excel_storage_object_path)
                    }
                  >
                    Baixar planilha
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {hasMore ? (
        <button className="load-more" disabled={loadingMore} onClick={() => void load(charges.length)}>
          {loadingMore ? "Carregando..." : "Carregar mais"}
        </button>
      ) : null}
    </>
  );
}
