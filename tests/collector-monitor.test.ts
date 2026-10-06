import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import type pg from "pg";
import type { ServerConfig } from "../server/src/config.js";
import { registerCollectorRoutes } from "../server/src/collector.js";

const collectorSecret = "segredo-do-coletor-com-mais-de-trinta-e-dois-caracteres";
const config = { COLLECTOR_INGEST_SECRET: collectorSecret } as ServerConfig;

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
      error: null
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
});
