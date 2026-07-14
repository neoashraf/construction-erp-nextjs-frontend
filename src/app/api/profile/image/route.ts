import { NextRequest, NextResponse } from "next/server";
import { callUpstream } from "@/lib/bff/upstream";
import { rotateAccessCookie, clearAuthCookies } from "@/lib/bff/cookies";
import { isCsrfValid } from "@/lib/bff/csrf";
import { errorResponse, upstreamErrorCode } from "@/lib/bff/responses";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/session";

/**
 * FE-52 dedicated `/api/profile/image` route handler. The catch-all BFF proxy
 * assumes JSON bodies (it calls `req.text()` + `JSON.parse`) — that path can't
 * carry a multipart avatar upload. This handler:
 *   1) checks CSRF for state-changing methods,
 *   2) reads the incoming multipart body as a raw `Blob`,
 *   3) forwards it to NestJS with `authorization: Bearer <access>` + the
 *      original `content-type` (including the multer boundary),
 *   4) handles refresh-on-401 + cookie rotation like the standard proxy,
 *   5) handles the mock-nestjs case by short-circuiting with a fake ProfileView
 *      whose `avatarUrl` is a data URI derived from the uploaded blob so the
 *      preview replaces reliably in tests.
 * DELETE is handled by the standard catch-all proxy — no multipart body.
 */

const UPSTREAM_MULTIPART_PATH = "/profile/image";

function envelope(code: string, message: string) {
  return { error: { code, message, details: null } };
}
function success(data: unknown) {
  return { data, meta: { requestId: "profile-image" } };
}

async function handleAvatarUploadReal(
  req: NextRequest,
  accessToken: string | undefined,
  refreshToken: string | undefined,
): Promise<NextResponse> {
  if (!accessToken && !refreshToken) {
    const res = errorResponse(401, "UNAUTHORIZED", "Not authenticated");
    clearAuthCookies(res);
    return res;
  }
  const contentType = req.headers.get("content-type") ?? "application/octet-stream";
  const blob = await req.blob();

  async function fire(bearer: string): Promise<Response> {
    // Direct fetch to NestJS — bypass callUpstream (JSON-only) and speak
    // multipart end-to-end. Server config is read from env at call time.
    const base = process.env.NESTJS_API_BASE_URL ?? "http://localhost:3001";
    return fetch(`${base}${UPSTREAM_MULTIPART_PATH}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${bearer}`,
        "content-type": contentType,
      },
      body: blob,
      cache: "no-store",
    });
  }

  let bearer = accessToken;
  if (!bearer && refreshToken) {
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
    const { data } = refreshed.body as { data: { accessToken: string; expiresIn: number; refreshToken?: string } };
    bearer = data.accessToken;
    const upstream = await fire(bearer);
    const body = await parseUpstreamBody(upstream);
    const res = buildRes(upstream.status, body);
    rotateAccessCookie(res, data.accessToken, data.expiresIn, data.refreshToken);
    return res;
  }

  let upstream = await fire(bearer!);
  let body = await parseUpstreamBody(upstream);
  if (upstream.status === 401 && upstreamErrorCode(body) === "TOKEN_EXPIRED" && refreshToken) {
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
    const { data } = refreshed.body as { data: { accessToken: string; expiresIn: number; refreshToken?: string } };
    upstream = await fire(data.accessToken);
    body = await parseUpstreamBody(upstream);
    const res = buildRes(upstream.status, body);
    rotateAccessCookie(res, data.accessToken, data.expiresIn, data.refreshToken);
    return res;
  }
  return buildRes(upstream.status, body);
}

async function parseUpstreamBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function buildRes(status: number, body: unknown): NextResponse {
  if (status === 204 || body === null || body === undefined) {
    return new NextResponse(null, { status });
  }
  return NextResponse.json(body, { status });
}

/**
 * Mock short-circuit — mirrors the real endpoint's contract but stores the
 * upload in-memory (via the mock-nestjs store) and returns a data-URI avatar.
 * The mock store lives in `lib/bff/mock-nestjs` — we invoke it here so tests
 * can drive the whole POST /api/profile/image path end-to-end.
 */
async function handleAvatarUploadMock(req: NextRequest): Promise<NextResponse> {
  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json(envelope("VALIDATION_ERROR", "Choose an image to upload."), { status: 400 });
  const file = formData.get("image");
  if (!(file instanceof Blob)) {
    return NextResponse.json(envelope("VALIDATION_ERROR", "Choose an image to upload."), { status: 400 });
  }
  const MAX = 5 * 1024 * 1024;
  if (file.size > MAX) {
    return NextResponse.json(envelope("PAYLOAD_TOO_LARGE", "Image must be 5 MB or smaller."), { status: 413 });
  }
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (file.type && !allowed.has(file.type)) {
    return NextResponse.json(envelope("UNSUPPORTED_MEDIA_TYPE", "Use a JPG, PNG, or WebP image."), { status: 415 });
  }
  // Ask the mock store for the current user + set a fake avatar URL derived from the upload.
  const buf = Buffer.from(await file.arrayBuffer());
  const dataUri = `data:${file.type || "image/png"};base64,${buf.toString("base64")}`;
  const { mockProfileSetAvatar } = await import("@/lib/bff/mock-nestjs");
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value ?? "";
  const view = mockProfileSetAvatar(accessToken, dataUri);
  if (!view) {
    return NextResponse.json(envelope("UNAUTHORIZED", "Not authenticated"), { status: 401 });
  }
  return NextResponse.json(success(view), { status: 200 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isCsrfValid(req)) {
    return errorResponse(403, "FORBIDDEN", "CSRF token missing or invalid");
  }
  if (process.env.USE_MOCK_NESTJS === "true") {
    return handleAvatarUploadMock(req);
  }
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  return handleAvatarUploadReal(req, accessToken, refreshToken);
}
