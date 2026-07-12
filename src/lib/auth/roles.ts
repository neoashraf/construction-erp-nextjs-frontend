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

import { humanizeSnakeCase } from "@/lib/format";

export const ROLES = [
  "ADMIN",
  "PROJECT_MANAGER",
  "SITE_ENGINEER",
  "STORE_KEEPER",
  "ACCOUNTS_TEAM",
  "ACCOUNTS_MANAGER", // backend rename of ACCOUNTS_TEAM (RBAC v2, BE #37) — both accepted
  "HR_MANAGER",
] as const;

export type Role = (typeof ROLES)[number];

/**
 * RBAC v2 (FE-21): built-in role names are a fallback only — visibility is
 * permission-driven where the session projection is present. Custom roles arrive
 * as arbitrary strings; `isRole` narrowing is for the six built-ins (+ the
 * ACCOUNTS_TEAM→ACCOUNTS_MANAGER rename, treated as equivalent in fallbacks).
 */
export const ACTION_CODES = [
  "CREATE", "READ", "UPDATE", "DELETE", "POST", "CANCEL", "APPROVE", "REJECT",
] as const;
export type ActionCode = (typeof ACTION_CODES)[number];

/** One effective grant (shape mirrors the session projection; see lib/auth/session). */
interface GrantLike {
  resource: string;
  action: string;
}

/**
 * Permission-set predicate (FR-AUD-032): true when the effective set covers
 * `(resource, action)`. ADMIN is the platform superuser and always passes
 * (app-shell §11 "Admin | Everything").
 */
export function hasGrant(
  viewer: { role: Role | string; permissions?: readonly GrantLike[] | null },
  resource: string,
  action: ActionCode,
): boolean {
  if (viewer.role === "ADMIN") return true;
  if (!viewer.permissions) return false;
  return viewer.permissions.some((p) => p.resource === resource && p.action === action);
}

/** The two spellings of the accounts role are equivalent in role-map fallbacks. */
export function roleMatches(listed: readonly Role[], role: Role | string): boolean {
  if (listed.includes(role as Role)) return true;
  if (role === "ACCOUNTS_MANAGER") return listed.includes("ACCOUNTS_TEAM");
  if (role === "ACCOUNTS_TEAM") return listed.includes("ACCOUNTS_MANAGER");
  return false;
}

/** App modules that own a route segment under `(app)/`. Tier-1 set + shipped Tier-2/3. */
export const MODULES = [
  "master-data",
  "ledger",
  "numbering",
  "period",
  "audit",
  "cost-control",
  "inventory",
  "requisitions",
  "sales",
] as const;

export type ModuleKey = (typeof MODULES)[number];

/**
 * Which modules each role may reach. Project-scoped roles (PM, Site Engineer,
 * Store Keeper) additionally only see their assigned projects (see project-scope.ts).
 * This is a defence-in-depth UI map — final authority is the backend's RBAC.
 *
 * NOTE: deliberately conservative; per-screen briefs refine grants as needed.
 */
const ROLE_MODULES: Record<Role, readonly ModuleKey[]> = {
  ADMIN: ["master-data", "ledger", "numbering", "period", "audit", "cost-control", "inventory", "requisitions", "sales"],
  ACCOUNTS_TEAM: ["master-data", "ledger", "numbering", "period", "cost-control", "inventory", "requisitions", "sales"],
  ACCOUNTS_MANAGER: ["master-data", "ledger", "numbering", "period", "cost-control", "inventory", "requisitions", "sales"],
  PROJECT_MANAGER: ["ledger", "cost-control", "inventory", "requisitions", "sales"],
  SITE_ENGINEER: ["requisitions"],
  STORE_KEEPER: ["inventory", "requisitions"],
  HR_MANAGER: [],
};

/** Roles that are NOT project-scoped (see all projects). The rest are scoped. */
export const UNSCOPED_ROLES: readonly Role[] = ["ADMIN", "ACCOUNTS_TEAM", "ACCOUNTS_MANAGER", "HR_MANAGER"];

/**
 * Module segment → the Resource-Catalogue prefix(es) its screens' grants use
 * (FE-21). A session holding ANY READ grant on a matching resource may enter the
 * segment; the per-screen affordances then key on their own exact resource.
 */
export const MODULE_RESOURCE_PREFIX: Record<ModuleKey, readonly string[]> = {
  "master-data": ["master_data."],
  ledger: ["ledger."],
  numbering: ["numbering"],
  period: ["periods"],
  audit: ["audit."],
  "cost-control": ["cost_control."],
  inventory: ["inventory."],
  requisitions: ["requisitions."],
  sales: ["sales."],
};

/** True when the effective set holds any READ grant inside the module (FE-21). */
export function hasModuleGrant(
  viewer: { role: Role | string; permissions?: readonly { resource: string; action: string }[] | null },
  module: ModuleKey,
): boolean {
  if (viewer.role === "ADMIN") return true;
  if (!viewer.permissions) return false;
  const prefixes = MODULE_RESOURCE_PREFIX[module];
  return viewer.permissions.some(
    (p) =>
      p.action === "READ" &&
      prefixes.some((prefix) => (prefix.endsWith(".") ? p.resource.startsWith(prefix) : p.resource === prefix)),
  );
}

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
export function roleLabel(role: Role | string): string {
  const labels: Record<Role, string> = {
    ADMIN: "Admin",
    PROJECT_MANAGER: "Project Manager",
    SITE_ENGINEER: "Site Engineer",
    STORE_KEEPER: "Store Keeper",
    ACCOUNTS_TEAM: "Accounts Team",
    ACCOUNTS_MANAGER: "Accounts Manager",
    HR_MANAGER: "HR Manager",
  };
  // Custom roles (RBAC v2) arrive as arbitrary strings — humanize their code so the
  // UI never shows a raw underscore-joined name (shared `humanizeSnakeCase`).
  return labels[role as Role] ?? humanizeSnakeCase(role);
}

/** Human label for a module (en). */
export function moduleLabel(module: ModuleKey): string {
  const labels: Record<ModuleKey, string> = {
    "master-data": "Master Data",
    ledger: "Ledger",
    numbering: "Numbering",
    period: "Periods",
    audit: "Audit & Access",
    "cost-control": "Cost Control",
    inventory: "Inventory",
    requisitions: "Requisitions",
    sales: "Sales / IPC",
  };
  return labels[module];
}
