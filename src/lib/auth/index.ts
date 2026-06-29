/**
 * Authorization surface (skill §5). Pure helpers (roles, guard, project-scope)
 * are safe to import anywhere; `server-session` is server-only.
 */
export {
  ROLES,
  MODULES,
  UNSCOPED_ROLES,
  isRole,
  canAccessModule,
  modulesForRole,
  isUnscopedRole,
  roleLabel,
  moduleLabel,
} from "./roles";
export type { Role, ModuleKey } from "./roles";

export { guardModule, guardAuthenticated, moduleFromPath, LOGIN_PATH, FORBIDDEN_PATH } from "./guard";
export type { GuardDecision } from "./guard";

export {
  canSeeProject,
  filterToAssignedProjects,
  effectiveProjectScope,
  isProjectScopedRole,
} from "./project-scope";
export type { HasProjectId } from "./project-scope";

export {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  SESSION_COOKIE,
  CSRF_COOKIE,
  parseSessionUser,
} from "./session";
export type { SafeUser, Session } from "./session";
