import "server-only";
import { getServerConfig } from "@/lib/config/server";
import { mockNestjsFetch } from "./mock-nestjs";

/**
 * The BFF → NestJS bridge. The browser NEVER talks to NestJS directly; only this
 * server-side caller does (ADR-0003 F5). It targets the server-only
 * `NESTJS_API_BASE_URL`. When `USE_MOCK_NESTJS=true` (e2e / dev without a live
 * backend) it routes to an in-process mock instead, so the BFF + auth flow are
 * exercisable end-to-end. Never enable the mock in production.
 */

export interface UpstreamResult {
  status: number;
  /** Parsed JSON body, or null for 204 / empty. */
  body: unknown;
}

interface UpstreamRequest {
  path: string; // e.g. "/auth/login" (relative to the API base)
  method: string;
  json?: unknown;
  /** Bearer token to attach (for proxied authenticated calls). */
  bearer?: string;
}

async function realFetch(req: UpstreamRequest): Promise<UpstreamResult> {
  const cfg = getServerConfig();
  const headers: Record<string, string> = { accept: "application/json" };
  if (req.json !== undefined) headers["content-type"] = "application/json";
  if (req.bearer) headers["authorization"] = `Bearer ${req.bearer}`;

  const res = await fetch(`${cfg.NESTJS_API_BASE_URL}${req.path}`, {
    method: req.method,
    headers,
    body: req.json !== undefined ? JSON.stringify(req.json) : undefined,
    // Server-to-server; cookies are not forwarded — auth is the bearer header.
    cache: "no-store",
  });

  if (res.status === 204) return { status: 204, body: null };
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.status, body };
}

/** Call the NestJS API (or the mock). Returns status + parsed body; never throws on non-2xx. */
export async function callUpstream(req: UpstreamRequest): Promise<UpstreamResult> {
  const cfg = getServerConfig();
  if (cfg.USE_MOCK_NESTJS) {
    return mockNestjsFetch(req);
  }
  return realFetch(req);
}
