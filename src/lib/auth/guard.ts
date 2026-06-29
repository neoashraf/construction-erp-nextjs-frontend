import { canAccessModule, type ModuleKey, type Role } from "./roles";

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

/** Decide whether a (possibly absent) role may enter an `(app)` module segment. */
export function guardModule(role: Role | null | undefined, module: ModuleKey): GuardDecision {
  if (!role) {
    return { allow: false, reason: "unauthenticated", redirectTo: LOGIN_PATH };
  }
  if (!canAccessModule(role, module)) {
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
  const known: readonly string[] = ["master-data", "ledger", "numbering", "period", "audit"];
  return known.includes(seg ?? "") ? (seg as ModuleKey) : null;
}
