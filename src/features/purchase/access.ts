import { hasGrant, roleMatches, type ActionCode, type Role } from "@/lib/auth/roles";

/**
 * Purchase Order write-scope predicates (brief §Scope 12; spec §11; API permission table
 * — `purchase:write`, `purchase:approve-po`, `purchase:cancel`). Prefer the effective
 * permission set (defence-in-depth); fall back to the role map when the projection is
 * absent. The server re-checks every action regardless — write/approve/cancel affordances
 * are HIDDEN (not disabled) for actors lacking scope, per the brief.
 *
 * PM: assigned-project scoped — Create/Edit DRAFT, Approve (if granted), Cancel a bill-free
 * DRAFT/APPROVED on assigned projects only.
 * Accounts Manager + Admin: all-company POs, permissioned create/edit/approve/cancel.
 * Store Keeper: nothing on this screen.
 */
export const PO_RESOURCE = "purchase.orders";

interface Viewer {
  role: Role | string;
  permissions?: readonly { resource: string; action: string }[] | null;
}

function allow(user: Viewer, action: ActionCode, fallbackRoles: readonly Role[]): boolean {
  if (user.role === "ADMIN") return true;
  if (user.permissions) return hasGrant(user as never, PO_RESOURCE, action);
  return roleMatches(fallbackRoles, user.role);
}

/** Create / edit / save a DRAFT PO (`purchase:write`). */
export function canWritePo(user: Viewer): boolean {
  return allow(user, "CREATE", ["PROJECT_MANAGER", "ACCOUNTS_MANAGER", "ACCOUNTS_TEAM"]);
}

/**
 * Approve a DRAFT PO (`purchase:approve-po`). The resource-catalogue action-code is
 * `POST` (P) on `purchase.orders` — mapped to the FE `ActionCode` "POST" (brief §Inputs).
 * Fallback roles = PM (assigned projects) + Accounts Manager, per spec §11.
 */
export function canApprovePo(user: Viewer): boolean {
  return allow(user, "POST", ["PROJECT_MANAGER", "ACCOUNTS_MANAGER", "ACCOUNTS_TEAM"]);
}

/** Cancel a DRAFT/APPROVED PO (`purchase:cancel`, catalogue X = CANCEL). */
export function canCancelPo(user: Viewer): boolean {
  return allow(user, "CANCEL", ["PROJECT_MANAGER", "ACCOUNTS_MANAGER", "ACCOUNTS_TEAM"]);
}

/**
 * Purchase Bill scope (brief §Scope 15; spec §11). Bills are the AP posting voucher —
 * PM is read-only (list + viewer, assigned projects), Accounts Manager + Admin can
 * write/post/cancel, Store Keeper sees nothing. Server enforces every action.
 */
export const BILL_RESOURCE = "purchase.bills";

function allowBill(user: Viewer, action: ActionCode, fallbackRoles: readonly Role[]): boolean {
  if (user.role === "ADMIN") return true;
  if (user.permissions) return hasGrant(user as never, BILL_RESOURCE, action);
  return roleMatches(fallbackRoles, user.role);
}

/** Create / edit a DRAFT bill (`purchase:write`; catalogue C/U). */
export function canWriteBill(user: Viewer): boolean {
  return allowBill(user, "CREATE", ["ACCOUNTS_MANAGER", "ACCOUNTS_TEAM"]);
}

/** Post a DRAFT bill (`purchase:post`; catalogue P). */
export function canPostBill(user: Viewer): boolean {
  return allowBill(user, "POST", ["ACCOUNTS_MANAGER", "ACCOUNTS_TEAM"]);
}

/** Cancel / Repost a POSTED bill (`purchase:cancel`; catalogue X). */
export function canCancelBill(user: Viewer): boolean {
  return allowBill(user, "CANCEL", ["ACCOUNTS_MANAGER", "ACCOUNTS_TEAM"]);
}

/**
 * GRN scope (spec §11; brief §Scope 7). GRN entry is a Store Keeper action — only
 * Store Keeper (+ permissioned Admin) records and posts. Accounts Manager / PM /
 * Admin get read-only access (list + match view; PM assigned-projects only). The
 * server enforces every action regardless — write affordances are HIDDEN, not
 * disabled, for actors lacking scope.
 */
export const GRN_RESOURCE = "purchase.grn";

function allowGrn(user: Viewer, action: ActionCode, fallbackRoles: readonly Role[]): boolean {
  if (user.role === "ADMIN") return true;
  if (user.permissions) return hasGrant(user as never, GRN_RESOURCE, action);
  return roleMatches(fallbackRoles, user.role);
}

/** Create / edit a DRAFT GRN (`purchase:write`; catalogue C/U). Store Keeper only. */
export function canWriteGrn(user: Viewer): boolean {
  return allowGrn(user, "CREATE", ["STORE_KEEPER"]);
}

/** Post a DRAFT GRN (`purchase:post`; catalogue P). Store Keeper only. */
export function canPostGrn(user: Viewer): boolean {
  return allowGrn(user, "POST", ["STORE_KEEPER"]);
}
