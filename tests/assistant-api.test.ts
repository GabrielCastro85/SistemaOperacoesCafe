import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type pg from "pg";
import type { ServerConfig } from "../server/src/config.js";
import { registerAssistantRoutes } from "../server/src/assistant.js";

function fakePool(): pg.Pool {
  return {
    async query(sql: string) {
      if (sql.includes("FROM api_sessions")) {
        return { rows: [{ sessionId: "session", userId: "user", username: "gabriel", displayName: "Gabriel", deviceId: "device" }] };
      }
      if (sql.includes("UPDATE api_sessions") || sql.includes("INSERT INTO ai_usage_events")) return { rows: [] };
      if (sql.includes("SUM(input_tokens)")) return { rows: [{ input_tokens: "120", output_tokens: "30" }] };
      throw new Error(`SQL inesperado: ${sql}`);
    }
  } as unknown as pg.Pool;
}

const config = {
  OPENAI_API_KEY: "sk-test",
  OPENAI_MODEL: "gpt-6-luna",
  OPENAI_MAX_OUTPUT_TOKENS: 1800
} as ServerConfig;

afterEach(() => vi.unstubAllGlobals());

describe("assistant API", () => {
  it("exige sessao central e envia uma consulta somente leitura sem armazenar a resposta na OpenAI", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => new Response(JSON.stringify({
      output: [{ content: [{ type: "output_text", text: "Existem duas cobrancas em aberto." }] }],
      usage: { input_tokens: 20, output_tokens: 8 }
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const app = Fastify();
    registerAssistantRoutes(app, fakePool(), config);

    const unauthorized = await app.inject({ method: "POST", url: "/v1/assistant/chat", payload: { question: "Quais cobrancas?", context: {} } });
    expect(unauthorized.statusCode).toBe(401);

    const response = await app.inject({
      method: "POST",
      url: "/v1/assistant/chat",
      headers: { authorization: "Bearer test" },
      payload: { question: "Quais cobrancas?", context: { openCharges: [{ client: "Cliente A", openAmountCents: 12000 }] } }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      answer: "Existem duas cobrancas em aberto.",
      model: "gpt-6-luna",
      usage: { inputTokens: 20, outputTokens: 8, monthInputTokens: 120, monthOutputTokens: 30 }
    });
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(requestBody).toMatchObject({ model: "gpt-6-luna", store: false, max_output_tokens: 1800, reasoning: { effort: "minimal" } });
    expect(requestBody.instructions).toContain("somente leitura");
    expect(requestBody.input.at(-1).content).toContain("Cliente A");
    await app.close();
  });

  it("devolve erro controlado quando o provedor encerra a resposta antes de produzir texto", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      output: [{ type: "reasoning", content: [] }]
    }), { status: 200, headers: { "content-type": "application/json" } })));
    const app = Fastify();
    registerAssistantRoutes(app, fakePool(), config);
    const response = await app.inject({
      method: "POST",
      url: "/v1/assistant/chat",
      headers: { authorization: "Bearer test" },
      payload: { question: "Quais cobrancas?", context: {} }
    });
    expect(response.statusCode).toBe(502);
    expect(response.json()).toMatchObject({ error: "AI_INCOMPLETE_RESPONSE" });
    await app.close();
  });
});
