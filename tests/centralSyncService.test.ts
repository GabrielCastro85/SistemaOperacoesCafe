import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CentralSyncService } from "../electron/main/services/centralSyncService.js";

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" }
});

function createDatabase(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE installation_profiles (id TEXT PRIMARY KEY, created_at TEXT NOT NULL);
    INSERT INTO installation_profiles VALUES ('install-source', '2026-09-17T00:00:00.000Z');
    CREATE TABLE organizations (id TEXT PRIMARY KEY, display_name TEXT NOT NULL);
    INSERT INTO organizations VALUES ('org-1', 'Grao & Grao');
    CREATE TABLE central_sync_state (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1), server_revision INTEGER NOT NULL DEFAULT 0,
      source_installation_id TEXT, last_success_at TEXT, last_error TEXT
    );
    INSERT INTO central_sync_state(singleton, server_revision) VALUES (1, 0);
    CREATE TABLE central_sync_baseline (
      table_name TEXT NOT NULL, row_key TEXT NOT NULL, row_sha256 TEXT NOT NULL,
      PRIMARY KEY (table_name, row_key)
    );
  `);
  return db;
}

afterEach(() => vi.unstubAllGlobals());

describe("CentralSyncService", () => {
  it("inicializa a origem, envia alteracao e avanca a revisao sem perder o registro", async () => {
    const db = createDatabase();
    const requests: Array<{ path: string; body: unknown }> = [];
    let organizationName = "Grao & Grao";
    let revision = 1;
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      requests.push({ path: url.pathname, body });
      if (url.pathname === "/v1/session/login") return jsonResponse({ token: "token" });
      if (url.pathname === "/v1/sync/status") return jsonResponse({ revision, sourceInstallationId: "install-source", recordCount: 1 });
      if (url.pathname === "/v1/sync/bootstrap") {
        return jsonResponse({
          revision,
          records: [{ table: "organizations", key: "org-1", data: { display_name: organizationName, id: "org-1" }, sha256: "32f79fb1e77c40a2f14cfd4114f48587ce66be99194a393489860014ee4e6b5c", revision }],
          nextCursor: null
        });
      }
      if (url.pathname === "/v1/sync/push") {
        organizationName = (body as { changes: Array<{ data: { display_name: string } }> }).changes[0].data.display_name;
        revision += 1;
        return jsonResponse({ revision, reused: false });
      }
      if (url.pathname === "/v1/sync/changes") {
        const after = Number(url.searchParams.get("after"));
        return jsonResponse({
          currentRevision: revision,
          changes: after < revision && revision > 1 ? [{
            revision, sequence: 1, table: "organizations", key: "org-1", operation: "UPSERT",
            data: { display_name: organizationName, id: "org-1" }, sha256: null
          }] : [],
          next: null
        });
      }
      throw new Error(`Rota inesperada: ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const service = new CentralSyncService(db, "test");
    await service.login("Gabriel", "senha-teste");
    service.stop();
    db.prepare("UPDATE organizations SET display_name = ? WHERE id = ?").run("Villa Coffee", "org-1");
    await service.login("Gabriel", "senha-teste");
    service.stop();

    const push = requests.find((request) => request.path === "/v1/sync/push");
    expect(push).toBeTruthy();
    expect((push?.body as { baseRevision: number }).baseRevision).toBe(1);
    expect((push?.body as { changes: Array<{ data: { display_name: string } }> }).changes[0].data.display_name).toBe("Villa Coffee");
    expect(db.prepare("SELECT display_name AS name FROM organizations WHERE id = 'org-1'").get()).toEqual({ name: "Villa Coffee" });
    expect(db.prepare("SELECT server_revision AS revision FROM central_sync_state WHERE singleton = 1").get()).toEqual({ revision: 2 });
    db.close();
  });
});
