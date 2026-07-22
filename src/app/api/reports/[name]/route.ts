import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getServerConfig } from "@/lib/config/server";
import { callUpstream } from "@/lib/bff/upstream";
import { handleProxy } from "@/lib/bff/proxy";
import { rotateAccessCookie, clearAuthCookies } from "@/lib/bff/cookies";
import { errorResponse } from "@/lib/bff/responses";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/session";

/**
 * Dedicated BFF route for `GET /api/reports/<name>` (FR-RPT-029/-031).
 *
 * The generic catch-all proxy (`app/api/[...path]/route.ts` -> `lib/bff/proxy.ts`)
 * is JSON-only: `realFetch` reads the upstream body with `res.text()` -> `JSON.parse`
 * and the proxy always replies with `NextResponse.json(...)`. An Excel/PDF export
 * returns a BINARY file (`StreamableFile`, xlsx/pdf mime, `Content-Disposition:
 * attachment`); decoding those bytes as UTF-8 text corrupts the ZIP container, so
 * Excel rejects the download as "not a valid file format". This route streams the
 * upstream body and its `Content-Type`/`Content-Disposition` straight through,
 * unparsed — mirroring `app/api/audit-logs/export/route.ts`.
 *
 * Only `format=excel|pdf` needs the binary path. `format=json` (and `catalog`)
 * are delegated to the generic proxy so the on-screen reports are untouched.
 */

const BINARY_FORMATS = new Set(["excel", "pdf"]);

async function forwardExport(name: string, search: string, bearer: string): Promise<Response> {
  const cfg = getServerConfig();
  return fetch(`${cfg.NESTJS_API_BASE_URL}/reports/${name}${search}`, {
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

export async function GET(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const format = req.nextUrl.searchParams.get("format") ?? "json";

  // On-screen JSON reports + the catalog keep the generic proxy behaviour untouched.
  if (!BINARY_FORMATS.has(format)) {
    return handleProxy(req, ["reports", name]);
  }

  // Binary export (Excel/PDF): stream the file through, unparsed.
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;

  if (!accessToken) {
    if (refreshToken) {
      // No access cookie but a live refresh cookie — renew, then export.
      const refreshed = await callUpstream({
        path: "/auth/refresh",
        method: "POST",
        json: { refreshToken },
      });
      if (refreshed.status !== 200) {
        const res = errorResponse(401, "INVALID_CREDENTIALS", "Session expired, please log in again");
        clearAuthCookies(res);
        return res;
      }
      const { data } = refreshed.body as {
        data: { accessToken: string; expiresIn: number; refreshToken?: string };
      };
      const upstream = await forwardExport(name, req.nextUrl.search, data.accessToken);
      const res = await streamBack(upstream);
      rotateAccessCookie(res, data.accessToken, data.expiresIn, data.refreshToken);
      return res;
    }
    const res = errorResponse(401, "UNAUTHORIZED", "Not authenticated");
    clearAuthCookies(res);
    return res;
  }

  const search = req.nextUrl.search; // preserve every report parameter + format
  let upstream = await forwardExport(name, search, accessToken);

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
        const res = errorResponse(401, "INVALID_CREDENTIALS", "Session expired, please log in again");
        clearAuthCookies(res);
        return res;
      }
      const { data } = refreshed.body as {
        data: { accessToken: string; expiresIn: number; refreshToken?: string };
      };
      upstream = await forwardExport(name, search, data.accessToken);
      const res = await streamBack(upstream);
      rotateAccessCookie(res, data.accessToken, data.expiresIn, data.refreshToken);
      return res;
    }
  }

  // Any other non-2xx is a JSON error body — pass it through as JSON so the
  // client's error mapping (FORBIDDEN / VALIDATION_ERROR) still works.
  if (!upstream.ok && isJsonErrorResponse(upstream)) {
    const body = await upstream.json().catch(() => null);
    return NextResponse.json(body, { status: upstream.status });
  }

  return streamBack(upstream);
}
