import "server-only";
import { randomBytes } from "node:crypto";
import { type NextRequest } from "next/server";
import { CSRF_COOKIE } from "@/lib/auth/session";
import { CSRF_HEADER } from "@/lib/api/client";

/**
 * CSRF protection for the BFF: SameSite cookies + a double-submit token (skill §4).
 * State-changing requests through the proxy must carry the CSRF token in the
 * `x-csrf-token` header AND match the `ze_csrf` cookie. Safe (GET/HEAD) requests
 * are exempt.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Generate a fresh random CSRF token (issued at login, rotated on refresh). */
export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

/** True when the request's CSRF header matches its cookie (or the method is safe). */
export function isCsrfValid(req: NextRequest): boolean {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return true;
  const cookie = req.cookies.get(CSRF_COOKIE)?.value;
  const header = req.headers.get(CSRF_HEADER);
  if (!cookie || !header) return false;
  // Constant-ish comparison: lengths must match, then char-by-char.
  if (cookie.length !== header.length) return false;
  let mismatch = 0;
  for (let i = 0; i < cookie.length; i++) {
    mismatch |= cookie.charCodeAt(i) ^ header.charCodeAt(i);
  }
  return mismatch === 0;
}
