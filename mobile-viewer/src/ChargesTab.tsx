import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { formatCurrencyBr, formatDateBr, openStorageFile } from "./storage";
import type { ClientCharge } from "./types";

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

export function ChargesTab(): JSX.Element {
  const [charges, setCharges] = useState<ClientCharge[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load(): Promise<void> {
    setError(null);
    const { data, error } = await supabase
      .from("client_charges")
      .select(
        `id, charge_number, reference_code, period_start, period_end, due_date, status,
         final_amount_cents, paid_amount_cents, open_amount_cents,
         client:business_partners(display_name),
         documents:charge_document_versions(id, version, pdf_storage_object_path, excel_storage_object_path)`
      )
      .order("period_start", { ascending: false })
      .limit(100);
    if (error) {
      setError(error.message);
      return;
    }
    setCharges((data ?? []) as unknown as ClientCharge[]);
  }

  if (error) return <p className="error">Falha ao carregar cobrancas: {error}</p>;
  if (!charges) return <p className="loading">Carregando cobrancas...</p>;
  if (charges.length === 0) return <p className="empty">Nenhuma cobranca encontrada.</p>;

  return (
    <ul className="card-list">
      {charges.map((charge) => {
        const latestDocument =
          charge.documents.length > 0 ? charge.documents.reduce((a, b) => (a.version > b.version ? a : b)) : null;
        return (
          <li key={charge.id} className="card">
            <div className="card-header">
              <strong>{charge.client?.display_name ?? "Cliente"}</strong>
              <span className={`status status--${charge.status.toLowerCase()}`}>{STATUS_LABELS[charge.status] ?? charge.status}</span>
            </div>
            <p className="card-line">
              {charge.charge_number ? `Cobranca ${charge.charge_number}` : "Sem numero"} · {formatDateBr(charge.period_start)} a{" "}
              {formatDateBr(charge.period_end)}
            </p>
            <p className="card-line">
              Total: {formatCurrencyBr(charge.final_amount_cents)}
              {charge.open_amount_cents > 0 ? ` · Em aberto: ${formatCurrencyBr(charge.open_amount_cents)}` : ""}
            </p>
            <div className="card-actions">
              <button
                disabled={!latestDocument?.pdf_storage_object_path}
                onClick={() => latestDocument?.pdf_storage_object_path && void openStorageFile(latestDocument.pdf_storage_object_path)}
              >
                Baixar PDF
              </button>
              <button
                disabled={!latestDocument?.excel_storage_object_path}
                onClick={() => latestDocument?.excel_storage_object_path && void openStorageFile(latestDocument.excel_storage_object_path)}
              >
                Baixar planilha
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
