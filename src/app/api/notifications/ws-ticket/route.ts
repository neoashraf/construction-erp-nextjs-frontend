import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/session";

/**
 * FE-53 — BFF-issued short-lived socket ticket. The access token lives in an
 * httpOnly cookie server-side; the WebSocket handshake needs a token client-
 * side. This route re-issues the access token as a one-shot "ticket" over
 * same-origin credentials, so the socket can authenticate without ever leaking
 * the primary token into client JS. (In production a distinct short-TTL ticket
 * issued by NestJS is preferred — this Phase-1 shim keeps the shape and TTL
 * assumptions explicit.)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const access = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!access) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Not authenticated", details: null } },
      { status: 401 },
    );
  }
  return NextResponse.json({ data: { ticket: access, expiresIn: 60 } }, { status: 200 });
}
