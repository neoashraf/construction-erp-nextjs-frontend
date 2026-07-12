import { hasGrant, roleMatches, type ActionCode, type Role } from "@/lib/auth/roles";

/**
 * Requisition write-scope predicates (spec §11; API role table). Prefer the effective
 * permission set (defence-in-depth); fall back to the role map when the projection is
 * absent. The server re-checks every action regardless — write/submit/delete affordances
 * are HIDDEN (not disabled) for actors lacking scope.
 *
 * Create/edit/delete a DRAFT + submit = PM / Site Engineer (own, assigned projects) + Admin;
 * Accounts Manager + Store Keeper are read-only here (approval/issue live on sibling screens).
 * The resource catalogue lists only C/U for `requisitions.list` (no explicit submit/delete
 * code, brief §Inputs flag) — Submit/Delete gate on the same write model until AUD clarifies.
 */
export const REQ_RESOURCE = "requisitions.list";

interface Viewer {
  role: Role | string;
  permissions?: readonly { resource: string; action: string }[] | null;
}

function allow(user: Viewer, action: ActionCode, fallbackRoles: readonly Role[]): boolean {
  if (user.role === "ADMIN") return true;
  if (user.permissions) return hasGrant(user as never, REQ_RESOURCE, action);
  return roleMatches(fallbackRoles, user.role);
}

/** Create / edit / delete a DRAFT requisition. */
export function canWriteRequisition(user: Viewer): boolean {
  return allow(user, "CREATE", ["PROJECT_MANAGER", "SITE_ENGINEER"]);
}

/** Submit a DRAFT for approval (gated on the write model until a submit code exists). */
export function canSubmitRequisition(user: Viewer): boolean {
  return allow(user, "UPDATE", ["PROJECT_MANAGER", "SITE_ENGINEER"]);
}

/**
 * The Approvals worklist / review screen resource (nav-tree `requisitions.approvals`,
 * also-actions **A J** = APPROVE, REJECT). READ visibility here is broader than the decision
 * authority: PM, Accounts and Store Keeper can all *view* the review detail (Store Keeper to
 * anticipate an issue), but only PM/Accounts (per tier) may decide. Site Engineer + HR are
 * excluded — a direct hit gets the permission-denied view, and the server re-checks (`403`).
 */
export const REQ_APPROVALS_RESOURCE = "requisitions.approvals";

/** May the viewer open the approvals worklist / review a requisition at all (READ, spec §11)? */
export function canReviewRequisitions(user: Viewer): boolean {
  if (user.role === "ADMIN") return true;
  if (user.permissions) return hasGrant(user as never, REQ_APPROVALS_RESOURCE, "READ");
  return roleMatches(["PROJECT_MANAGER", "ACCOUNTS_MANAGER", "ACCOUNTS_TEAM", "STORE_KEEPER"], user.role);
}
