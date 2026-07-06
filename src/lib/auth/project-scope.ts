import { isUnscopedRole, type Role } from "./roles";
import { type SafeUser } from "./session";

/**
 * Project-scope helper (skill §5, AUD). Project-scoped users (PM, Site Engineer,
 * Store Keeper) see only their assigned projects; unscoped roles (Admin, Accounts
 * Team, HR Manager) see all. Filter project pickers / project-bound lists with
 * this. The backend re-checks and returns FORBIDDEN if violated — this is UX.
 */

/** Anything with a `projectId` that can be scope-filtered. */
export interface HasProjectId {
  projectId: string;
}

type ScopedUser = Pick<SafeUser, "role" | "assignedProjectIds" | "projectScope">;

/**
 * FE-21: the session projection's `projectScope` (from `GET /api/auth/me`,
 * FR-AUD-031) is authoritative when present; the role heuristic is the fallback
 * for a degraded session.
 */

/** True when this user may see the given project id. */
export function canSeeProject(user: ScopedUser, projectId: string): boolean {
  if (user.projectScope !== undefined) {
    return user.projectScope === "ALL" || user.projectScope.projectIds.includes(projectId);
  }
  if (isUnscopedRole(user.role)) return true;
  return (user.assignedProjectIds ?? []).includes(projectId);
}

/**
 * Filter a list of project-bound items to those the user may see. `ALL`-scoped
 * users get the list unchanged; scoped users only their assigned projects.
 */
export function filterToAssignedProjects<T extends HasProjectId>(user: ScopedUser, items: T[]): T[] {
  const scope = effectiveProjectScope(user);
  if (scope === "ALL") return items;
  const allowed = new Set(scope);
  return items.filter((item) => allowed.has(item.projectId));
}

/** Returns the effective project scope: "ALL", or the assigned project id list. */
export function effectiveProjectScope(user: ScopedUser): "ALL" | string[] {
  if (user.projectScope !== undefined) {
    return user.projectScope === "ALL" ? "ALL" : [...user.projectScope.projectIds];
  }
  return isUnscopedRole(user.role) ? "ALL" : [...(user.assignedProjectIds ?? [])];
}

/** True when a role is project-scoped (the inverse of unscoped). */
export function isProjectScopedRole(role: Role): boolean {
  return !isUnscopedRole(role);
}
