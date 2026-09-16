import { z } from "zod";

const booleanFromText = z.string().default("false").transform((value) => value.toLowerCase() === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: booleanFromText,
  SESSION_TTL_HOURS: z.coerce.number().positive().max(168).default(12),
  CORS_ORIGINS: z.string().default("http://localhost:5173")
});

export type ServerConfig = ReturnType<typeof loadConfig>;

export function loadConfig() {
  const parsed = schema.parse(process.env);
  return {
    ...parsed,
    corsOrigins: parsed.CORS_ORIGINS.split(",").map((item) => item.trim()).filter(Boolean)
  };
}

