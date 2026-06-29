import "server-only";
import { parseEnvOrThrow, serverEnvSchema, type ServerEnv } from "./schema";

/**
 * SERVER-ONLY config — the NestJS API base, cookie secrets, and cookie policy.
 * The `server-only` import makes importing this from a client component a build
 * error, so these never leak into the browser bundle (ADR-0003 F5/§9).
 *
 * Fail-fast: a missing/invalid required var throws a clear schema error at first
 * access (so dev boot surfaces config problems immediately).
 */
let cached: ServerEnv | null = null;

export function getServerConfig(): ServerEnv {
  if (cached) return cached;
  cached = parseEnvOrThrow(
    serverEnvSchema,
    {
      NESTJS_API_BASE_URL: process.env.NESTJS_API_BASE_URL,
      AUTH_CSRF_SECRET: process.env.AUTH_CSRF_SECRET,
      AUTH_COOKIE_SECURE: process.env.AUTH_COOKIE_SECURE,
      AUTH_COOKIE_SAMESITE: process.env.AUTH_COOKIE_SAMESITE,
      USE_MOCK_NESTJS: process.env.USE_MOCK_NESTJS,
    },
    "server",
  );
  return cached;
}

export type { ServerEnv };
