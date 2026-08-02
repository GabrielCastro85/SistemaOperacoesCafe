import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import log from "electron-log";

interface OutboxRow {
  id: string;
  push_kind: string;
  entity_id: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  last_attempted_at: string | null;
}

/**
 * Fila local de reenvio pro Supabase (ver migracao 038_shared_push_outbox).
 * enqueue() registra o que falhou; flush() roda a cada ciclo de
 * sincronizacao e tenta de novo ate' conseguir, removendo da fila so' quando
 * o reenvio funciona. Nunca desiste sozinha -- dado critico (nota, cobranca,
 * confirmacao, conta a pagar) nao pode ficar preso so' num PC pra sempre.
 */
export class SharedPushOutbox {
  constructor(private readonly db: Database.Database) {}

  enqueue(pushKind: string, entityId: string, error: unknown): void {
    const now = new Date().toISOString();
    const message = error instanceof Error ? error.message : String(error);
    this.db.prepare(
      `INSERT INTO shared_push_outbox (id, push_kind, entity_id, attempts, last_error, created_at, last_attempted_at)
       VALUES (@id, @pushKind, @entityId, 1, @message, @now, @now)
       ON CONFLICT(push_kind, entity_id) DO UPDATE SET
         attempts = attempts + 1, last_error = @message, last_attempted_at = @now`
    ).run({ id: randomUUID(), pushKind, entityId, message, now });
  }

  private remove(pushKind: string, entityId: string): void {
    this.db.prepare("DELETE FROM shared_push_outbox WHERE push_kind = ? AND entity_id = ?").run(pushKind, entityId);
  }

  list(kinds: string[]): OutboxRow[] {
    if (kinds.length === 0) return [];
    const placeholders = kinds.map(() => "?").join(",");
    return this.db.prepare(`SELECT * FROM shared_push_outbox WHERE push_kind IN (${placeholders}) ORDER BY created_at ASC`).all(...kinds) as OutboxRow[];
  }

  async flush(kinds: string[], replay: (pushKind: string, entityId: string) => Promise<void>): Promise<{ retried: number; stillPending: number }> {
    const entries = this.list(kinds);
    let retried = 0;
    for (const entry of entries) {
      try {
        await replay(entry.push_kind, entry.entity_id);
        this.remove(entry.push_kind, entry.entity_id);
        retried += 1;
      } catch (error) {
        log.warn(`Reenvio pendente falhou de novo (${entry.push_kind}:${entry.entity_id})`, error instanceof Error ? error.message : error);
        this.enqueue(entry.push_kind, entry.entity_id, error);
      }
    }
    return { retried, stillPending: this.list(kinds).length };
  }
}
