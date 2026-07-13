import { hasGrant, roleMatches, type ActionCode, type Role } from "@/lib/auth/roles";

/**
 * Stock Journal write-scope predicates (spec §11; API role table). Prefer the effective
 * permission set (defence-in-depth); fall back to the role map when the projection is
 * absent. The server re-checks every action regardless of what the UI shows/hides — write
 * affordances are HIDDEN (not disabled) for actors lacking scope (spec §6/§11).
 *
 * Per the API role table: write/post = Store Keeper + Admin; approve = PM + Admin;
 * reverse = Accounts + Admin. The resource catalogue has no explicit APPROVE code for
 * `inventory.stock_journals` (brief flag) — Approve is gated on the same model until the
 * AUD/design owner adds one; the server stays authoritative.
 */
export const SJ_RESOURCE = "inventory.stock_journals";

interface Viewer {
  role: Role | string;
  permissions?: readonly { resource: string; action: string }[] | null;
}

function allow(user: Viewer, action: ActionCode, fallbackRoles: readonly Role[]): boolean {
  if (user.role === "ADMIN") return true;
  if (user.permissions) return hasGrant(user as never, SJ_RESOURCE, action);
  return roleMatches(fallbackRoles, user.role);
}

/** Create / edit / delete a DRAFT. */
export function canWriteDraft(user: Viewer): boolean {
  return allow(user, "CREATE", ["STORE_KEEPER"]);
}
/** Post an APPROVED journal. */
export function canPost(user: Viewer): boolean {
  return allow(user, "POST", ["STORE_KEEPER"]);
}
/** Approve a DRAFT (own project — the server enforces the project scope). */
export function canApprove(user: Viewer): boolean {
  return allow(user, "APPROVE", ["PROJECT_MANAGER"]);
}
/** Reverse a POSTED journal. */
export function canReverse(user: Viewer): boolean {
  return allow(user, "CANCEL", ["ACCOUNTS_TEAM"]);
}

/**
 * Whether the actor may authorise negative stock at post (FR-INV-014/015). The SRS marks
 * the who/threshold as pending (§16, brief §14 Open item) — Phase-1 treats it as an Admin
 * policy authority. An authorised actor sees the "Allow negative stock?" override dialog;
 * everyone else gets the hard-stop `NEGATIVE_STOCK_BLOCKED` with no override (spec §13-1).
 */
export function canOverrideNegativeStock(user: Viewer): boolean {
  return user.role === "ADMIN";
}
