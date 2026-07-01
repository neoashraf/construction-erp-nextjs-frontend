/**
 * View-model types for the Audit, Security & Access (AUD) feature (skill §2.1).
 * These are UI-facing types — NOT the generated wire types in lib/api/generated.
 */

/** Variant for the auth error banner (login screen). */
export type AuthBannerVariant = "auth" | "session" | "offline";

/** Safe user fields returned by the BFF login endpoint (no token fields). */
export interface LoginSessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string;
  financialYearId: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

/**
 * Variant for the change-password screen's banner (spec §6/§8). "forced" is the
 * blue "required" status banner shown in forced-change mode; "success"/"offline"
 * are the post-submit outcome banners.
 */
export type ChangePasswordBannerVariant = "forced" | "success" | "offline";

/** Live password-strength estimate for the new-password field (spec §5, advisory only). */
export interface PasswordStrength {
  /** 0 = empty, 1..4 = weak..strong. */
  score: 0 | 1 | 2 | 3 | 4;
  label: "—" | "Weak" | "Fair" | "Good" | "Strong";
}

/** One row of the live policy checklist (spec §5/§6 — SRS §16: min 10 + complexity). */
export interface PolicyChecklistItem {
  id: "length" | "complexity";
  label: string;
  met: boolean;
}

// ── User management (FE-17) ─────────────────────────────────────────────────

/**
 * The six platform roles (FR-AUD-011). Mirrors `lib/auth/roles.ts` `Role` — kept
 * as a separate literal union here so this feature never imports the app-shell's
 * route-guard module (skill §2.4 import boundaries); the values are identical.
 */
export const USER_ROLES = [
  "ADMIN",
  "PROJECT_MANAGER",
  "SITE_ENGINEER",
  "STORE_KEEPER",
  "ACCOUNTS_TEAM",
  "HR_MANAGER",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** Roles that see every project (no project-assignment needed) — spec §5 "All projects". */
export const UNSCOPED_USER_ROLES: readonly UserRole[] = ["ADMIN", "ACCOUNTS_TEAM", "HR_MANAGER"];

export function isUnscopedUserRole(role: UserRole | string): boolean {
  return (UNSCOPED_USER_ROLES as readonly string[]).includes(role);
}

/** Human label for a role (design file §5; en). Bangla labels come with later phases. */
export const USER_ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  SITE_ENGINEER: "Site Engineer",
  STORE_KEEPER: "Store Keeper",
  ACCOUNTS_TEAM: "Accounts Team",
  HR_MANAGER: "HR Manager",
};

export function userRoleLabel(role: UserRole | string): string {
  return USER_ROLE_LABEL[role as UserRole] ?? role;
}

/**
 * A user list row (API contract 05 `GET /api/users` item). Never carries
 * `password_hash` or any encrypted-at-rest field (FR-AUD-002/010) — the API omits
 * them, and this type has no field for them by design.
 */
export interface UserListItem {
  id: string;
  email: string;
  name: string;
  role: UserRole | string;
  isActive: boolean;
  lastLoginAt: string | null;
  assignedProjectCount: number;
}

/** One assigned-project summary row (API `GET /api/users/:id` `assignedProjects[]`). */
export interface AssignedProjectRef {
  projectId: string;
  projectName: string;
}

/**
 * The user detail (API `GET /api/users/:id`). `version` drives optimistic
 * concurrency on `PATCH /api/users/:id` (FR-AUD-019). No `password_hash`.
 */
export interface UserDetail {
  id: string;
  email: string;
  name: string;
  role: UserRole | string;
  financialYearId: string;
  isActive: boolean;
  lastLoginAt: string | null;
  phone: string | null;
  assignedProjects: AssignedProjectRef[];
  version: number;
}

/** `POST /api/users` request body (spec §7). `temporaryPassword` is write-only. */
export interface CreateUserInput {
  email: string;
  name: string;
  roleId: string;
  financialYearId: string;
  phone?: string;
  temporaryPassword: string;
  isActive?: boolean;
}

/** `PATCH /api/users/:id` request body — no email/password edit here (spec §7). */
export interface UpdateUserInput {
  name?: string;
  roleId?: string;
  financialYearId?: string;
  phone?: string;
  version: number;
}

/** `POST /api/users/:id/reset-password` request body — empty to system-generate. */
export interface ResetPasswordInput {
  temporaryPassword?: string;
}

/** A minimal financial-year option for the create/edit form's FY select. */
export interface FinancialYearOption {
  id: string;
  label: string;
}

// ── Role & permission editor (FE-18) ────────────────────────────────────────

