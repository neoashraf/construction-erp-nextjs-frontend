/**
 * Roles + the role→capability map (skill §5, ADR-0003 constants/AUD). The session
 * carries exactly ONE role per user (AUD rule). The capability map drives UI
 * affordances (hide/disable) and the route guards; the backend stays the source
 * of truth (defence-in-depth — hiding a button is UX, the server enforces).
 *
 * Module codes mirror the backend (overview §4): the Tier-1 modules this scaffold
 * knows about are master-data (MAS), ledger (LED), numbering (NUM), period (PER),
 * audit (AUD). Per-screen briefs extend the map as their modules ship.
 */

export const ROLES = [
  "ADMIN",
  "PROJECT_MANAGER",
  "SITE_ENGINEER",
  "STORE_KEEPER",
  "ACCOUNTS_TEAM",
  "HR_MANAGER",
] as const;

export type Role = (typeof ROLES)[number];

/** App modules that own a route segment under `(app)/`. Tier-1 set. */
export const MODULES = ["master-data", "ledger", "numbering", "period", "audit"] as const;

export type ModuleKey = (typeof MODULES)[number];

/**
 * Which modules each role may reach. Project-scoped roles (PM, Site Engineer,
 * Store Keeper) additionally only see their assigned projects (see project-scope.ts).
 * This is a defence-in-depth UI map — final authority is the backend's RBAC.
 *
 * NOTE: deliberately conservative; per-screen briefs refine grants as needed.
 */
const ROLE_MODULES: Record<Role, readonly ModuleKey[]> = {
  ADMIN: ["master-data", "ledger", "numbering", "period", "audit"],
  ACCOUNTS_TEAM: ["master-data", "ledger", "numbering", "period"],
  PROJECT_MANAGER: ["ledger"],
  SITE_ENGINEER: [],
  STORE_KEEPER: [],
  HR_MANAGER: [],
};

/** Roles that are NOT project-scoped (see all projects). The rest are scoped. */
export const UNSCOPED_ROLES: readonly Role[] = ["ADMIN", "ACCOUNTS_TEAM", "HR_MANAGER"];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** True when `role` may access `module`. */
export function canAccessModule(role: Role, module: ModuleKey): boolean {
  return ROLE_MODULES[role].includes(module);
}

/** The modules a role may access (for building the nav). */
export function modulesForRole(role: Role): readonly ModuleKey[] {
  return ROLE_MODULES[role];
}

/** True when the role sees all projects (not project-scoped). */
export function isUnscopedRole(role: Role): boolean {
  return UNSCOPED_ROLES.includes(role);
}

/** Human label for a role (en). Bangla labels come with the design-system phase. */
export function roleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    ADMIN: "Admin",
    PROJECT_MANAGER: "Project Manager",
    SITE_ENGINEER: "Site Engineer",
    STORE_KEEPER: "Store Keeper",
    ACCOUNTS_TEAM: "Accounts Team",
    HR_MANAGER: "HR Manager",
  };
  return labels[role];
}

/** Human label for a module (en). */
export function moduleLabel(module: ModuleKey): string {
  const labels: Record<ModuleKey, string> = {
    "master-data": "Master Data",
    ledger: "Ledger",
    numbering: "Numbering",
    period: "Periods",
    audit: "Audit & Access",
  };
  return labels[module];
}
