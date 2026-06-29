import { parseEnvOrThrow, publicEnvSchema, type PublicEnv } from "./schema";

/**
 * PUBLIC config — values safe to expose to the browser. Only `NEXT_PUBLIC_*`
 * vars belong here. NEVER add the NestJS host or any secret (ADR-0003 F5/§9).
 *
 * Validated with zod; a missing/invalid required var throws a clear schema error
 * at first access (fail-fast). Next.js inlines NEXT_PUBLIC_* at build time, so
 * they must be referenced statically.
 */
let cached: PublicEnv | null = null;

export function getPublicConfig(): PublicEnv {
  if (cached) return cached;
  cached = parseEnvOrThrow(
    publicEnvSchema,
    {
      // Referenced statically so Next.js can inline it.
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    },
    "public",
  );
  return cached;
}

export type { PublicEnv };
