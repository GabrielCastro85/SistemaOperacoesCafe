import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type pg from "pg";
import type { ServerConfig } from "../server/src/config.js";
import { registerCollectorRoutes } from "../server/src/collector.js";

const collectorSecret = "segredo-do-coletor-com-mais-de-trinta-e-dois-caracteres";
const config = { COLLECTOR_INGEST_SECRET: collectorSecret } as ServerConfig;

afterEach(() => vi.unstubAllGlobals());

describe("monitor remoto do coletor", () => {
  it("recebe o sinal de vida autenticado com as empresas atendidas", async () => {
    let heartbeatParams: unknown[] | null = null;
    const pool = {
      async query(sql: string, params: unknown[] = []) {
        if (sql.includes("INSERT INTO collector_status")) heartbeatParams = params;
        return { rows: [], rowCount: 1 };
      }
    } as unknown as pg.Pool;
    const app = Fastify();
    registerCollectorRoutes(app, pool, config);

    const payload = {
      sourceCode: "GRAO_GRAO",
      sourceLabel: "Grao & Grao",
      machineId: "pc-grao-principal",
      emitterCnpjs: ["16594876000224", "16594876000496"],
      collectorVersion: "1.1.33",
      scanIntervalSeconds: 60,
      status: "OK",
      inspected: 25,
      eligible: 2,
      uploaded: 1,
      pendingUpload: 0,
      error: null,
      startedAt: "2026-10-07T10:00:00.000Z",
      uptimeSeconds: 3600,
      lastUpdateCheckAt: "2026-10-07T10:30:00.000Z",
      recentLogs: "Varredura concluida",
      startupConfigured: true
    };
    const unauthorized = await app.inject({ method: "POST", url: "/v1/collector/heartbeat", payload });
    expect(unauthorized.statusCode).toBe(401);

    const response = await app.inject({
      method: "POST",
      url: "/v1/collector/heartbeat",
      headers: { authorization: `Bearer ${collectorSecret}` },
      payload
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "received" });
    expect(heartbeatParams).toEqual(expect.arrayContaining([
      "GRAO_GRAO",
      "pc-grao-principal",
      JSON.stringify(payload.emitterCnpjs),
      "1.1.33"
    ]));
    await app.close();
  });

  it("envia, entrega e conclui um comando remoto", async () => {
    const commandId = "cae8aceb-f66e-4595-9908-0c68b79b605a";
    let insertedCommand: unknown[] | null = null;
    const pool = {
      async query(sql: string, params: unknown[] = []) {
        if (sql.includes("FROM api_sessions")) {
          return { rows: [{ sessionId: "session", userId: "6456596f-2ab5-47f5-85ee-dd60fcb5fe1d", username: "gabriel", displayName: "Gabriel", deviceId: "device" }] };
        }
        if (sql.includes("UPDATE api_sessions")) return { rows: [] };
        if (sql.includes("SELECT 1 FROM collector_status")) return { rows: [{ exists: 1 }], rowCount: 1 };
        if (sql.includes("INSERT INTO collector_commands")) {
          insertedCommand = params;
          return { rows: [], rowCount: 1 };
        }
        if (sql.includes("UPDATE collector_commands") && sql.includes("RETURNING id, command")) {
          return { rows: [{ id: commandId, command: "SCAN_NOW", requestedAt: new Date().toISOString() }], rowCount: 1 };
        }
        if (sql.includes("UPDATE collector_commands SET status")) return { rows: [{ id: commandId }], rowCount: 1 };
        throw new Error(`SQL inesperado: ${sql}`);
      }
    } as unknown as pg.Pool;
    const app = Fastify();
    registerCollectorRoutes(app, pool, config);

    const created = await app.inject({
      method: "POST",
      url: "/v1/collector/commands",
      headers: { authorization: "Bearer sessao" },
      payload: { sourceCode: "GRAO_GRAO", machineId: "pc-grao-principal", command: "SCAN_NOW" }
    });
    expect(created.statusCode).toBe(201);
    expect(insertedCommand).toEqual(expect.arrayContaining(["GRAO_GRAO", "pc-grao-principal", "SCAN_NOW"]));

    const polled = await app.inject({
      method: "GET",
      url: "/v1/collector/commands?sourceCode=GRAO_GRAO&machineId=pc-grao-principal",
      headers: { authorization: `Bearer ${collectorSecret}` }
    });
    expect(polled.json()).toMatchObject({ command: { id: commandId, command: "SCAN_NOW" } });

    const completed = await app.inject({
      method: "PATCH",
      url: `/v1/collector/commands/${commandId}`,
      headers: { authorization: `Bearer ${collectorSecret}` },
      payload: { status: "COMPLETED", message: "Varredura executada." }
    });
    expect(completed.statusCode).toBe(200);
    expect(completed.json()).toMatchObject({ id: commandId, status: "COMPLETED" });
    await app.close();
  });

  it("informa atividade recente, fila e ultimo erro para o aplicativo", async () => {
    const updatedAt = new Date().toISOString();
    const pool = {
      async query(sql: string) {
        if (sql.includes("FROM api_sessions")) {
          return { rows: [{ sessionId: "session", userId: "user", username: "gabriel", displayName: "Gabriel", deviceId: "device" }] };
        }
        if (sql.includes("UPDATE api_sessions")) return { rows: [] };
        if (sql.includes("FROM collector_status status")) {
          return { rows: [{
            sourceCode: "GRAO_GRAO",
            sourceLabel: "Grao & Grao",
            machineId: "pc-grao-principal",
            emitterCnpjs: ["16594876000224", "16594876000496"],
            collectorVersion: "1.1.33",
            scanIntervalSeconds: 60,
            status: "PENDING_RETRY",
            inspected: 30,
            eligible: 3,
            uploaded: 2,
            pendingUpload: 1,
            pendingFiles: 4,
            lastScanAt: updatedAt,
            lastSuccessAt: updatedAt,
            lastUploadAt: updatedAt,
            lastFileReceivedAt: updatedAt,
            lastError: "1 arquivo aguardando novo envio",
            updatedAt
          }] };
        }
        throw new Error(`SQL inesperado: ${sql}`);
      }
    } as unknown as pg.Pool;
    const app = Fastify();
    registerCollectorRoutes(app, pool, config);

    const response = await app.inject({
      method: "GET",
      url: "/v1/collector/status",
      headers: { authorization: "Bearer sessao" }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      collectors: [expect.objectContaining({
        sourceCode: "GRAO_GRAO",
        online: true,
        pendingUpload: 1,
        pendingFiles: 4,
        lastError: "1 arquivo aguardando novo envio"
      })]
    });
    await app.close();
  });

  it("entrega um manifesto autenticado e com hash para a atualizacao comandada", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`${"a".repeat(64)}  ColetorGraoBase.exe\n`, { status: 200 })));
    const pool = { query: vi.fn() } as unknown as pg.Pool;
    const app = Fastify();
    registerCollectorRoutes(app, pool, config);

    const unauthorized = await app.inject({ method: "GET", url: "/v1/collector/update" });
    expect(unauthorized.statusCode).toBe(401);

    const response = await app.inject({
      method: "GET",
      url: "/v1/collector/update",
      headers: { authorization: `Bearer ${collectorSecret}` }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      available: true,
      latestVersion: expect.stringMatching(/^\d+\.\d+\.\d+$/),
      downloadUrl: expect.stringContaining("ColetorGraoBase-"),
      sha256: "a".repeat(64)
    });
    await app.close();
  });
});
