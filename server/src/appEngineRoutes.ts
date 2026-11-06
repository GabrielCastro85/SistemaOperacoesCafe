import type { FastifyInstance } from "fastify";
import { z } from "zod";
// Formato do motor montado em dist-engine/host.mjs (server/engine/host.ts).
export interface Engine {
  invoke(webSessionId: string, channel: string, payload: unknown, uploadIds?: string[] | null): Promise<unknown>;
  saveUpload(name: string, content: Buffer): { id: string; path: string; name: string };
}

// Rotas do site completo (mesmas telas do app): cada chamada de
// window.operationsCafe vira POST /v1/app/rpc e roda no motor do app
// (server/engine/host.ts). O cabecalho x-app-session identifica a sessao do
// navegador; o login e as permissoes sao os do proprio app.

const sessionSchema = z.string().regex(/^[a-f0-9]{48,128}$/, "Sessao do site invalida.");
const rpcSchema = z.object({
  channel: z.string().min(3).max(120),
  payload: z.unknown().optional(),
  uploadIds: z.array(z.string()).max(500).nullable().optional()
});
const uploadSchema = z.object({ name: z.string().min(1).max(260), base64: z.string().min(1) });

export function registerAppEngineRoutes(app: FastifyInstance, loadEngine: () => Promise<Engine>): void {
  app.post("/v1/app/rpc", { bodyLimit: 25 * 1024 * 1024 }, async (request, reply) => {
    const session = sessionSchema.safeParse(request.headers["x-app-session"]);
    if (!session.success) return reply.code(401).send({ ok: false, error: { message: "Sessao do site invalida.", code: "SESSION_REQUIRED" } });
    const input = rpcSchema.parse(request.body);
    const engine = await loadEngine();
    return engine.invoke(session.data, input.channel, input.payload, input.uploadIds ?? null);
  });

  app.post("/v1/app/upload", { bodyLimit: 60 * 1024 * 1024 }, async (request, reply) => {
    const session = sessionSchema.safeParse(request.headers["x-app-session"]);
    if (!session.success) return reply.code(401).send({ error: "SESSION_REQUIRED", message: "Sessao do site invalida." });
    const input = uploadSchema.parse(request.body);
    const content = Buffer.from(input.base64, "base64");
    if (content.length > 40 * 1024 * 1024) return reply.code(413).send({ error: "TOO_LARGE", message: "Arquivo maior que 40 MB." });
    const engine = await loadEngine();
    const saved = engine.saveUpload(input.name, content);
    return { id: saved.id, name: saved.name, path: saved.path };
  });
}
