import { type Role } from "./roles";

/**
 * The safe session the UI sees (skill §4). Mirrors the `user` payload the NestJS
 * `/api/auth/login` returns (API contract 05) — NEVER tokens, NEVER password_hash.
 * Tokens live only in httpOnly cookies the BFF manages (ADR-0003 F5).
 */
export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyId: string;
  financialYearId: string;
  isActive: boolean;
  lastLoginAt?: string | null;
  /** Assigned project ids for project-scoped roles; absent/empty for unscoped roles. */
  assignedProjectIds?: string[];
}

/** The session context value exposed to client components via the provider. */
export interface Session {
  user: SafeUser;
}

/** Cookie names the BFF sets/reads. httpOnly + Secure + SameSite (set server-side). */
export const ACCESS_COOKIE = "ze_access";
export const REFRESH_COOKIE = "ze_refresh";
/**
 * The safe `user` JSON, stored httpOnly so the server (shell layout, /api/auth/me)
 * can render the session without exposing it to client JS as a raw token. Contains
 * NO tokens — only the safe user fields.
 */
export const SESSION_COOKIE = "ze_session";
/** Double-submit CSRF cookie (readable by JS so the client can echo it in a header). */
export const CSRF_COOKIE = "ze_csrf";

/** Parse a SafeUser from the session-cookie JSON, or null if absent/invalid. */
export function parseSessionUser(raw: string | undefined | null): SafeUser | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SafeUser>;
    if (
      typeof parsed.id === "string" &&
      typeof parsed.email === "string" &&
      typeof parsed.role === "string" &&
      typeof parsed.companyId === "string"
    ) {
      return parsed as SafeUser;
    }
    return null;
  } catch {
    return null;
  }
}
