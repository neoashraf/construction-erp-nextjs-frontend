import { hasGrant, roleMatches, type ActionCode, type Role } from "@/lib/auth/roles";

/**
 * HR Employee-master write-scope predicates (spec §11; API contract 12 § "Employees").
 * Prefer the effective permission set (defence-in-depth); fall back to the role map when
 * the projection is absent. The server re-checks every action regardless — write actions
 * and the bank-reveal are HIDDEN (not merely disabled) for actors lacking scope, and any
 * `403` is handled gracefully.
 *
 * Resource `hr.employees`, also-actions **C U** (CREATE, UPDATE); the destructive op is
 * Deactivate (no hard DELETE). Bank-reveal + Deactivate/Reactivate ride the same
 * `hr:employee:write` scope as create/edit — HR Manager + Admin; Accounts read-only.
 */
export const HR_EMPLOYEE_RESOURCE = "hr.employees";

interface Viewer {
  role: Role | string;
  permissions?: readonly { resource: string; action: string }[] | null;
}

function allow(user: Viewer, action: ActionCode, fallbackRoles: readonly Role[]): boolean {
  if (user.role === "ADMIN") return true;
  if (user.permissions) return hasGrant(user as never, HR_EMPLOYEE_RESOURCE, action);
  return roleMatches(fallbackRoles, user.role);
}

/** Create / edit an employee (HR Manager + Admin). */
export function canWriteEmployee(user: Viewer): boolean {
  return allow(user, "CREATE", ["HR_MANAGER"]);
}

/** Deactivate / Reactivate an employee — rides the same write scope. */
export function canDeactivateEmployee(user: Viewer): boolean {
  return allow(user, "UPDATE", ["HR_MANAGER"]);
}

/** Reveal masked bank fields (NFR-002) — HR/Admin only. Accounts sees masked-only. */
export function canRevealBank(user: Viewer): boolean {
  return canWriteEmployee(user);
}
