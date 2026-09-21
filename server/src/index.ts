import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { ZodError } from "zod";
import { loadConfig } from "./config.js";
import { createPool, runCentralMigrations } from "./database.js";
import { registerAuthRoutes } from "./auth.js";
import { registerBootstrapRoutes } from "./bootstrap.js";
import { registerSqliteImportRoutes } from "./sqliteImport.js";
import { registerSyncRoutes } from "./sync.js";
import { registerViewerRoutes } from "./viewer.js";

const config = loadConfig();
const pool = createPool(config);
await runCentralMigrations(pool);

const app = Fastify({ logger: true, trustProxy: true, bodyLimit: 2 * 1024 * 1024 });
await app.register(helmet, { crossOriginResourcePolicy: { policy: "cross-origin" } });
await app.register(cors, {
  origin: Array.from(new Set([...config.corsOrigins, "https://gabrielcastro85.github.io"])),
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
