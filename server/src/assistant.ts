import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { z } from "zod";
import { resolveSession } from "./auth.js";
import type { ServerConfig } from "./config.js";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000)
});

const requestSchema = z.object({
  question: z.string().trim().min(2).max(2000),
  history: z.array(messageSchema).max(8).default([]),
  context: z.record(z.unknown())
});

type OpenAiResponse = {
  status?: string;
  incomplete_details?: { reason?: string } | null;
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
};

const MAX_CONTEXT_CHARACTERS = 12_000;

function compactValue(value: unknown, arrayLimit = 10): unknown {
  if (typeof value === "string") return value.slice(0, 500);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, arrayLimit).map((item) => compactValue(item, arrayLimit));
  if (typeof value === "object" && value) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 50)
        .map(([key, item]) => [key, compactValue(item, arrayLimit)])
    );
  }
  return undefined;
}

function buildBusinessContext(context: Record<string, unknown>): string {
  const compactAlerts = (limit: number): unknown => {
    const alerts = context.alerts;
    if (!alerts || typeof alerts !== "object" || Array.isArray(alerts)) return undefined;
    return Object.fromEntries(
      Object.entries(alerts as Record<string, unknown>)
        .slice(0, 20)
        .map(([key, value]) => [key, compactValue(value, limit)])
    );
  };
  const build = (alertLimit: number, chargeLimit: number, payableLimit: number) => ({
    generatedAt: compactValue(context.generatedAt),
    period: compactValue(context.period),
    activeCompany: compactValue(context.activeCompany),
    operational: compactValue(context.operational),
    billing: compactValue(context.billing),
    financial: compactValue(context.financial),
    openCharges: compactValue(context.openCharges, chargeLimit),
    openPayables: compactValue(context.openPayables, payableLimit),
    collectors: compactValue(context.collectors, 10),
    alerts: compactAlerts(alertLimit)
  });

  let result = build(5, 60, 40);
  let serialized = JSON.stringify(result);
  if (serialized.length > MAX_CONTEXT_CHARACTERS) {
    result = build(2, 40, 20);
    serialized = JSON.stringify(result);
  }
  if (serialized.length > MAX_CONTEXT_CHARACTERS) {
    result.alerts = undefined;
    serialized = JSON.stringify(result);
  }
  return serialized.slice(0, MAX_CONTEXT_CHARACTERS);
}

function extractAnswer(response: OpenAiResponse): string | null {
  if (response.output_text?.trim()) return response.output_text.trim();
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text?.trim()) return content.text.trim();
    }
  }
  return null;
}

export function registerAssistantRoutes(app: FastifyInstance, pool: pg.Pool, config: ServerConfig): void {
  app.post("/v1/assistant/chat", async (request, reply) => {
    const session = await resolveSession(pool, request);
    if (!session) return reply.code(401).send({ error: "UNAUTHORIZED" });
    if (!config.OPENAI_API_KEY) return reply.code(503).send({ error: "AI_NOT_CONFIGURED", message: "O Assistente ainda nao foi configurado no servidor." });

    const input = requestSchema.parse(request.body);
    const businessContext = buildBusinessContext(input.context);
    const messages = [
      ...input.history.map((message) => ({ role: message.role, content: message.content })),
      {
        role: "user" as const,
        content: `${input.question}\n\nDADOS ATUAIS DO SISTEMA (valores monetarios estao em centavos):\n${businessContext}`
      }
    ];

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: {
        authorization: `Bearer ${config.OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: config.OPENAI_MODEL,
        store: false,
        max_output_tokens: config.OPENAI_MAX_OUTPUT_TOKENS,
        reasoning: { effort: "none" },
        instructions: [
          "Voce e o Assistente do sistema GraoBase, para operacoes de cafe.",
          "Responda sempre em portugues brasileiro, de forma direta e clara.",
          "Use somente os dados atuais fornecidos nesta solicitacao.",
          "Nunca invente numeros, nomes, pagamentos ou status.",
          "Quando os dados nao forem suficientes, diga exatamente o que nao foi encontrado.",
          "Esta versao e somente leitura: explique o que o usuario pode fazer, mas nao afirme que alterou dados.",
          "Ao citar dinheiro recebido em centavos, converta para reais no formato brasileiro."
        ].join(" "),
        input: messages
      })
    });

    const payload = await openAiResponse.json() as OpenAiResponse;
    if (!openAiResponse.ok) {
      const detail = payload.error?.message ?? "Falha ao consultar a OpenAI.";
      request.log.error({ status: openAiResponse.status, detail }, "OpenAI request failed");
      return reply.code(openAiResponse.status === 429 ? 429 : 502).send({
        error: openAiResponse.status === 429 ? "AI_LIMIT_REACHED" : "AI_PROVIDER_ERROR",
        message: openAiResponse.status === 429 ? "O limite mensal do Assistente foi atingido. Tente novamente no proximo ciclo." : "O Assistente esta temporariamente indisponivel."
      });
    }

    const answer = extractAnswer(payload);
    if (!answer) {
      request.log.warn({ status: payload.status, reason: payload.incomplete_details?.reason }, "OpenAI returned no assistant text");
      return reply.code(502).send({
        error: "AI_INCOMPLETE_RESPONSE",
        message: payload.incomplete_details?.reason === "max_output_tokens"
          ? "O Assistente precisou processar muitos dados. Tente novamente com uma pergunta mais especifica."
          : "O Assistente nao conseguiu concluir esta resposta. Tente novamente."
      });
    }
    const inputTokens = Math.max(0, Number(payload.usage?.input_tokens ?? 0));
    const outputTokens = Math.max(0, Number(payload.usage?.output_tokens ?? 0));
    await pool.query(
      "INSERT INTO ai_usage_events(id, user_id, model, input_tokens, output_tokens) VALUES ($1, $2, $3, $4, $5)",
      [randomUUID(), session.userId, config.OPENAI_MODEL, inputTokens, outputTokens]
    );
    const month = await pool.query<{ input_tokens: string; output_tokens: string }>(`
      SELECT COALESCE(SUM(input_tokens), 0)::text AS input_tokens,
             COALESCE(SUM(output_tokens), 0)::text AS output_tokens
      FROM ai_usage_events
      WHERE created_at >= date_trunc('month', now())
    `);
    return {
      answer,
      model: config.OPENAI_MODEL,
      usage: {
        inputTokens,
        outputTokens,
        monthInputTokens: Number(month.rows[0]?.input_tokens ?? 0),
        monthOutputTokens: Number(month.rows[0]?.output_tokens ?? 0)
      }
    };
  });
}
