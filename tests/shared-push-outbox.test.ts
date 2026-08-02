import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { AppRepository } from "../electron/main/services/appRepository";
import { AuthService } from "../electron/main/services/security";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";
import type { SharedRepository } from "../electron/main/services/sharedRepository";

const tempDirs: string[] = [];

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

// Mesmo espirito do FakeCloud em tests/user-sync.test.ts, mas com um botao
// pra simular instabilidade de rede: falha as N primeiras chamadas de
// upsertRow (por tabela), depois volta a funcionar normalmente -- exatamente
// o cenario que a fila de reenvio existe pra cobrir.
class FlakyFakeCloud implements Pick<SharedRepository, "upsertRow" | "pullChangesSince" | "checkConnectivity" | "deleteWhere" | "updateRow"> {
  private tables = new Map<string, Map<string, Record<string, unknown>>>();
  private failuresRemaining: Map<string, number> = new Map();

  checkConnectivity = async () => ({ online: true, authenticated: true, error: null });

  failNextWritesFor(table: string, count: number): void {
    this.failuresRemaining.set(table, count);
  }

  async upsertRow(table: string, row: Record<string, unknown>): Promise<Record<string, unknown>> {
    const remaining = this.failuresRemaining.get(table) ?? 0;
    if (remaining > 0) {
      this.failuresRemaining.set(table, remaining - 1);
      throw new Error(`Falha simulada de rede ao gravar em ${table}`);
    }
    if (!this.tables.has(table)) this.tables.set(table, new Map());
    this.tables.get(table)!.set(String(row.id), row);
    return row;
  }

  async updateRow(table: string, id: string, patch: Record<string, unknown>): Promise<Record<string, unknown>> {
    const existing = this.tables.get(table)?.get(id) ?? { id };
    const updated = { ...existing, ...patch };
    this.tables.get(table)!.set(id, updated);
    return updated;
  }

  async deleteWhere(table: string, match: Record<string, unknown>): Promise<void> {
    const rows = this.tables.get(table);
    if (!rows) return;
    const [key, value] = Object.entries(match)[0];
    for (const [rowId, row] of [...rows.entries()]) {
      if (row[key] === value) rows.delete(rowId);
    }
  }

  async pullChangesSince(table: string, timestampColumn: string, since: string): Promise<Record<string, unknown>[]> {
    const rows = [...(this.tables.get(table)?.values() ?? [])];
    return rows.filter((row) => String(row[timestampColumn]) > since);
  }

  has(table: string, id: string): boolean {
    return this.tables.get(table)?.has(id) ?? false;
  }
}

function setupPc(cloud: FlakyFakeCloud): { db: ReturnType<typeof initializeDatabase>; auth: AuthService; repo: AppRepository } {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-outbox-"));
  tempDirs.push(userData);
  const directories = resolveAppDirectories(userData);
  ensureAppDirectories(directories);
  const db = initializeDatabase(directories);
  const repo = new AppRepository(db, directories, cloud as unknown as SharedRepository);
  const auth = new AuthService(db, cloud as unknown as SharedRepository);
  return { db, auth, repo };
}

describe("fila de reenvio de pushes pro Supabase", () => {
  it("um push que falha na hora fica preso localmente, mas o proximo ciclo de sincronizacao reenvia sozinho ate conseguir", async () => {
    const cloud = new FlakyFakeCloud();
    const pc = setupPc(cloud);
    try {
      await pc.auth.bootstrapAdministrator({ displayName: "Administrador", username: "admin", email: null, password: "Senha@12345" });
      // As tres primeiras escritas de um createUser (app_users, user_credentials,
      // user_role_assignments) falham -- simula o PC ficando offline bem na
      // hora de criar o funcionario.
      cloud.failNextWritesFor("app_users", 1);
      const user = await pc.auth.createUser({ displayName: "Novo Funcionario", username: "novofuncionario", email: null, password: "Trocar@123", mustChangePassword: true });

      // A gravacao local sempre funciona, mesmo com o push falhando.
      expect(pc.auth.listUsers().map((entry) => entry.username)).toContain("novofuncionario");
      // Mas o Supabase (simulado) ainda nao tem o usuario -- o push falhou.
      expect(cloud.has("app_users", user.id)).toBe(false);

      const pending = pc.db.prepare("SELECT push_kind, entity_id, attempts FROM shared_push_outbox").all() as Array<{ push_kind: string; entity_id: string; attempts: number }>;
      expect(pending).toContainEqual({ push_kind: "user", entity_id: user.id, attempts: 1 });

      // Ciclo de sincronizacao seguinte (poll de 20s ou "Sincronizar agora")
      // -- agora a rede "voltou", o reenvio deve funcionar sozinho.
      await pc.repo.syncSharedDataDown();

      expect(cloud.has("app_users", user.id)).toBe(true);
      const stillPending = pc.db.prepare("SELECT * FROM shared_push_outbox").all();
      expect(stillPending).toHaveLength(0);
    } finally {
      pc.db.close();
    }
  });

  it("continua tentando em ciclos sucessivos enquanto a falha persistir, sem duplicar entradas na fila", async () => {
    const cloud = new FlakyFakeCloud();
    const pc = setupPc(cloud);
    try {
      await pc.auth.bootstrapAdministrator({ displayName: "Administrador", username: "admin", email: null, password: "Senha@12345" });
      // 2 falhas: a 1a consumida pelo proprio createUser, a 2a pelo 1o
      // syncSharedDataDown -- so' o 2o syncSharedDataDown (3a tentativa) deve
      // conseguir.
      cloud.failNextWritesFor("app_users", 2);
      const user = await pc.auth.createUser({ displayName: "Ainda Falhando", username: "aindafalhando", email: null, password: "Trocar@123", mustChangePassword: true });

      await pc.repo.syncSharedDataDown();
      expect(cloud.has("app_users", user.id)).toBe(false);
      let rows = pc.db.prepare("SELECT * FROM shared_push_outbox WHERE entity_id = ?").all(user.id);
      expect(rows).toHaveLength(1);

      await pc.repo.syncSharedDataDown();
      expect(cloud.has("app_users", user.id)).toBe(true);
      rows = pc.db.prepare("SELECT * FROM shared_push_outbox WHERE entity_id = ?").all(user.id);
      expect(rows).toHaveLength(0);
    } finally {
      pc.db.close();
    }
  });
});
