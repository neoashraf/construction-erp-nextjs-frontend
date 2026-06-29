import { NextRequest, NextResponse } from "next/server";
import { callUpstream } from "@/lib/bff/upstream";
import { clearAuthCookies } from "@/lib/bff/cookies";
import { isCsrfValid } from "@/lib/bff/csrf";
import { errorResponse } from "@/lib/bff/responses";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/session";

/**
 * BFF logout (skill §4; API contract 05 /api/auth/logout). Calls NestJS logout to
 * revoke the refresh token's jti, then clears every auth cookie. Idempotent (a
 * 204 even if already revoked). State-changing → CSRF-checked.
 */
export async function POST(req: NextRequest) {
  if (!isCsrfValid(req)) {
    return errorResponse(403, "FORBIDDEN", "CSRF token missing or invalid");
  }

  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;

  // Best-effort upstream revoke; clear cookies regardless of upstream outcome.
  if (refreshToken) {
    await callUpstream({
      path: "/auth/logout",
      method: "POST",
      json: { refreshToken },
      bearer: accessToken,
    });
  }

  const res = new NextResponse(null, { status: 204 });
  clearAuthCookies(res);
  return res;
}
