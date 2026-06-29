import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callUpstream } from "./upstream";
import { rotateAccessCookie, clearAuthCookies } from "./cookies";
import { isCsrfValid } from "./csrf";
import { errorResponse, upstreamErrorCode } from "./responses";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/session";

/**
 * The BFF API proxy (skill §4, ADR-0003 F5). For any `/api/<segments>` request
 * that is NOT one of the dedicated auth handlers, it:
 *  1. attaches the bearer from the httpOnly access cookie,
 *  2. forwards to NestJS,
 *  3. on a `TOKEN_EXPIRED` 401, calls /auth/refresh (refresh cookie), ROTATES the
 *     cookies, and RETRIES the original request once,
 *  4. on refresh failure, CLEARS cookies and signals re-login (401 INVALID_CREDENTIALS).
 * State-changing methods are CSRF-checked (double-submit).
 */

const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function buildResponse(status: number, body: unknown): NextResponse {
  if (status === 204 || body === null || body === undefined) {
    return new NextResponse(null, { status });
  }
  return NextResponse.json(body, { status });
}

/** Forward one request to NestJS with the given bearer. */
async function forward(upstreamPath: string, method: string, json: unknown, bearer?: string) {
  return callUpstream({ path: upstreamPath, method, json, bearer });
}

/**
 * Handle a proxied request. `segments` is the path after `/api` (e.g. ["auth","me"]
 * or ["ledger","journal-entries"]).
 */
export async function handleProxy(req: NextRequest, segments: string[]): Promise<NextResponse> {
  // CSRF for state-changing requests (defence in depth alongside SameSite cookies).
  if (STATE_CHANGING.has(req.method.toUpperCase()) && !isCsrfValid(req)) {
    return errorResponse(403, "FORBIDDEN", "CSRF token missing or invalid");
  }

  const upstreamPath = `/${segments.join("/")}`;
  const search = req.nextUrl.search; // preserve ?page=&pageSize= etc.
  const fullPath = `${upstreamPath}${search}`;

  let json: unknown = undefined;
  if (STATE_CHANGING.has(req.method.toUpperCase())) {
    try {
      const text = await req.text();
      json = text ? JSON.parse(text) : undefined;
    } catch {
      return errorResponse(400, "VALIDATION_ERROR", "Request body must be JSON");
    }
  }

  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;

  if (!accessToken) {
    const res = errorResponse(401, "UNAUTHORIZED", "Not authenticated");
    clearAuthCookies(res);
    return res;
  }

  // First attempt.
  let upstream = await forward(fullPath, req.method, json, accessToken);

  // Refresh-on-401 (only for an expired access token, and only if we have a refresh token).
  if (upstream.status === 401 && upstreamErrorCode(upstream.body) === "TOKEN_EXPIRED" && refreshToken) {
    const refreshed = await callUpstream({
      path: "/auth/refresh",
      method: "POST",
      json: { refreshToken },
    });

    if (refreshed.status !== 200) {
      // Refresh failed → clear cookies, signal re-login.
      const res = errorResponse(401, "INVALID_CREDENTIALS", "Session expired, please log in again");
      clearAuthCookies(res);
      return res;
    }

    const data = refreshed.body as { accessToken: string; expiresIn: number; refreshToken?: string };
    // Retry the original request once with the new access token.
    upstream = await forward(fullPath, req.method, json, data.accessToken);

    const res = buildResponse(upstream.status, upstream.body);
    rotateAccessCookie(res, data.accessToken, data.expiresIn, data.refreshToken);
    return res;
  }

  // A FORBIDDEN-deactivated (account turned off) → clear cookies so the UI logs out.
  if (upstream.status === 403 && upstreamErrorCode(upstream.body) === "FORBIDDEN") {
    const res = buildResponse(upstream.status, upstream.body);
    // Leave cookies in place for ordinary role/scope 403s; only force-logout on
    // deactivation is handled client-side. We keep the body so the UI can decide.
    return res;
  }

  return buildResponse(upstream.status, upstream.body);
}
