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

/** True when this user may see the given project id. Unscoped roles always may. */
export function canSeeProject(user: Pick<SafeUser, "role" | "assignedProjectIds">, projectId: string): boolean {
  if (isUnscopedRole(user.role)) return true;
  return (user.assignedProjectIds ?? []).includes(projectId);
}

/**
 * Filter a list of project-bound items to those the user may see. Unscoped roles
 * get the list unchanged; scoped roles get only their assigned projects.
 */
export function filterToAssignedProjects<T extends HasProjectId>(
  user: Pick<SafeUser, "role" | "assignedProjectIds">,
  items: T[],
): T[] {
  if (isUnscopedRole(user.role)) return items;
  const allowed = new Set(user.assignedProjectIds ?? []);
  return items.filter((item) => allowed.has(item.projectId));
}

/** Returns the effective project scope: "ALL" for unscoped roles, else the id list. */
export function effectiveProjectScope(
  user: Pick<SafeUser, "role" | "assignedProjectIds">,
): "ALL" | string[] {
  return isUnscopedRole(user.role) ? "ALL" : [...(user.assignedProjectIds ?? [])];
}

/** True when a role is project-scoped (the inverse of unscoped). */
export function isProjectScopedRole(role: Role): boolean {
  return !isUnscopedRole(role);
}
