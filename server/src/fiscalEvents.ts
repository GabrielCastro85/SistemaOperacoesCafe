import type pg from "pg";
import type { DomainChange } from "./domainMutations.js";

// Eventos fiscais (cancelamento, carta de correcao) recebidos antes ou depois
// da propria NF-e. Espelha importFiscalEvent e linkPendingFiscalDocumentEvents
// do aplicativo: cancelamento aceito pela SEFAZ (135/155 com protocolo) cancela
// a nota e os movimentos de armazem da mesma chave.

type Row = Record<string, unknown>;
const text = (value: unknown): string => String(value ?? "").trim();

export async function rowsWhere(pool: pg.Pool, table: string, field: string, values: string[]): Promise<Row[]> {
  if (values.length === 0) return [];
  const result = await pool.query<{ row_data: Row }>(
    "SELECT row_data FROM central_records WHERE table_name = $1 AND deleted = false AND row_data->>$2 = ANY($3::text[])",
    [table, field, values]
  );
  return result.rows.map((row) => row.row_data);
}

export function isAcceptedCancellation(event: Row): boolean {
  return text(event.event_type) === "CANCELLATION" && ["135", "155"].includes(text(event.status_code)) && Boolean(text(event.protocol_number));
}

export async function acceptedCancellationFor(pool: pg.Pool, accessKey: string): Promise<Row | null> {
  return (await rowsWhere(pool, "fiscal_document_events", "access_key", [accessKey])).find(isAcceptedCancellation) ?? null;
}

// Para uma nota que esta sendo gravada: liga os eventos que chegaram antes e,
// se ha cancelamento aceito, ja grava a nota e as operacoes como canceladas.
export async function pendingEventChanges(
  pool: pg.Pool, accessKey: string | null, document: Row, operations: Row[], now: string
): Promise<DomainChange[]> {
  if (!accessKey) return [];
  const events = await rowsWhere(pool, "fiscal_document_events", "access_key", [accessKey]);
  const changes: DomainChange[] = events
    .filter((event) => !event.fiscal_document_id)
    .map((event) => ({ table: "fiscal_document_events", key: text(event.id), operation: "UPSERT" as const, data: { ...event, fiscal_document_id: document.id } }));
  const cancellation = events.find(isAcceptedCancellation);
  if (cancellation) {
    Object.assign(document, {
      status: "CANCELED", canceled_at: now, confirmed_at: null,
      cancel_reason: `Cancelamento XML protocolo ${text(cancellation.protocol_number)}`, updated_at: now
    });
    for (const operation of operations) Object.assign(operation, { status: "CANCELED", updated_at: now });
  }
  return changes;
}
