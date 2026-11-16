import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { AuthService } from "../electron/main/services/security";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";
import type Database from "better-sqlite3";

const tempDirs: string[] = [];
const databases: Database.Database[] = [];

function createAuth(): { auth: AuthService; db: Database.Database } {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-cafe-session-"));
  tempDirs.push(userData);
  const directories = resolveAppDirectories(userData);
  ensureAppDirectories(directories);
  const db = initializeDatabase(directories);
  databases.push(db);
  return { auth: new AuthService(db), db };
}

afterEach(() => {
  databases.splice(0).forEach((db) => db.close());
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe("expiracao e bloqueio por inatividade da sessao", () => {
  it("grava expiracao de 12h no login", async () => {
    const { auth, db } = createAuth();
    const session = await auth.bootstrapAdministrator({ displayName: "Admin", username: "admin", password: "Senha@12345" });
    const row = db.prepare("SELECT expires_at, created_at FROM local_sessions WHERE id = ?").get(session.id) as { expires_at: string; created_at: string };
    const hours = (Date.parse(row.expires_at) - Date.parse(row.created_at)) / 3600_000;
    expect(hours).toBeCloseTo(12, 1);
  });

  it("bloqueia a sessao apos 30 min parada e exige a senha", async () => {
    const { auth, db } = createAuth();
    const session = await auth.bootstrapAdministrator({ displayName: "Admin", username: "admin", password: "Senha@12345" });
    const old = new Date(Date.now() - 31 * 60_000).toISOString();
    db.prepare("UPDATE local_sessions SET last_activity_at = ? WHERE id = ?").run(old, session.id);
    const current = auth.getCurrentSession();
    expect(current?.status).toBe("LOCKED");
    await expect(auth.unlock("errada")).rejects.toThrow();
    const unlocked = await auth.unlock("Senha@12345");
    expect(unlocked.status).toBe("ACTIVE");
  });

  it("mantem a sessao ativa enquanto houver uso recente", async () => {
    const { auth, db } = createAuth();
    const session = await auth.bootstrapAdministrator({ displayName: "Admin", username: "admin", password: "Senha@12345" });
    const recent = new Date(Date.now() - 5 * 60_000).toISOString();
    db.prepare("UPDATE local_sessions SET last_activity_at = ? WHERE id = ?").run(recent, session.id);
    expect(auth.getCurrentSession()?.status).toBe("ACTIVE");
  });

  it("expira a sessao apos 12h e devolve para o login", async () => {
    const { auth, db } = createAuth();
    const session = await auth.bootstrapAdministrator({ displayName: "Admin", username: "admin", password: "Senha@12345" });
    const past = new Date(Date.now() - 1000).toISOString();
    db.prepare("UPDATE local_sessions SET expires_at = ? WHERE id = ?").run(past, session.id);
    expect(auth.getCurrentSession()).toBeNull();
    const row = db.prepare("SELECT status FROM local_sessions WHERE id = ?").get(session.id) as { status: string };
    expect(row.status).toBe("EXPIRED");
  });
});
