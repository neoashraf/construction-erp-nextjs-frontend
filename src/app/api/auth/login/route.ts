import { NextRequest, NextResponse } from "next/server";
import { callUpstream } from "@/lib/bff/upstream";
import { setAuthCookies } from "@/lib/bff/cookies";
import { generateCsrfToken } from "@/lib/bff/csrf";
import { errorResponse } from "@/lib/bff/responses";
import { type SafeUser } from "@/lib/auth/session";

/**
 * BFF login (skill §4, ADR-0003 F5; API contract 05 /api/auth/login).
 * Calls NestJS /auth/login; on success sets httpOnly access+refresh+session
 * cookies and a CSRF cookie, returning ONLY the safe `user` to the browser.
 * Tokens are NEVER sent to client JS.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "VALIDATION_ERROR", "Request body must be JSON");
  }

  const upstream = await callUpstream({ path: "/auth/login", method: "POST", json: body });

  if (upstream.status !== 200) {
    // Pass the backend's error envelope + status straight through (uniform
    // INVALID_CREDENTIALS, VALIDATION_ERROR, etc.).
    return NextResponse.json(upstream.body, { status: upstream.status });
  }

  const { data } = upstream.body as {
    data: {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      user: SafeUser;
    };
  };

  const csrfToken = generateCsrfToken();
  // Return only the safe user; tokens go into httpOnly cookies on this response.
  const res = NextResponse.json({ user: data.user }, { status: 200 });
  setAuthCookies(
    res,
    {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn,
      user: data.user,
    },
    csrfToken,
  );
  return res;
}
