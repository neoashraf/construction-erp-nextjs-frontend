/**
 * @jest-environment node
 *
 * BFF proxy refresh behaviour (skill §4). Focus: a session must survive the short
 * access-token TTL by redeeming the 7-day refresh cookie — including the case where
 * the access cookie has already expired OUT of the browser (its maxAge = access
 * TTL), which previously logged the user out ~15 min after login.
 */
import { NextRequest } from "next/server";

// Mock the upstream + cookie side-effects so we can assert control flow.
const callUpstream = jest.fn();
jest.mock("@/lib/bff/upstream", () => ({ callUpstream: (...a: unknown[]) => callUpstream(...a) }));

const clearAuthCookies = jest.fn();
const rotateAccessCookie = jest.fn();
jest.mock("@/lib/bff/cookies", () => ({
  clearAuthCookies: (...a: unknown[]) => clearAuthCookies(...a),
  rotateAccessCookie: (...a: unknown[]) => rotateAccessCookie(...a),
}));

// CSRF is not under test here — always valid (we only exercise GETs anyway).
jest.mock("@/lib/bff/csrf", () => ({ isCsrfValid: () => true }));

import { handleProxy } from "@/lib/bff/proxy";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/session";

function reqWithCookies(cookies: Record<string, string>): NextRequest {
  const url = "http://localhost:4000/api/masters/cost-centres";
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return new NextRequest(url, {
    method: "GET",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

beforeEach(() => {
  callUpstream.mockReset();
  clearAuthCookies.mockReset();
  rotateAccessCookie.mockReset();
});

test("no access cookie but a valid refresh cookie → refreshes and retries (stays logged in)", async () => {
  // /auth/refresh succeeds, then the retried GET succeeds.
  callUpstream
    .mockResolvedValueOnce({
      status: 200,
      body: { data: { accessToken: "new-access", expiresIn: 900, refreshToken: "new-refresh" } },
    })
    .mockResolvedValueOnce({ status: 200, body: { data: [], meta: { total: 0 } } });

  const res = await handleProxy(reqWithCookies({ [REFRESH_COOKIE]: "good-refresh" }), [
    "masters",
    "cost-centres",
  ]);

  // The refresh endpoint was called with the refresh token, then the request retried.
  expect(callUpstream).toHaveBeenNthCalledWith(1, expect.objectContaining({ path: "/auth/refresh" }));
  expect(rotateAccessCookie).toHaveBeenCalledWith(expect.anything(), "new-access", 900, "new-refresh");
  expect(clearAuthCookies).not.toHaveBeenCalled();
  expect(res.status).toBe(200);
});

test("no access cookie and refresh cookie is rejected → 401 and cookies cleared", async () => {
  callUpstream.mockResolvedValueOnce({
    status: 401,
    body: { error: { code: "INVALID_CREDENTIALS", message: "nope" } },
  });

  const res = await handleProxy(reqWithCookies({ [REFRESH_COOKIE]: "stale-refresh" }), [
    "masters",
    "cost-centres",
  ]);

  expect(res.status).toBe(401);
  expect(clearAuthCookies).toHaveBeenCalledTimes(1);
});

test("neither access nor refresh cookie → 401 without even trying refresh", async () => {
  const res = await handleProxy(reqWithCookies({}), ["masters", "cost-centres"]);

  expect(callUpstream).not.toHaveBeenCalled();
  expect(res.status).toBe(401);
  expect(clearAuthCookies).toHaveBeenCalledTimes(1);
});

test("access cookie present but NestJS says TOKEN_EXPIRED → refreshes and retries", async () => {
  callUpstream
    // first: the original GET with the (server-side expired) access token
    .mockResolvedValueOnce({ status: 401, body: { error: { code: "TOKEN_EXPIRED", message: "exp" } } })
    // then: /auth/refresh succeeds
    .mockResolvedValueOnce({
      status: 200,
      body: { data: { accessToken: "fresh", expiresIn: 900 } },
    })
    // then: the retried GET succeeds
    .mockResolvedValueOnce({ status: 200, body: { data: [], meta: { total: 0 } } });

  const res = await handleProxy(
    reqWithCookies({ [ACCESS_COOKIE]: "expired-access", [REFRESH_COOKIE]: "good-refresh" }),
    ["masters", "cost-centres"],
  );

  expect(callUpstream).toHaveBeenNthCalledWith(2, expect.objectContaining({ path: "/auth/refresh" }));
  expect(rotateAccessCookie).toHaveBeenCalled();
  expect(clearAuthCookies).not.toHaveBeenCalled();
  expect(res.status).toBe(200);
});
