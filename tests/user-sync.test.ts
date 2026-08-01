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

// Simula o Supabase pros dois PCs: um Map por tabela, upsertRow escreve nele,
// pullChangesSince le' dele -- mesmo espirito de FakeSharedRepository ja
// usado em tests/sync-cursor-advancement.test.ts e
// tests/triangulated-note-import.test.ts.
class FakeCloud implements Pick<SharedRepository, "upsertRow" | "pullChangesSince" | "checkConnectivity"> {
  private tables = new Map<string, Map<string, Record<string, unknown>>>();

  checkConnectivity = async () => ({ online: true, authenticated: true, error: null });

  async upsertRow(table: string, row: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!this.tables.has(table)) this.tables.set(table, new Map());
    this.tables.get(table)!.set(String(row.id), row);
    return row;
  }

  async pullChangesSince(table: string, timestampColumn: string, since: string): Promise<Record<string, unknown>[]> {
    const rows = [...(this.tables.get(table)?.values() ?? [])];
    return rows.filter((row) => String(row[timestampColumn]) > since);
  }
}

function setupPc(cloud: FakeCloud): { db: ReturnType<typeof initializeDatabase>; auth: AuthService; repo: AppRepository } {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-user-sync-"));
  tempDirs.push(userData);
  const directories = resolveAppDirectories(userData);
  ensureAppDirectories(directories);
  const db = initializeDatabase(directories);
  const repo = new AppRepository(db, directories, cloud as unknown as SharedRepository);
  const auth = new AuthService(db, cloud as unknown as SharedRepository);
  return { db, auth, repo };
}

describe("sincronizacao de login de funcionario entre PCs", () => {
  it("funcionario criado no PC A consegue logar no PC B depois de sincronizar", async () => {
    const cloud = new FakeCloud();
    const pcA = setupPc(cloud);
    const pcB = setupPc(cloud);

    await pcA.auth.bootstrapAdministrator({ displayName: "Administrador", username: "admin", email: null, password: "Senha@12345" });
    const adminSession = pcA.auth.getCurrentSession();
    expect(adminSession).not.toBeNull();

    // Precisa estar "logado" como admin no PC A pra ter permissao de criar
    // usuario (createUser exige users.manage via requireSession).
    await pcA.auth.createUser({ displayName: "Simonthon", username: "simonthon", email: null, password: "Trocar@123", mustChangePassword: true });
    await pcA.auth.assignRole({ userId: pcA.auth.listUsers().find((u) => u.username === "simonthon")!.id, roleId: "role-employee-operacional" });

    // PC B nunca ouviu falar do Simonthon -- sincroniza e ele deveria
    // aparecer la' com a MESMA senha.
    await pcB.repo.syncSharedDataDown();

    const loginOnB = await pcB.auth.login({ username: "simonthon", password: "Trocar@123" });
    expect(loginOnB.user.displayName).toBe("Simonthon");
    expect(loginOnB.user.mustChangePassword).toBe(true);
    expect(loginOnB.permissions).toContain("confirmations.manage");
    expect(loginOnB.permissions).toContain("finance.manage");
    expect(loginOnB.permissions).not.toContain("users.manage");

    pcA.db.close();
    pcB.db.close();
  });

  it("troca de senha no PC A reflete no PC B apos sincronizar", async () => {
    const cloud = new FakeCloud();
    const pcA = setupPc(cloud);
    const pcB = setupPc(cloud);

    await pcA.auth.bootstrapAdministrator({ displayName: "Administrador", username: "admin", email: null, password: "SenhaAntiga@1" });
    await pcB.repo.syncSharedDataDown();
    await pcB.auth.login({ username: "admin", password: "SenhaAntiga@1" });

    await pcA.auth.changePassword({ currentPassword: "SenhaAntiga@1", newPassword: "SenhaNova@2" });
    await pcB.repo.syncSharedDataDown();

    await expect(pcB.auth.login({ username: "admin", password: "SenhaAntiga@1" })).rejects.toThrow();
    const relogged = await pcB.auth.login({ username: "admin", password: "SenhaNova@2" });
    expect(relogged.user.username).toBe("admin");

    pcA.db.close();
    pcB.db.close();
  });
});