/** The overview §4 module codes a permission grant can target (SRS §8 `Permission.module`). */
export const PERMISSION_MODULES = [
  "MAS",
  "LED",
  "NUM",
  "PER",
  "SAL",
  "PUR",
  "PAY",
  "REC",
  "GEN",
  "INV",
  "CC",
  "REQ",
  "HR",
  "RPT",
  "DSH",
  "AUD",
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

/** Human label for a module code (design file §5; en). */
export const PERMISSION_MODULE_LABEL: Record<PermissionModule, string> = {
  MAS: "Master Data",
  LED: "Ledger",
  NUM: "Numbering",
  PER: "Periods",
  SAL: "Sales & Billing",
  PUR: "Purchases",
  PAY: "Payments",
  REC: "Receipts",
  GEN: "General Journal",
  INV: "Inventory",
  CC: "Cost Centres",
  REQ: "Requisitions",
  HR: "HR & Payroll",
  RPT: "Reports",
  DSH: "Dashboard",
  AUD: "Audit & Access",
};

/** The 8 grantable actions (SRS §8 `Permission.action`; FR-AUD-013). */
export const PERMISSION_ACTIONS = [
  "CREATE",
  "READ",
  "UPDATE",
  "DELETE",
  "POST",
  "CANCEL",
  "APPROVE",
  "REJECT",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const PERMISSION_ACTION_LABEL: Record<PermissionAction, string> = {
  CREATE: "Create",
  READ: "Read",
  UPDATE: "Update",
  DELETE: "Delete",
  POST: "Post",
  CANCEL: "Cancel",
  APPROVE: "Approve",
  REJECT: "Reject",
};

/** Project-scope mode on a granted permission (SRS §8 `Permission.project_scope`). */
export const PROJECT_SCOPES = ["ALL", "ASSIGNED"] as const;
export type ProjectScope = (typeof PROJECT_SCOPES)[number];

/** The six fixed platform roles, in the design file's Role-selector order. */
export const ROLE_NAMES = [
  "ADMIN",
  "ACCOUNTS_TEAM",
  "PROJECT_MANAGER",
  "SITE_ENGINEER",
  "STORE_KEEPER",
  "HR_MANAGER",
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

export const ROLE_NAME_LABEL: Record<RoleName, string> = {
  ADMIN: "Admin",
  ACCOUNTS_TEAM: "Accounts Team",
  PROJECT_MANAGER: "Project Manager",
  SITE_ENGINEER: "Site Engineer",
  STORE_KEEPER: "Store Keeper",
  HR_MANAGER: "HR Manager",
};

/** A role list row (API contract 05 `GET /api/roles` item). */
export interface RoleListItem {
  id: string;
  name: RoleName | string;
  approvalLimit: string | null;
  isUnscoped: boolean;
  version: number;
}

/** One `(role, module, action)` grant (API `GET /api/roles/:id` `permissions[]`). */
export interface PermissionRecord {
  id: string;
  module: PermissionModule | string;
  action: PermissionAction | string;
  projectScope: ProjectScope;
  valueLimit: string | null;
}

/** The role detail (API `GET /api/roles/:id`). `version` drives the batched save's lock. */
export interface RoleDetail {
  id: string;
  name: RoleName | string;
  approvalLimit: string | null;
  isUnscoped: boolean;
  version: number;
  permissions: PermissionRecord[];
}

/** `PATCH /api/roles/:id` request body (spec §7; FR-AUD-016/019). */
export interface UpdateRoleInput {
  approvalLimit?: string | null;
  isUnscoped?: boolean;
  version: number;
}

/** `POST /api/permissions` request body (spec §7; FR-AUD-013/016). */
export interface CreatePermissionInput {
  roleId: string;
  module: PermissionModule | string;
  action: PermissionAction | string;
  projectScope: ProjectScope;
  valueLimit?: string | null;
}

/** `PATCH /api/permissions/:id` request body — carries the role's `version` (spec §9). */
export interface UpdatePermissionInput {
  projectScope?: ProjectScope;
  valueLimit?: string | null;
  version: number;
}

/**
 * One grid cell's edited state, keyed by `"<module>|<action>"` in the pending-edit
 * set (spec §9 batch model). `null` means the cell is revoked/ungranted; otherwise
 * it carries the working scope + limit for that grant.
 */
export interface PendingCellEdit {
  scope: ProjectScope;
  /** `Decimal(18,4)` string, or null = inherits the role's `approvalLimit` ("Role limit"). */
  valueLimit: string | null;
}

/** The full pending-edit set for the role being edited: `"<module>|<action>"` -> edit or null (revoked). */
export type PendingPermissionMap = Record<string, PendingCellEdit | null>;

/** One diffed write the batched save will issue (spec §9). */
export type PermissionDiffOp =
  | {
      kind: "grant";
      module: PermissionModule | string;
      action: PermissionAction | string;
      scope: ProjectScope;
      valueLimit: string | null;
    }
  | { kind: "revoke"; permissionId: string }
  | { kind: "update"; permissionId: string; scope?: ProjectScope; valueLimit?: string | null };

/** The full diff for one save: permission ops + whether the approval limit itself changed. */
export interface PermissionBatchDiff {
  ops: PermissionDiffOp[];
  approvalLimitChanged: boolean;
  approvalLimit: string | null;
}
