import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { ZodError } from "zod";
import { existsSync } from "node:fs";
import { loadConfig } from "./config.js";
import { createPool, runCentralMigrations } from "./database.js";
import { registerAuthRoutes } from "./auth.js";
import { registerBootstrapRoutes } from "./bootstrap.js";
import { registerSqliteImportRoutes } from "./sqliteImport.js";
import { registerSyncRoutes } from "./sync.js";
import { registerViewerRoutes } from "./viewer.js";
import { registerCollectorRoutes } from "./collector.js";
import { registerMarketRoutes } from "./market.js";
import { registerAssistantRoutes } from "./assistant.js";
import { registerCommercialManagementRoutes } from "./commercialManagement.js";
import { registerOperationalManagementRoutes } from "./operationalManagement.js";
import { registerInvoiceManagementRoutes } from "./invoiceManagement.js";
import { registerSpreadsheetManagementRoutes } from "./spreadsheetManagement.js";
import { registerSpecialXmlRoutes } from "./specialXml.js";
import { registerConfirmationManagementRoutes } from "./confirmationManagement.js";
import { registerChargeManagementRoutes } from "./chargeManagement.js";
import { registerSettlementManagementRoutes } from "./settlementManagement.js";
import { registerAppEngineRoutes, type Engine } from "./appEngineRoutes.js";

const config = loadConfig();
const pool = createPool(config);
await runCentralMigrations(pool);

const app = Fastify({ logger: true, trustProxy: true, bodyLimit: 2 * 1024 * 1024 });
await app.register(helmet, { crossOriginResourcePolicy: { policy: "cross-origin" } });
await app.register(cors, {
  origin: Array.from(new Set([
    ...config.corsOrigins,
    "https://gabrielcastro85.github.io",
    "https://graobase.com.br",
    "https://www.graobase.com.br"
  ])),
  credentials: false
});

app.get("/health", async () => ({
  status: "ok",
  service: "operacoes-cafe-api",
  commit: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? null
}));
app.get("/ready", async (_request, reply) => {
  try {
    await pool.query("SELECT 1");
    return { status: "ready", database: "connected" };
  } catch {
    return reply.code(503).send({ status: "unavailable", database: "disconnected" });
  }
});

registerAuthRoutes(app, pool, config);
registerBootstrapRoutes(app, pool, config);
registerSqliteImportRoutes(app, pool);
registerSyncRoutes(app, pool);
registerViewerRoutes(app, pool);
registerMarketRoutes(app);
registerCollectorRoutes(app, pool, config);
registerAssistantRoutes(app, pool, config);
registerCommercialManagementRoutes(app, pool);
registerOperationalManagementRoutes(app, pool);
registerInvoiceManagementRoutes(app, pool);
registerSpreadsheetManagementRoutes(app, pool);
registerSpecialXmlRoutes(app, pool);
registerConfirmationManagementRoutes(app, pool);
registerChargeManagementRoutes(app, pool);
registerSettlementManagementRoutes(app, pool);

// Site completo (mesmas telas do app): o motor do app (dist-engine/host.mjs,
// montado por scripts/engine/build-engine.mjs) so e carregado no primeiro uso.
// Ele sincroniza com este proprio servidor como se fosse mais um computador.
let enginePromise: Promise<Engine> | null = null;
const loadEngine = (): Promise<Engine> => {
  enginePromise ??= (async () => {
    process.env.OPERACOES_CAFE_CENTRAL_URL ??= `http://127.0.0.1:${config.PORT}`;
    const dataDir = process.env.ENGINE_DATA_DIR ?? (existsSync("/data") ? "/data/engine" : "/tmp/operacoes-cafe-engine");
    // O substituto do Electron (chave do armazenamento seguro) usa a mesma pasta.
    process.env.ENGINE_DATA_DIR = dataDir;
    const modulePath = new URL("../../../dist-engine/host.mjs", import.meta.url).href;
    const { createEngine } = await import(modulePath) as { createEngine(options: { dataDir: string; version: string }): Engine };
    app.log.info({ dataDir }, "Motor do app carregado para o site");
    return createEngine({ dataDir, version: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? "web" });
  })().catch((error: unknown) => { enginePromise = null; throw error; });
  return enginePromise;
};
registerAppEngineRoutes(app, loadEngine);

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof ZodError) return reply.code(400).send({ error: "INVALID_REQUEST", issues: error.issues });
  app.log.error(error);
  return reply.code(500).send({ error: "INTERNAL_ERROR", message: "Falha interna no servidor." });
});

const shutdown = async () => {
  await app.close();
  await pool.end();
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

await app.listen({ port: config.PORT, host: config.HOST });
