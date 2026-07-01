import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getServerConfig } from "@/lib/config/server";
import { callUpstream } from "@/lib/bff/upstream";
import { rotateAccessCookie, clearAuthCookies } from "@/lib/bff/cookies";
import { errorResponse } from "@/lib/bff/responses";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/session";

/**
 * Dedicated BFF route for `GET /api/audit-logs/export` (FR-AUD-028).
 *
 * The generic catch-all proxy (`app/api/[...path]/route.ts` -> `lib/bff/proxy.ts`)
 * is JSON-only: `callUpstream`/`realFetch` always does `res.text()` -> `JSON.parse`,
 * and the proxy always replies with `NextResponse.json(...)`, discarding upstream
 * headers. The real export endpoint returns a binary/text FILE (`StreamableFile`,
 * `Content-Type: text/csv` or the xlsx mime type, `Content-Disposition: attachment`)
 * — piping that through the generic proxy would corrupt the file and drop the
 * filename. This route instead streams the upstream response body and the
 * `Content-Type`/`Content-Disposition` headers straight through, unparsed.
 *
 * Same cookie-bearer bridge as the generic proxy, including one refresh-and-retry
 * on an expired access token, so the export CTA behaves like every other
 * authenticated call from the user's point of view.
 */

async function forwardExport(search: string, bearer: string): Promise<Response> {
  const cfg = getServerConfig();
  return fetch(`${cfg.NESTJS_API_BASE_URL}/audit-logs/export${search}`, {
    method: "GET",
    headers: { authorization: `Bearer ${bearer}` },
    cache: "no-store",
  });
}

function isJsonErrorResponse(res: Response): boolean {
  const type = res.headers.get("content-type") ?? "";
  return type.includes("application/json");
}

async function streamBack(upstream: Response): Promise<NextResponse> {
  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  const disposition = upstream.headers.get("content-disposition");
  const requestId = upstream.headers.get("x-request-id");
  const body = await upstream.arrayBuffer();

  const headers = new Headers({ "content-type": contentType });
  if (disposition) headers.set("content-disposition", disposition);
  if (requestId) headers.set("x-request-id", requestId);

  return new NextResponse(body, { status: upstream.status, headers });
}

export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;

  if (!accessToken) {
    const res = errorResponse(401, "UNAUTHORIZED", "Not authenticated");
    clearAuthCookies(res);
    return res;
  }

  const search = req.nextUrl.search; // preserve the filter + format query params

  let upstream = await forwardExport(search, accessToken);

  // Refresh-on-401 (mirrors the generic proxy's behaviour, skill §4).
  if (upstream.status === 401 && refreshToken) {
    let expired = false;
    if (isJsonErrorResponse(upstream)) {
      const body = (await upstream.json().catch(() => null)) as {
        error?: { code?: string };
      } | null;
      expired = body?.error?.code === "TOKEN_EXPIRED";
    }

    if (expired) {
      const refreshed = await callUpstream({
        path: "/auth/refresh",
        method: "POST",
        json: { refreshToken },
      });

      if (refreshed.status !== 200) {
        const res = errorResponse(
          401,
          "INVALID_CREDENTIALS",
          "Session expired, please log in again",
        );
        clearAuthCookies(res);
        return res;
      }

      const data = refreshed.body as {
        accessToken: string;
        expiresIn: number;
        refreshToken?: string;
      };
      upstream = await forwardExport(search, data.accessToken);
      const res = await streamBack(upstream);
      rotateAccessCookie(res, data.accessToken, data.expiresIn, data.refreshToken);
      return res;
    }
  }

  // Any other non-2xx (403 FORBIDDEN, 400 VALIDATION_ERROR) is a JSON error body —
  // pass it through as JSON so the client's error mapping still works.
  if (!upstream.ok && isJsonErrorResponse(upstream)) {
    const body = await upstream.json().catch(() => null);
    return NextResponse.json(body, { status: upstream.status });
  }

  return streamBack(upstream);
}
