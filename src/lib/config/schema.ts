import { z } from "zod";

/**
 * Pure config schemas + validators — no `server-only` guard, so they are unit
 * testable. `server.ts` (which adds the `server-only` import) and `public.ts`
 * consume these. Keeping the schema here means a config-validation test never
 * trips the server-only barrier.
 */

export const serverEnvSchema = z.object({
  NESTJS_API_BASE_URL: z.string().url({ message: "NESTJS_API_BASE_URL must be a valid URL" }),
  AUTH_CSRF_SECRET: z.string().min(16, { message: "AUTH_CSRF_SECRET must be at least 16 characters" }),
  AUTH_COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  AUTH_COOKIE_SAMESITE: z.enum(["lax", "strict"]).default("lax"),
  USE_MOCK_NESTJS: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url({ message: "NEXT_PUBLIC_APP_URL must be a valid URL" }),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type PublicEnv = z.infer<typeof publicEnvSchema>;

/** Validate a raw env record against a schema; throw a readable error on failure. */
export function parseEnvOrThrow<T extends z.ZodTypeAny>(
  schema: T,
  raw: Record<string, unknown>,
  label: string,
): z.infer<T> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid ${label} environment configuration:\n${issues}`);
  }
  return parsed.data;
}
