import { canAccessModule, hasModuleGrant, type ModuleKey, type Role } from "./roles";
import { type SessionPermission } from "./session";

/**
 * Pure route-guard decisions (skill §5). Kept side-effect-free so they unit-test
 * without Next.js. The server components / middleware that own redirects call
 * these and then `redirect(...)`.
 *
 * Defence-in-depth: these gate the UI; the backend remains the source of truth
 * and may still return 403 FORBIDDEN (handle it — see asApiError/ApiError).
 */

export type GuardDecision =
  | { allow: true }
  | { allow: false; reason: "unauthenticated"; redirectTo: string }
  | { allow: false; reason: "forbidden"; redirectTo: string };

export const LOGIN_PATH = "/login";
export const FORBIDDEN_PATH = "/403";

/**
 * Decide whether a (possibly absent) viewer may enter an `(app)` module segment.
 * FE-21 (FR-AUD-032): when the session projection is present, the decision is
 * permission-driven — any READ grant inside the module admits; the static
 * role→module map is only the fallback for a degraded session. Defence-in-depth
 * either way — the backend re-checks the exact `(resource, action)` per route.
 */
export function guardModule(
  viewer: { role: Role; permissions?: SessionPermission[] | null } | Role | null | undefined,
  module: ModuleKey,
): GuardDecision {
  if (!viewer) {
    return { allow: false, reason: "unauthenticated", redirectTo: LOGIN_PATH };
  }
  const v = typeof viewer === "string" ? { role: viewer, permissions: undefined } : viewer;
  const allowed = v.permissions ? hasModuleGrant(v, module) : canAccessModule(v.role, module);
  if (!allowed) {
    return { allow: false, reason: "forbidden", redirectTo: FORBIDDEN_PATH };
  }
  return { allow: true };
}

/** Decide whether a (possibly absent) role may enter any authenticated `(app)` route. */
export function guardAuthenticated(role: Role | null | undefined): GuardDecision {
  if (!role) {
    return { allow: false, reason: "unauthenticated", redirectTo: LOGIN_PATH };
  }
  return { allow: true };
}

/** Map a URL path under `(app)` to its module key, or null if not a module segment. */
export function moduleFromPath(pathname: string): ModuleKey | null {
  const seg = pathname.replace(/^\/+/, "").split("/")[0];
  const known: readonly string[] = ["master-data", "ledger", "numbering", "period", "audit", "hr"];
  return known.includes(seg ?? "") ? (seg as ModuleKey) : null;
}
