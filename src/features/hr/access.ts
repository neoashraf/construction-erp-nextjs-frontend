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

/**
 * Attendance capture (FR-HR-004..-008): Site Engineer + HR Manager + ADMIN can capture rows
 * for their assigned projects. Accounts/PM/Storekeeper have no capture write. Site Engineer's
 * project scope is server-filtered; the UI hides Confirm/Reverse for them.
 * Resource `hr.attendance` (scope `hr:attendance:write`).
 */
export const HR_ATTENDANCE_RESOURCE = "hr.attendance";

export function canCaptureAttendance(user: Viewer): boolean {
  if (user.role === "ADMIN") return true;
  if (user.permissions) return hasGrant(user as never, HR_ATTENDANCE_RESOURCE, "CREATE");
  return roleMatches(["HR_MANAGER", "SITE_ENGINEER", "ACCOUNTS_MANAGER", "ACCOUNTS_TEAM"], user.role);
}

/**
 * Daily-labour Confirm (posts the accrual) + Reverse. Scope `hr:attendance:confirm`.
 * HR_MANAGER + ACCOUNTS + ADMIN — Site Engineer CANNOT confirm/reverse (spec §11).
 */
export function canConfirmAttendance(user: Viewer): boolean {
  if (user.role === "ADMIN") return true;
  if (user.permissions) return hasGrant(user as never, HR_ATTENDANCE_RESOURCE, "POST");
  return roleMatches(["HR_MANAGER", "ACCOUNTS_MANAGER", "ACCOUNTS_TEAM"], user.role);
}

export function canReverseAttendance(user: Viewer): boolean {
  if (user.role === "ADMIN") return true;
  if (user.permissions) return hasGrant(user as never, HR_ATTENDANCE_RESOURCE, "CANCEL");
  return roleMatches(["HR_MANAGER", "ACCOUNTS_MANAGER", "ACCOUNTS_TEAM"], user.role);
}

/**
 * Salary-sheet predicates (spec §11; API contract 12 § "Salary"; FR-HR-013..-018).
 * Resource `hr.salary_sheets`, also-actions **C U P** (CREATE = Generate, UPDATE = edit
 * draft / bulk-components, POST = Post/Reverse). HR Manager + ADMIN generate/edit/post/
 * reverse; Accounts Manager can post/reverse (accounts-desk task, SRS §3). PM / Site
 * Engineer / Store Keeper: nothing — screen hidden by the module guard, server 403 on
 * direct URL. All write/post affordances are HIDDEN (not merely disabled) for actors
 * without scope; the server re-checks every action regardless.
 */
export const HR_SALARY_RESOURCE = "hr.salary_sheets";

/** Generate a new DRAFT for a period + edit its draft lines (bulk or per-line). */
export function canGenerateSalarySheet(user: Viewer): boolean {
  if (user.role === "ADMIN") return true;
  if (user.permissions) return hasGrant(user as never, HR_SALARY_RESOURCE, "CREATE");
  return roleMatches(["HR_MANAGER"], user.role);
}

/** Edit a DRAFT sheet's lines / bulk-components. Same scope as Generate. */
export function canEditSalaryDraft(user: Viewer): boolean {
  if (user.role === "ADMIN") return true;
  if (user.permissions) return hasGrant(user as never, HR_SALARY_RESOURCE, "UPDATE");
  return roleMatches(["HR_MANAGER"], user.role);
}

/** Post the SALARY entry + Reverse a posted run (spec §11 — HR Manager + Accounts + ADMIN). */
export function canPostSalary(user: Viewer): boolean {
  if (user.role === "ADMIN") return true;
  if (user.permissions) return hasGrant(user as never, HR_SALARY_RESOURCE, "POST");
  return roleMatches(["HR_MANAGER", "ACCOUNTS_MANAGER", "ACCOUNTS_TEAM"], user.role);
}
