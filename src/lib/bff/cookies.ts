import "server-only";
import { type NextResponse } from "next/server";
import { getServerConfig } from "@/lib/config/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  SESSION_COOKIE,
  CSRF_COOKIE,
  type SafeUser,
} from "@/lib/auth/session";

/**
 * Auth-cookie helpers for the BFF (skill §4, ADR-0003 F5). The access + refresh
 * tokens and the safe-user session live in **httpOnly, Secure, SameSite** cookies
 * the browser JS can never read. The CSRF token is a separate, JS-readable cookie
 * (double-submit). All set/clear go through here so the policy is consistent.
 */

interface SetTokensArgs {
  accessToken: string;
  refreshToken: string;
  /** access-token lifetime in seconds (from the backend `expiresIn`). */
  expiresIn: number;
  user: SafeUser;
}

// Refresh cookie lives longer than access; conservative default (7d) until the
// backend documents a refresh TTL.
const REFRESH_MAX_AGE = 60 * 60 * 24 * 7;

function baseCookieOptions() {
  const cfg = getServerConfig();
  return {
    httpOnly: true as const,
    secure: cfg.AUTH_COOKIE_SECURE,
    sameSite: cfg.AUTH_COOKIE_SAMESITE,
    path: "/",
  };
}

/** Set access + refresh + session cookies (httpOnly) and the CSRF cookie (readable). */
export function setAuthCookies(res: NextResponse, args: SetTokensArgs, csrfToken: string): void {
  const opts = baseCookieOptions();
  res.cookies.set(ACCESS_COOKIE, args.accessToken, { ...opts, maxAge: args.expiresIn });
  res.cookies.set(REFRESH_COOKIE, args.refreshToken, { ...opts, maxAge: REFRESH_MAX_AGE });
  res.cookies.set(SESSION_COOKIE, JSON.stringify(args.user), { ...opts, maxAge: REFRESH_MAX_AGE });
  // CSRF: NOT httpOnly (the client must read it to echo in the request header),
  // but still Secure + SameSite. Double-submit pattern.
  res.cookies.set(CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: "/",
    maxAge: REFRESH_MAX_AGE,
  });
}

/** Rotate just the access token (and optionally refresh) after a refresh call. */
export function rotateAccessCookie(res: NextResponse, accessToken: string, expiresIn: number, refreshToken?: string): void {
  const opts = baseCookieOptions();
  res.cookies.set(ACCESS_COOKIE, accessToken, { ...opts, maxAge: expiresIn });
  if (refreshToken) {
    res.cookies.set(REFRESH_COOKIE, refreshToken, { ...opts, maxAge: REFRESH_MAX_AGE });
  }
}

/** Clear every auth cookie (logout, refresh failure, deactivation). */
export function clearAuthCookies(res: NextResponse): void {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, SESSION_COOKIE, CSRF_COOKIE]) {
    res.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
}
