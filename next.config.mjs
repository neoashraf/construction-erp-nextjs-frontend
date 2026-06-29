import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the file-tracing root to this repo so an unrelated parent lockfile isn't
  // inferred as the workspace root (this is a standalone repo — ADR-0003 F10).
  outputFileTracingRoot: __dirname,
  // The NestJS API base is server-only (used by the BFF route handlers, lib/config/server).
  // It is deliberately NOT exposed via env.NEXT_PUBLIC_* — the browser only ever talks to the BFF.
};

export default nextConfig;
