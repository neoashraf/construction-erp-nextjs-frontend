/**
 * @jest-environment node
 *
 * BFF session read `GET /api/auth/me` — `avatarUrl` must survive the merge into
 * `SafeUser` (FR-AUD-038; contract 05 § GET /api/auth/me).
 *
 * This is the regression guard for the reported bug. The backend projection has
 * always returned `avatarUrl`, and the account screen already re-read the session
 * after an upload — but this route's merge listed every field EXCEPT `avatarUrl`,
 * so the shell could never receive a photo no matter what the user uploaded. The
 * sidebar was pinned to initials by a field-mapping omission, one layer above the
 * component that renders it.
 */
import { NextRequest } from "next/server";

const handleProxy = jest.fn();
jest.mock("@/lib/bff/proxy", () => ({ handleProxy: (...a: unknown[]) => handleProxy(...a) }));

const getServerSession = jest.fn();
jest.mock("@/lib/auth/server-session", () => ({
  getServerSession: (...a: unknown[]) => getServerSession(...a),
}));

import { GET } from "@/app/api/auth/me/route";

const PHOTO = "https://res.cloudinary.com/zakir-erp/image/upload/v1/companies/c1/avatars/u1.webp";

/** The cookie identity the route merges the live projection over (login-time snapshot). */
const cookieUser = {
  id: "u1",
  email: "admin@ze.local",
  name: "Admin User",
  role: "ADMIN",
  companyId: "c1",
  financialYearId: "fy1",
  isActive: true,
};

/** An upstream 200 carrying the given SessionView `user` fields. */
function upstreamOk(user: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return {
    status: 200,
    json: async () => ({
      data: {
        user: { ...cookieUser, mustChangePassword: false, ...user },
        projectScope: { scope: "ALL" },
        approvalLimit: null,
        permissions: [],
        ...extra,
      },
    }),
    headers: { getSetCookie: () => [] as string[] },
  };
}

function req() {
  return new NextRequest("http://localhost:4000/api/auth/me", { method: "GET" });
}

async function body(res: Response) {
  return (await res.json()) as { user?: Record<string, unknown> };
}

beforeEach(() => {
  handleProxy.mockReset();
  getServerSession.mockReset();
  getServerSession.mockResolvedValue(cookieUser);
});

test("passes the upstream avatarUrl through to the session user", async () => {
  handleProxy.mockResolvedValue(upstreamOk({ avatarUrl: PHOTO }));

  const res = await GET(req());
  expect(res.status).toBe(200);
  expect((await body(res)).user?.avatarUrl).toBe(PHOTO);
});

test("passes an explicit null through (user removed their photo)", async () => {
  // Must be null, not dropped: the shell distinguishes "no photo" from "not told".
  handleProxy.mockResolvedValue(upstreamOk({ avatarUrl: null }));

  const res = await GET(req());
  expect((await body(res)).user).toHaveProperty("avatarUrl", null);
});

test("a fresh upload overrides a stale cookie snapshot on the next read", async () => {
  // The cookie was minted at login (photo A); the user has since replaced it (photo B).
  // The live projection must win — this is how the sidebar updates without a re-login.
  getServerSession.mockResolvedValue({ ...cookieUser, avatarUrl: "https://cdn.example/old.webp" });
  handleProxy.mockResolvedValue(upstreamOk({ avatarUrl: PHOTO }));

  const res = await GET(req());
  expect((await body(res)).user?.avatarUrl).toBe(PHOTO);
});

test("leaves the cookie value intact when upstream omits the field", async () => {
  // An upstream that predates the field must not blank a photo the cookie already has.
  getServerSession.mockResolvedValue({ ...cookieUser, avatarUrl: PHOTO });
  handleProxy.mockResolvedValue(upstreamOk({}));

  const res = await GET(req());
  expect((await body(res)).user?.avatarUrl).toBe(PHOTO);
});

test("degraded upstream falls back to the cookie identity, photo included", async () => {
  // Upstream unreachable (non-401): the shell still renders, and the login-time
  // photo still shows — which is why login returns avatarUrl at all.
  getServerSession.mockResolvedValue({ ...cookieUser, avatarUrl: PHOTO });
  handleProxy.mockResolvedValue({
    status: 503,
    json: async () => ({}),
    headers: { getSetCookie: () => [] as string[] },
  });

  const res = await GET(req());
  expect(res.status).toBe(200);
  expect((await body(res)).user?.avatarUrl).toBe(PHOTO);
});

test("never leaks avatarPublicId even if upstream were to send it (FR-AUD-043)", async () => {
  handleProxy.mockResolvedValue(
    upstreamOk({ avatarUrl: PHOTO, avatarPublicId: "companies/c1/avatars/u1" }),
  );

  const res = await GET(req());
  expect(JSON.stringify(await body(res))).not.toContain("avatarPublicId");
});
