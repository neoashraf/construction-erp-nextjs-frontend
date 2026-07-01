import { NextRequest, NextResponse } from "next/server";
import { callUpstream } from "@/lib/bff/upstream";
import { rotateAccessCookie, clearAuthCookies } from "@/lib/bff/cookies";
import { errorResponse } from "@/lib/bff/responses";
import { REFRESH_COOKIE } from "@/lib/auth/session";

/**
 * BFF refresh (skill §4; API contract 05 /api/auth/refresh). Reads the httpOnly
 * refresh cookie, calls NestJS /auth/refresh, rotates the access (and refresh)
 * cookies on success. On failure it clears all auth cookies and signals re-login.
 * The proxy calls this internally on a TOKEN_EXPIRED 401; it is also a usable
 * standalone endpoint.
 */
export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    const res = errorResponse(401, "INVALID_CREDENTIALS", "No refresh token");
    clearAuthCookies(res);
    return res;
  }

  const upstream = await callUpstream({
    path: "/auth/refresh",
    method: "POST",
    json: { refreshToken },
  });

  if (upstream.status !== 200) {
    const res = NextResponse.json(upstream.body, { status: upstream.status });
    clearAuthCookies(res);
    return res;
  }

  const { data } = upstream.body as {
    data: { accessToken: string; expiresIn: number; refreshToken?: string };
  };
  const res = NextResponse.json({ ok: true }, { status: 200 });
  rotateAccessCookie(res, data.accessToken, data.expiresIn, data.refreshToken);
  return res;
}
