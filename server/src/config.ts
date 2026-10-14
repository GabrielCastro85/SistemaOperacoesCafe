import { z } from "zod";

const booleanFromText = z.string().default("false").transform((value) => value.toLowerCase() === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: booleanFromText,
  SESSION_TTL_HOURS: z.coerce.number().positive().max(168).default(12),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  BOOTSTRAP_SECRET: z.string().min(24).optional(),
  COLLECTOR_INGEST_SECRET: z.string().min(32).optional(),
  OPENAI_API_KEY: z.string().startsWith("sk-").optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-6-luna"),
  OPENAI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(200).max(4000).default(1800)
});

export type ServerConfig = ReturnType<typeof loadConfig>;

export function loadConfig() {
  const parsed = schema.parse(process.env);
  return {
    ...parsed,
    corsOrigins: parsed.CORS_ORIGINS.split(",").map((item) => item.trim()).filter(Boolean)
  };
}
