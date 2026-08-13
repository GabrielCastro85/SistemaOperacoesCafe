import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { formatDateBr, openStorageFile } from "./storage";
import type { DealConfirmation } from "./types";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  PENDING_REVIEW: "Em conferencia",
  ISSUED: "Emitida",
  SENT_FOR_SIGNATURE: "Enviada para assinatura",
  SIGNED: "Assinada",
  CANCELLED: "Cancelada",
  REPLACED: "Substituida"
};

export function ConfirmationsTab(): JSX.Element {
  const [confirmations, setConfirmations] = useState<DealConfirmation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load(): Promise<void> {
    setError(null);
    const { data, error } = await supabase
      .from("deal_confirmations")
      .select(
        `id, confirmation_number, temporary_reference, confirmation_date, status,
         total_quantity_sacks_decimal, total_commercial_amount_cents,
         own_legal_entity:legal_entities(trade_name),
         documents:deal_confirmation_document_versions(id, document_type, is_current, storage_object_path)`
      )
      .order("confirmation_date", { ascending: false })
      .limit(100);
    if (error) {
      setError(error.message);
      return;
    }
    setConfirmations((data ?? []) as unknown as DealConfirmation[]);
  }

  if (error) return <p className="error">Falha ao carregar confirmacoes: {error}</p>;
  if (!confirmations) return <p className="loading">Carregando confirmacoes...</p>;
  if (confirmations.length === 0) return <p className="empty">Nenhuma confirmacao encontrada.</p>;

  return (
    <ul className="card-list">
      {confirmations.map((confirmation) => {
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
  );
}
