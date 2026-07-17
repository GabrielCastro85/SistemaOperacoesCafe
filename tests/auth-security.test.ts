import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { AuthService, getIpcPolicy, hashPassword, verifyPassword } from "../electron/main/services/security";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";
import { IPC_CHANNELS } from "../src/shared/ipc/channels";
import type Database from "better-sqlite3";

const tempDirs: string[] = [];
const databases: Database.Database[] = [];

function createAuthService(): AuthService {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-cafe-auth-"));
  tempDirs.push(userData);
  const directories = resolveAppDirectories(userData);
  ensureAppDirectories(directories);
  const db = initializeDatabase(directories);
  databases.push(db);
  return new AuthService(db);
}

afterEach(() => {
  databases.splice(0).forEach((db) => db.close());
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe("local authentication and authorization", () => {
  it("stores versioned scrypt hashes with random salts", async () => {
    const first = await hashPassword("Senha@12345");
    const second = await hashPassword("Senha@12345");
    expect(first).toMatch(/^scrypt\$v1\$/);
    expect(second).toMatch(/^scrypt\$v1\$/);
    expect(first).not.toBe(second);
    expect(first).not.toContain("Senha@12345");
    await expect(verifyPassword("Senha@12345", first)).resolves.toBe(true);
    await expect(verifyPassword("errada", first)).resolves.toBe(false);
  });

  it("bootstraps the first administrator without a default password", async () => {
    const auth = createAuthService();
    expect(auth.needsBootstrap()).toBe(true);
    const session = await auth.bootstrapAdministrator({ displayName: "Admin", username: "admin", email: "admin@local", password: "Senha@12345" });
    expect(auth.needsBootstrap()).toBe(false);
    expect(session.user.username).toBe("admin");
    expect(session.permissions).toContain("users.manage");
    expect(session.permissions).toContain("audit.view");
  });

  it("opens, locks, unlocks and logs out a local session", async () => {
    const auth = createAuthService();
    await auth.bootstrapAdministrator({ displayName: "Admin", username: "admin", password: "Senha@12345" });
    auth.logout();
    const session = await auth.login({ username: "ADMIN", password: "Senha@12345" });
    expect(session.status).toBe("ACTIVE");
    expect(auth.lock()?.status).toBe("LOCKED");
    await expect(auth.unlock("errada")).rejects.toThrow();
    await expect(auth.unlock("Senha@12345")).resolves.toMatchObject({ status: "ACTIVE" });
    auth.logout();
    expect(auth.getCurrentSession()).toBeNull();
  });

  it("keeps a verifiable sanitized audit hash chain", async () => {
    const auth = createAuthService();
    await auth.bootstrapAdministrator({ displayName: "Admin", username: "admin", password: "Senha@12345" });
    auth.writeAudit({ action: "test.secret", result: "SUCCESS", severity: "INFO", metadata: { password: "Senha@12345", token: "abc", visible: "ok" } });
    const events = auth.listAuditEvents(10);
    expect(events[0].metadataJson).toContain("[REDACTED]");
    expect(events[0].metadataJson).toContain("visible");
    expect(auth.verifyAuditChain()).toMatchObject({ valid: true });
  });

  it("defines a deny-by-default policy for every IPC channel", () => {
    for (const channel of Object.values(IPC_CHANNELS)) {
      expect(getIpcPolicy(channel).mode).toMatch(/public|authenticated|permission/);
    }
    expect(getIpcPolicy("users:create")).toMatchObject({ mode: "permission", permission: "users.manage" });
    expect(getIpcPolicy("unknown:channel")).toMatchObject({ mode: "authenticated" });
  });
});
