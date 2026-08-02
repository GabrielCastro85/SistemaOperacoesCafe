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

// Mesmo espirito do FakeCloud em tests/user-sync.test.ts, mas tambem
// implementa deleteWhere/updateRow -- exclusao de usuario e' a UNICA
// exclusao do app que propaga de verdade (ver AuthService.deleteUser),
// entao precisa desses dois pra exercitar o fluxo completo.
class FakeCloud implements Pick<SharedRepository, "upsertRow" | "pullChangesSince" | "checkConnectivity" | "deleteWhere" | "updateRow"> {
  private tables = new Map<string, Map<string, Record<string, unknown>>>();

  checkConnectivity = async () => ({ online: true, authenticated: true, error: null });

  async upsertRow(table: string, row: Record<string, unknown>): Promise<Record<string, unknown>> {
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
}

function setupPc(cloud: FakeCloud): { db: ReturnType<typeof initializeDatabase>; auth: AuthService; repo: AppRepository } {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-user-deletion-sync-"));
  tempDirs.push(userData);
  const directories = resolveAppDirectories(userData);
  ensureAppDirectories(directories);
  const db = initializeDatabase(directories);
  const repo = new AppRepository(db, directories, cloud as unknown as SharedRepository);
  const auth = new AuthService(db, cloud as unknown as SharedRepository);
  return { db, auth, repo };
}

describe("exclusao de usuario propaga entre PCs", () => {
  it("usuario excluido no PC A some do PC B depois de sincronizar, e nao consegue mais logar em nenhum dos dois", async () => {
    const cloud = new FakeCloud();
    const pcA = setupPc(cloud);
    const pcB = setupPc(cloud);

    try {
      await pcA.auth.bootstrapAdministrator({ displayName: "Administrador", username: "admin", email: null, password: "Senha@12345" });
      await pcA.auth.createUser({ displayName: "Gabriel Duplicado", username: "gabriel2", email: null, password: "Trocar@123", mustChangePassword: true });
      const created = pcA.auth.listUsers().find((user) => user.username === "gabriel2")!;
      await pcA.auth.assignRole({ userId: created.id, roleId: "role-employee-operacional" });

      await pcB.repo.syncSharedDataDown();
      await pcB.auth.login({ username: "admin", password: "Senha@12345" });
      expect(pcB.auth.listUsers().map((user) => user.username)).toContain("gabriel2");

      await pcA.auth.deleteUser(created.id);
      expect(pcA.auth.listUsers().map((user) => user.username)).not.toContain("gabriel2");

      await pcB.repo.syncSharedDataDown();

      expect(pcB.auth.listUsers().map((user) => user.username)).not.toContain("gabriel2");
      await expect(pcB.auth.login({ username: "gabriel2", password: "Trocar@123" })).rejects.toThrow();
      await expect(pcA.auth.login({ username: "gabriel2", password: "Trocar@123" })).rejects.toThrow();
    } finally {
      pcA.db.close();
      pcB.db.close();
    }
  });
});
