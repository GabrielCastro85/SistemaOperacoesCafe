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
  it("mantem jobs de importacao XML locais e ignora copias legadas vindas do servidor", async () => {
    const db = createDatabase();
    db.exec(`
      CREATE TABLE xml_import_jobs (id TEXT PRIMARY KEY, status TEXT NOT NULL);
      INSERT INTO xml_import_jobs VALUES ('local-job', 'COMPLETED');
      UPDATE central_sync_state SET server_revision = 1, source_installation_id = 'install-source' WHERE singleton = 1;
      INSERT INTO central_sync_baseline VALUES ('organizations', 'org-1', '32f79fb1e77c40a2f14cfd4114f48587ce66be99194a393489860014ee4e6b5c');
      INSERT INTO central_sync_baseline VALUES ('xml_import_jobs', 'old-remote-job', 'old-hash');
    `);
    const paths: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const url = new URL(input);
      paths.push(url.pathname);
      if (url.pathname === "/v1/session/login") return jsonResponse({ token: "token" });
      if (url.pathname === "/v1/sync/status") return jsonResponse({ revision: 2, sourceInstallationId: "install-source", recordCount: 2 });
      if (url.pathname === "/v1/sync/changes") return jsonResponse({
        currentRevision: 2,
        changes: [{ revision: 2, sequence: 1, table: "xml_import_jobs", key: "remote-job", operation: "UPSERT", data: { id: "remote-job", status: "FAILED" }, sha256: "remote-hash" }],
        next: null
      });
      throw new Error(`Rota inesperada: ${url.pathname}`);
    }));

    const service = new CentralSyncService(db, "test");
    try {
      await service.login("Gabriel", "senha-teste");
      expect(db.prepare("SELECT * FROM xml_import_jobs").all()).toEqual([{ id: "local-job", status: "COMPLETED" }]);
      expect(paths).not.toContain("/v1/sync/push");
      expect(service.getStatus()).toMatchObject({ status: "ONLINE", revision: 2, error: null });
    } finally {
      service.stop();
      db.close();
    }
  });

  it("substitui dados antigos do segundo PC pelos dados centrais antes de liberar o login", async () => {
    const db = createDatabase();
    db.prepare("UPDATE installation_profiles SET id = 'second-pc'").run();
    db.prepare("UPDATE organizations SET display_name = 'Dados antigos'").run();
    const paths: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const path = new URL(input).pathname;
      paths.push(path);
      if (path === "/v1/session/login") return jsonResponse({ token: "token" });
      if (path === "/v1/sync/status") return jsonResponse({ revision: 1, sourceInstallationId: "install-source", recordCount: 1 });
      if (path === "/v1/sync/bootstrap") return jsonResponse({
        revision: 1, nextCursor: null,
        records: [{ table: "organizations", key: "org-1", data: { display_name: "Grao & Grao", id: "org-1" }, sha256: "32f79fb1e77c40a2f14cfd4114f48587ce66be99194a393489860014ee4e6b5c", revision: 1 }]
      });
      if (path === "/v1/sync/changes") return jsonResponse({ currentRevision: 1, changes: [], next: null });
      throw new Error(`Rota inesperada: ${path}`);
    }));
    const service = new CentralSyncService(db, "test");
    try {
      await service.login("Gabriel", "senha-teste");
      expect(db.prepare("SELECT display_name FROM organizations").get()).toEqual({ display_name: "Grao & Grao" });
      expect(service.getStatus()).toMatchObject({ status: "ONLINE", revision: 1, error: null });
      expect(paths).not.toContain("/v1/sync/push");
    } finally {
      service.stop();
      db.close();
    }
  });

  it("recusa login se o download falhar, preserva a base e permite tentar novamente", async () => {
    const db = createDatabase();
    db.prepare("UPDATE installation_profiles SET id = 'second-pc'").run();
    let unavailable = true;
    const fetchMock = vi.fn(async (input: string) => {
      const path = new URL(input).pathname;
      if (path === "/v1/session/login") return jsonResponse({ token: "token" });
      if (path === "/v1/sync/status") return jsonResponse({ revision: 1, sourceInstallationId: "install-source", recordCount: 1 });
      if (path === "/v1/sync/bootstrap") {
        if (unavailable) return jsonResponse({ message: "Servico indisponivel" }, 503);
        return jsonResponse({ revision: 1, nextCursor: null, records: [{
          table: "organizations", key: "org-1", data: { display_name: "Grao & Grao", id: "org-1" },
          sha256: "32f79fb1e77c40a2f14cfd4114f48587ce66be99194a393489860014ee4e6b5c", revision: 1
        }] });
      }
      if (path === "/v1/sync/changes") return jsonResponse({ currentRevision: 1, changes: [], next: null });
      throw new Error(`Rota inesperada: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const service = new CentralSyncService(db, "test");
    try {
      await expect(service.login("Gabriel", "senha-teste")).rejects.toThrow("Nao foi possivel carregar os dados do servidor central");
      expect(service.getStatus()).toMatchObject({ status: "ERROR", revision: 0, lastSuccessAt: null });
      expect(db.prepare("SELECT display_name FROM organizations").get()).toEqual({ display_name: "Grao & Grao" });
      expect(db.prepare("SELECT COUNT(*) AS total FROM central_sync_baseline").get()).toEqual({ total: 0 });
      const requestCount = fetchMock.mock.calls.length;
      await service.synchronize();
      expect(fetchMock).toHaveBeenCalledTimes(requestCount);
      unavailable = false;
      await service.login("Gabriel", "senha-teste");
      expect(service.getStatus()).toMatchObject({ status: "ONLINE", revision: 1, error: null });
    } finally {
      service.stop();
      db.close();
    }
  });

  it("informa relacionamentos locais que impedem a carga sem apagar dados ou enviar alteracoes", async () => {
    const db = createDatabase();
    db.exec(`
      PRAGMA foreign_keys = ON;
      UPDATE installation_profiles SET id = 'second-pc';
      CREATE TABLE users (id TEXT PRIMARY KEY, organization_id TEXT REFERENCES organizations(id));
      INSERT INTO users VALUES ('local-user', 'org-1');
    `);
    const paths: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const path = new URL(input).pathname;
      paths.push(path);
      if (path === "/v1/session/login") return jsonResponse({ token: "token" });
      if (path === "/v1/sync/status") return jsonResponse({ revision: 1, sourceInstallationId: "install-source", recordCount: 1 });
      if (path === "/v1/sync/bootstrap") return jsonResponse({ revision: 1, nextCursor: null, records: [{
        table: "organizations", key: "org-new", data: { id: "org-new", display_name: "Servidor" }, sha256: "hash", revision: 1
      }] });
      throw new Error(`Rota inesperada: ${path}`);
    }));
    const service = new CentralSyncService(db, "test");
    try {
      await expect(service.login("Gabriel", "senha-teste")).rejects.toThrow("users -> organizations");
      expect(db.prepare("SELECT id FROM organizations").all()).toEqual([{ id: "org-1" }]);
      expect(db.pragma("foreign_key_check")).toEqual([]);
      expect(service.getStatus().revision).toBe(0);
      expect(paths).not.toContain("/v1/sync/push");
    } finally {
      service.stop();
      db.close();
    }
  });

  it("nao bloqueia a carga por arquivos e historicos que pertencem somente ao computador", async () => {
    const db = createDatabase();
    db.exec(`
      PRAGMA foreign_keys = ON;
      UPDATE installation_profiles SET id = 'second-pc';
      CREATE TABLE fiscal_documents (id TEXT PRIMARY KEY);
      INSERT INTO fiscal_documents VALUES ('documento-local-antigo');
      CREATE TABLE xml_import_jobs (id TEXT PRIMARY KEY);
      INSERT INTO xml_import_jobs VALUES ('job-local');
      CREATE TABLE xml_import_files (
        id TEXT PRIMARY KEY,
        import_job_id TEXT REFERENCES xml_import_jobs(id),
        fiscal_document_id TEXT REFERENCES fiscal_documents(id)
      );
      INSERT INTO xml_import_files VALUES ('arquivo-local', 'job-local', 'documento-local-antigo');
      CREATE TABLE deal_confirmations (id TEXT PRIMARY KEY);
      INSERT INTO deal_confirmations VALUES ('confirmacao-local-antiga');
      CREATE TABLE deal_confirmation_document_versions (
        id TEXT PRIMARY KEY,
        deal_confirmation_id TEXT REFERENCES deal_confirmations(id)
      );
      INSERT INTO deal_confirmation_document_versions VALUES ('pdf-local', 'confirmacao-local-antiga');
      CREATE TABLE fiscal_document_merge_history (
        id TEXT PRIMARY KEY,
        xml_import_job_id TEXT REFERENCES xml_import_jobs(id)
      );
    `);
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const path = new URL(input).pathname;
      if (path === "/v1/session/login") return jsonResponse({ token: "token" });
      if (path === "/v1/sync/status") return jsonResponse({ revision: 1, sourceInstallationId: "install-source", recordCount: 3 });
      if (path === "/v1/sync/bootstrap") return jsonResponse({
        revision: 1,
        nextCursor: null,
        records: [
          { table: "organizations", key: "org-new", data: { id: "org-new", display_name: "Servidor" }, sha256: "org-hash", revision: 1 },
          { table: "fiscal_documents", key: "documento-central", data: { id: "documento-central" }, sha256: "document-hash", revision: 1 },
          { table: "fiscal_document_merge_history", key: "merge-central", data: { id: "merge-central", xml_import_job_id: "job-de-outro-pc" }, sha256: "merge-hash", revision: 1 }
        ]
      });
      if (path === "/v1/sync/changes") return jsonResponse({ currentRevision: 1, changes: [], next: null });
      throw new Error(`Rota inesperada: ${path}`);
    }));

    const service = new CentralSyncService(db, "test");
    try {
      await service.login("Gabriel", "senha-teste");
      expect(db.prepare("SELECT xml_import_job_id AS jobId FROM fiscal_document_merge_history").get()).toEqual({ jobId: null });
      expect(db.prepare("SELECT id FROM xml_import_files").get()).toEqual({ id: "arquivo-local" });
      expect(db.prepare("SELECT id FROM deal_confirmation_document_versions").get()).toEqual({ id: "pdf-local" });
      expect(service.getStatus()).toMatchObject({ status: "ONLINE", revision: 1, error: null });
    } finally {
      service.stop();
      db.close();
    }
  });

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

  it("aplica juntas as paginas de uma revisao antes de validar relacionamentos", async () => {
    const db = createDatabase();
    db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE locations (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id),
        display_name TEXT NOT NULL
      );
      UPDATE central_sync_state
      SET server_revision = 1, source_installation_id = 'install-source'
      WHERE singleton = 1;
    `);
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
      if (url.pathname === "/v1/session/login") return jsonResponse({ token: "token" });
      if (url.pathname === "/v1/sync/status") {
        return jsonResponse({ revision: 2, sourceInstallationId: "install-source", recordCount: 3 });
      }
      if (url.pathname === "/v1/sync/changes") {
        const sequence = Number(url.searchParams.get("sequence"));
        if (sequence === 0) {
          return jsonResponse({
            currentRevision: 2,
            changes: [{ revision: 2, sequence: 1, table: "locations", key: "location-2", operation: "UPSERT", data: { id: "location-2", organization_id: "org-2", display_name: "Filial" }, sha256: null }],
            next: { revision: 1, sequence: 1 }
          });
        }
        return jsonResponse({
          currentRevision: 2,
          changes: [{ revision: 2, sequence: 2, table: "organizations", key: "org-2", operation: "UPSERT", data: { id: "org-2", display_name: "Villa Coffee" }, sha256: null }],
          next: null
        });
      }
      if (url.pathname === "/v1/sync/push") return jsonResponse({ revision: 2, reused: false });
      throw new Error(`Rota inesperada: ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const service = new CentralSyncService(db, "test");
    await service.login("Gabriel", "senha-teste");
    service.stop();

    expect(db.prepare("SELECT organization_id AS organizationId FROM locations WHERE id = 'location-2'").get())
      .toEqual({ organizationId: "org-2" });
    expect(db.prepare("SELECT server_revision AS revision, last_error AS error FROM central_sync_state WHERE singleton = 1").get())
      .toEqual({ revision: 2, error: null });
    expect(db.pragma("foreign_key_check")).toEqual([]);
    db.close();
  });
});
