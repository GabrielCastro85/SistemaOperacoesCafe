import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { promisify } from "node:util";
import { gzip } from "node:zlib";
import { z } from "zod";

const gzipAsync = promisify(gzip);
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
const batchSchema = z.object({
  calls: z.array(z.object({ channel: z.string().min(3).max(120), payload: z.unknown().optional() })).min(1).max(200)
});
const uploadSchema = z.object({ name: z.string().min(1).max(260), base64: z.string().min(1) });

// Respostas grandes (lista de notas chega a ~9 MB) vao compactadas: o JSON
// encolhe ~10x e atravessa a internet bem mais rapido.
async function sendJson(request: FastifyRequest, reply: FastifyReply, data: unknown): Promise<FastifyReply> {
  const text = JSON.stringify(data);
  reply.header("Content-Type", "application/json; charset=utf-8");
  reply.header("Vary", "Accept-Encoding");
  if (text.length > 4096 && /\bgzip\b/.test(String(request.headers["accept-encoding"] ?? ""))) {
    reply.header("Content-Encoding", "gzip");
    return reply.send(await gzipAsync(text, { level: 6 }));
  }
  return reply.send(text);
}

export function registerAppEngineRoutes(app: FastifyInstance, loadEngine: () => Promise<Engine>): void {
  app.post("/v1/app/rpc", { bodyLimit: 25 * 1024 * 1024 }, async (request, reply) => {
    const session = sessionSchema.safeParse(request.headers["x-app-session"]);
    if (!session.success) return reply.code(401).send({ ok: false, error: { message: "Sessao do site invalida.", code: "SESSION_REQUIRED" } });
    const input = rpcSchema.parse(request.body);
    const engine = await loadEngine();
    return sendJson(request, reply, await engine.invoke(session.data, input.channel, input.payload, input.uploadIds ?? null));
  });

  // Varias consultas num pedido so (o site junta as que a tela dispara ao
  // mesmo tempo). Rodam em ordem, cada uma como uma chamada normal do motor.
  app.post("/v1/app/rpc-batch", { bodyLimit: 25 * 1024 * 1024 }, async (request, reply) => {
    const session = sessionSchema.safeParse(request.headers["x-app-session"]);
    if (!session.success) return reply.code(401).send({ ok: false, error: { message: "Sessao do site invalida.", code: "SESSION_REQUIRED" } });
    const input = batchSchema.parse(request.body);
    const engine = await loadEngine();
    const results: unknown[] = [];
    for (const call of input.calls) results.push(await engine.invoke(session.data, call.channel, call.payload, null));
    return sendJson(request, reply, { results });
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
