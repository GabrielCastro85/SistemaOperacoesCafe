import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type pg from "pg";
import { z } from "zod";
import type { ServerConfig } from "./config.js";
import { resolveSession } from "./auth.js";

const uploadSchema = z.object({
  sourceCode: z.string().trim().regex(/^[A-Z0-9_-]{2,60}$/),
  sourceLabel: z.string().trim().min(2).max(120),
  machineId: z.string().trim().min(4).max(200),
  originalFileName: z.string().trim().min(1).max(260),
  fileHash: z.string().regex(/^[a-f0-9]{64}$/),
  fileSize: z.number().int().positive().max(1_500_000),
  accessKey: z.string().regex(/^\d{44}$/).nullable(),
  xmlType: z.enum(["NFE", "CANCELLATION"]),
  xmlBase64: z.string().min(4).max(2_000_000)
});

function collectorAuthorized(config: ServerConfig, request: FastifyRequest): boolean {
  const supplied = request.headers.authorization?.startsWith("Bearer ") ? request.headers.authorization.slice(7) : "";
  const expected = config.COLLECTOR_INGEST_SECRET ?? "";
  if (!supplied || !expected) return false;
  const left = Buffer.from(createHash("sha256").update(supplied).digest());
  const right = Buffer.from(createHash("sha256").update(expected).digest());
  return timingSafeEqual(left, right);
}

export function registerCollectorRoutes(app: FastifyInstance, pool: pg.Pool, config: ServerConfig): void {
  app.get("/v1/collector/ping", async (request, reply) => {
    if (!collectorAuthorized(config, request)) return reply.code(401).send({ error: "COLLECTOR_UNAUTHORIZED" });
    return { status: "ready" };
  });

  app.post("/v1/collector/files", { bodyLimit: 2 * 1024 * 1024 }, async (request, reply) => {
    if (!collectorAuthorized(config, request)) return reply.code(401).send({ error: "COLLECTOR_UNAUTHORIZED" });
    const input = uploadSchema.parse(request.body);
    const content = Buffer.from(input.xmlBase64, "base64");
    if (content.length !== input.fileSize || createHash("sha256").update(content).digest("hex") !== input.fileHash) {
      return reply.code(400).send({ error: "FILE_INTEGRITY_MISMATCH" });
    }
    const existing = await pool.query<{ id: string; status: string }>(
      "SELECT id, status FROM collector_inbox_files WHERE source_code = $1 AND file_hash = $2",
      [input.sourceCode, input.fileHash]
    );
    if (existing.rows[0]) return { id: existing.rows[0].id, status: existing.rows[0].status, reused: true };
    const id = randomUUID();
    await pool.query(`
      INSERT INTO collector_inbox_files(
        id, source_code, source_label, machine_id, original_file_name, file_hash, file_size,
        access_key, xml_type, xml_content
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `, [id, input.sourceCode, input.sourceLabel, input.machineId, input.originalFileName, input.fileHash, input.fileSize, input.accessKey, input.xmlType, content]);
    return reply.code(201).send({ id, status: "PENDING", reused: false });
  });

  app.get("/v1/collector/inbox", async (request, reply) => {
    const session = await resolveSession(pool, request);
    if (!session) return reply.code(401).send({ error: "UNAUTHORIZED" });
    const query = z.object({ source: z.string().trim().regex(/^[A-Z0-9_-]{2,60}$/), limit: z.coerce.number().int().min(1).max(1000).default(500) }).parse(request.query);
    const rows = await pool.query(`
      SELECT id, source_code AS "sourceCode", source_label AS "sourceLabel", original_file_name AS "originalFileName",
        file_hash AS "fileHash", file_size AS "fileSize", access_key AS "accessKey", xml_type AS "xmlType", received_at AS "receivedAt"
      FROM collector_inbox_files WHERE source_code = $1 AND status = 'PENDING'
      ORDER BY received_at, id LIMIT $2
    `, [query.source, query.limit]);
    return { files: rows.rows };
  });

  app.get("/v1/collector/inbox/:id/content", async (request, reply) => {
    const session = await resolveSession(pool, request);
    if (!session) return reply.code(401).send({ error: "UNAUTHORIZED" });
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const result = await pool.query<{ xml_content: Buffer }>("SELECT xml_content FROM collector_inbox_files WHERE id = $1 AND status = 'PENDING'", [id]);
    if (!result.rows[0]) return reply.code(404).send({ error: "COLLECTOR_FILE_NOT_FOUND" });
    return { xmlBase64: result.rows[0].xml_content.toString("base64") };
  });

  app.patch("/v1/collector/inbox/:id/resolve", async (request, reply) => {
    const session = await resolveSession(pool, request);
    if (!session) return reply.code(401).send({ error: "UNAUTHORIZED" });
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const input = z.object({ status: z.enum(["IMPORTED", "IGNORED"]), note: z.string().trim().max(500).nullable().optional() }).parse(request.body);
    const result = await pool.query(`
      UPDATE collector_inbox_files SET status = $1, resolution_note = $2, resolved_at = now(), resolved_by_user_id = $3
      WHERE id = $4 AND status = 'PENDING' RETURNING id
    `, [input.status, input.note ?? null, session.userId, id]);
    if (!result.rowCount) return reply.code(404).send({ error: "COLLECTOR_FILE_NOT_FOUND" });
    return { id, status: input.status };
  });
}
