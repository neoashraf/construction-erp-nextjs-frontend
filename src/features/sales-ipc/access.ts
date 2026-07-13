import { hasGrant, roleMatches, type ActionCode, type Role } from "@/lib/auth/roles";

/**
 * IPC write-scope predicates (spec §11; API contract 10 role/permission table). Prefer the
 * effective permission set (defence-in-depth); fall back to the role map when the projection is
 * absent. The server re-checks every action regardless — write/post/cancel affordances are
 * HIDDEN (not merely disabled) for actors lacking scope, and a `403` is handled gracefully.
 *
 * Resource `sales.ipcs`, also-actions **C U P X** (CREATE, UPDATE, POST, CANCEL): Accounts
 * Manager + Admin have the full lifecycle; Project Manager is read-only on assigned projects
 * (no write affordances rendered). The catalogue has no distinct Repost code — Repost rides the
 * same `sales:cancel`/CANCEL permission as Cancel (API contract 10), so gate them identically.
 */
export const IPC_RESOURCE = "sales.ipcs";

interface Viewer {
  role: Role | string;
  permissions?: readonly { resource: string; action: string }[] | null;
}

function allow(user: Viewer, action: ActionCode, fallbackRoles: readonly Role[]): boolean {
  if (user.role === "ADMIN") return true;
  if (user.permissions) return hasGrant(user as never, IPC_RESOURCE, action);
  return roleMatches(fallbackRoles, user.role);
}

/** Create / edit / discard a DRAFT IPC (Accounts Manager + Admin). */
export function canWriteIpc(user: Viewer): boolean {
  return allow(user, "CREATE", ["ACCOUNTS_MANAGER", "ACCOUNTS_TEAM"]);
}

/** Post a DRAFT IPC — allocates the gapless number + writes the ledger (Accounts + Admin). */
export function canPostIpc(user: Viewer): boolean {
  return allow(user, "POST", ["ACCOUNTS_MANAGER", "ACCOUNTS_TEAM"]);
}

/** Cancel / Repost a POSTED IPC — both ride the CANCEL permission (Accounts + Admin). */
export function canCancelIpc(user: Viewer): boolean {
  return allow(user, "CANCEL", ["ACCOUNTS_MANAGER", "ACCOUNTS_TEAM"]);
}

/**
 * Release retention on the IPC-register screen (spec §11; API `sales:release-retention`).
 * Resource `sales.ipc_register` has NO write action code in the current catalogue — the
 * Release action is a genuine write (flagged to the AUD/design owner per the brief). Until
 * clarified we role-map fallback to Accounts + Admin (PM: no Release button rendered, spec
 * §11); the server re-checks the release regardless (`403 FORBIDDEN` handled gracefully).
 */
export const IPC_REGISTER_RESOURCE = "sales.ipc_register";
export function canReleaseRetention(user: Viewer): boolean {
  if (user.role === "ADMIN") return true;
  return roleMatches(["ACCOUNTS_MANAGER", "ACCOUNTS_TEAM"], user.role);
}
