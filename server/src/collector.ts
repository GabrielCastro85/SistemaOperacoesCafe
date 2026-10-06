import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type pg from "pg";
import { z } from "zod";
import type { ServerConfig } from "./config.js";
import { resolveSession } from "./auth.js";

const releaseOwner = "GabrielCastro85";
const releaseRepository = "SistemaOperacoesCafe-releases";

function applicationVersion(): string {
  try {
    const value = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { version?: unknown };
    return typeof value.version === "string" ? value.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

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

const heartbeatSchema = z.object({
  sourceCode: z.string().trim().regex(/^[A-Z0-9_-]{2,60}$/),
  sourceLabel: z.string().trim().min(2).max(120),
  machineId: z.string().trim().min(4).max(200),
  emitterCnpjs: z.array(z.string().regex(/^\d{14}$/)).min(1).max(20),
  collectorVersion: z.string().trim().max(40).nullable().optional(),
  scanIntervalSeconds: z.number().int().min(15).max(86_400),
  status: z.enum(["OK", "PENDING_RETRY", "ERROR"]),
  inspected: z.number().int().nonnegative().default(0),
  eligible: z.number().int().nonnegative().default(0),
  uploaded: z.number().int().nonnegative().default(0),
  pendingUpload: z.number().int().nonnegative().default(0),
  error: z.string().trim().max(1000).nullable().optional()
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

  app.get("/v1/collector/update", async (request, reply) => {
    if (!collectorAuthorized(config, request)) return reply.code(401).send({ error: "COLLECTOR_UNAUTHORIZED" });
    const latestVersion = applicationVersion();
    const fileName = `ColetorGraoBase-${latestVersion}-portable.exe`;
    const releaseBase = `https://github.com/${releaseOwner}/${releaseRepository}/releases/download/v${latestVersion}`;
    const checksumResponse = await fetch(`${releaseBase}/${fileName}.sha256`, { redirect: "follow" });
    if (!checksumResponse.ok) return { available: false, latestVersion };
    const checksum = (await checksumResponse.text()).trim().split(/\s+/)[0]?.toLowerCase() ?? "";
    if (!/^[a-f0-9]{64}$/.test(checksum)) return { available: false, latestVersion };
    return {
      available: true,
      latestVersion,
      downloadUrl: `${releaseBase}/${fileName}`,
      sha256: checksum
    };
  });

  app.post("/v1/collector/heartbeat", async (request, reply) => {
    if (!collectorAuthorized(config, request)) return reply.code(401).send({ error: "COLLECTOR_UNAUTHORIZED" });
    const input = heartbeatSchema.parse(request.body);
    await pool.query(`
      INSERT INTO collector_status(
        source_code, machine_id, source_label, emitter_cnpjs, collector_version,
        scan_interval_seconds, status, inspected, eligible, uploaded, pending_upload,
        last_scan_at, last_success_at, last_upload_at, last_error, updated_at
      ) VALUES (
        $1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,
        now(), CASE WHEN $7 = 'OK' THEN now() ELSE NULL END,
        CASE WHEN $10 > 0 THEN now() ELSE NULL END, $12, now()
      )
      ON CONFLICT (source_code, machine_id) DO UPDATE SET
        source_label = excluded.source_label,
        emitter_cnpjs = excluded.emitter_cnpjs,
        collector_version = excluded.collector_version,
        scan_interval_seconds = excluded.scan_interval_seconds,
        status = excluded.status,
        inspected = excluded.inspected,
        eligible = excluded.eligible,
        uploaded = excluded.uploaded,
        pending_upload = excluded.pending_upload,
        last_scan_at = now(),
        last_success_at = CASE WHEN excluded.status = 'OK' THEN now() ELSE collector_status.last_success_at END,
        last_upload_at = CASE WHEN excluded.uploaded > 0 THEN now() ELSE collector_status.last_upload_at END,
        last_error = excluded.last_error,
        updated_at = now()
    `, [
      input.sourceCode, input.machineId, input.sourceLabel, JSON.stringify(input.emitterCnpjs),
      input.collectorVersion ?? null, input.scanIntervalSeconds, input.status,
      input.inspected, input.eligible, input.uploaded, input.pendingUpload, input.error ?? null
    ]);
    return { status: "received", receivedAt: new Date().toISOString() };
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

  app.get("/v1/collector/status", async (request, reply) => {
    const session = await resolveSession(pool, request);
    if (!session) return reply.code(401).send({ error: "UNAUTHORIZED" });
    const result = await pool.query(`
      SELECT
        status.source_code AS "sourceCode",
        status.source_label AS "sourceLabel",
        status.machine_id AS "machineId",
        status.emitter_cnpjs AS "emitterCnpjs",
        status.collector_version AS "collectorVersion",
        status.scan_interval_seconds AS "scanIntervalSeconds",
        status.status,
        status.inspected,
        status.eligible,
        status.uploaded,
        status.pending_upload AS "pendingUpload",
        status.last_scan_at AS "lastScanAt",
        status.last_success_at AS "lastSuccessAt",
        status.last_upload_at AS "lastUploadAt",
        status.last_error AS "lastError",
        status.updated_at AS "updatedAt",
        COALESCE(inbox.pending_count, 0)::integer AS "pendingFiles",
        inbox.last_received_at AS "lastFileReceivedAt"
      FROM collector_status status
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE files.status = 'PENDING') AS pending_count,
          MAX(files.received_at) AS last_received_at
        FROM collector_inbox_files files
        WHERE files.source_code = status.source_code AND files.machine_id = status.machine_id
      ) inbox ON true
      ORDER BY status.updated_at DESC, status.source_label, status.machine_id
    `);
    const now = Date.now();
    return {
      collectors: result.rows.map((row: Record<string, unknown>) => ({
        ...row,
        online: now - new Date(String(row.updatedAt)).getTime() <= Math.max(Number(row.scanIntervalSeconds) * 3, 180) * 1000
      }))
    };
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
