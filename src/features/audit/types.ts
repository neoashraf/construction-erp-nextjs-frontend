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
 * A user list row (API contract 05 `GET /api/users` item · RBAC v2). Never carries
 * `password_hash` or any encrypted-at-rest field (FR-AUD-002/010) — the API omits
 * them, and this type has no field for them by design. The `role*` fields (BE #43)
 * let the UI key the Custom tag + project-scope display on the payload directly,
 * not on a fragile role-name match.
 */
export interface UserListItem {
  id: string;
  email: string;
  name: string;
  /** Role NAME (built-in enum or a custom-role string) — for display. */
  role: UserRole | string;
  /** Role UUID (the picker/filter value). */
  roleId: string;
  /** `false` = a custom role → the "Custom" tag. */
  roleIsSystem: boolean;
  /** `true` → the user sees "All projects" (no assignment); else the assigned count. */
  roleIsUnscoped: boolean;
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
  /** Role UUID (drives the edit-drawer picker + payload-keyed scope/tag). */
  roleId: string;
  roleIsSystem: boolean;
  roleIsUnscoped: boolean;
  financialYearId: string;
  isActive: boolean;
  lastLoginAt: string | null;
  /** FR-AUD-030 — `true` while the user is still on a temporary/reset password. */
  mustChangePassword: boolean;
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

// ── Role & permission editor (FE-22 · RBAC v2) ──────────────────────────────

/**
 * RBAC v2 (FR-AUD-035): permissions are `(resource, action)` grants over a
 * **Resource Catalogue** of screen/feature codes — NOT the old fixed 16-module ×
 * 8-action matrix. The grid rows come exclusively from `GET /api/permissions/catalog`
 * (there is deliberately no hardcoded module/resource list in this feature); each
 * resource enables only the actions it declares.
 */

/** One resource (screen/feature) in the catalogue — a grid row. */
export interface ResourceCatalogEntry {
  /** Resource code, e.g. `cost_control.profitability`. */
  resource: string;
  /** Human label for the editor. */
  label: string;
  /** The actions this resource declares — the only enabled cells in its row. */
  actions: readonly string[];
}

/** One module group in the catalogue — a collapsible section of resource rows. */
export interface ResourceCatalogModule {
  /** Owning nav module code (groups the catalogue). */
  module: string;
  /** Human label for the group header. */
  label: string;
  resources: readonly ResourceCatalogEntry[];
}

/** The Resource Catalogue (`GET /api/permissions/catalog` response). */
export interface PermissionCatalog {
  modules: readonly ResourceCatalogModule[];
}

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

/** A role list row (API contract 05 `GET /api/roles` item; RBAC v2). */
export interface RoleListItem {
  id: string;
  name: RoleName | string;
  /** `true` for the six protected built-ins (name-locked, non-deletable). */
  isSystem: boolean;
  approvalLimit: string | null;
  isUnscoped: boolean;
  /** Users holding this role — drives the delete guard (ROLE_IN_USE) + the count chip. */
  userCount: number;
  version: number;
}

/** One `(role, resource, action)` grant (API `GET /api/roles/:id` `permissions[]`; RBAC v2). */
export interface PermissionRecord {
  id: string;
  resource: string;
  action: PermissionAction | string;
  projectScope: ProjectScope;
  valueLimit: string | null;
}

/** The role detail (API `GET /api/roles/:id`). `version` drives the batch save's lock. */
export interface RoleDetail {
  id: string;
  name: RoleName | string;
  isSystem: boolean;
  approvalLimit: string | null;
  isUnscoped: boolean;
  userCount: number;
  version: number;
  permissions: PermissionRecord[];
}

/** One grant in a batch replace / role-create payload. */
export interface PermissionInput {
  resource: string;
  action: PermissionAction | string;
  projectScope: ProjectScope;
  valueLimit?: string | null;
}

/** `POST /api/roles` request body — create a custom role (FR-AUD-034). */
export interface CreateRoleInput {
  name: string;
  isUnscoped?: boolean;
  approvalLimit?: string | null;
  permissions?: PermissionInput[];
}

/** `PATCH /api/roles/:id` request body — role meta only (name for custom; FR-AUD-016/019/034). */
export interface UpdateRoleInput {
  name?: string;
  approvalLimit?: string | null;
  isUnscoped?: boolean;
  version: number;
}

/** `PATCH /api/roles/:id/permissions` request body — atomic full-set grid replace (spec §9). */
export interface ReplaceRolePermissionsInput {
  version: number;
  permissions: PermissionInput[];
}

/**
 * One grid cell's edited state, keyed by `"<resource>|<action>"` in the pending-edit
 * set (spec §9 batch model). `null` means the cell is revoked/ungranted; otherwise
 * it carries the working scope + limit for that grant.
 */
export interface PendingCellEdit {
  scope: ProjectScope;
  /** `Decimal(18,4)` string, or null = inherits the role's `approvalLimit` ("Role limit"). */
  valueLimit: string | null;
}

/** The full pending-edit set for the role being edited: `"<resource>|<action>"` -> edit or null. */
export type PendingPermissionMap = Record<string, PendingCellEdit | null>;

// ── Project assignment (FE-19) ──────────────────────────────────────────────

/**
 * A minimal project option for the add-projects picker (API contract 01
 * `GET /api/masters/projects` item, filtered to this company). Not the full MAS
 * `Project` — this feature never imports `features/master-data` (skill §2.4).
 */
export interface ProjectOption {
  id: string;
  name: string;
  projectCode: string;
}

/**
 * One row of the user's assigned-project set (API `GET /api/users/:id/projects`
 * list item). `projectName` may be absent when the project record can no longer
 * be resolved (spec §6 "partial" — id fallback + refresh hint, SRS §12 edge 12).
 */
export interface AssignedProject {
  projectId: string;
  projectName: string | null;
}

/**
 * The `GET /api/users/:id/projects` response (API contract 05 § User <-> Project
 * assignment). An unscoped role (Admin, Accounts Team) returns `{ scope: "ALL" }`
 * instead of a list — spec §5/§6 "All projects" banner, editing disabled.
 */
export type UserProjectAssignment =
  { scope: "ASSIGNED"; projects: AssignedProject[] } | { scope: "ALL" };

/** `PUT /api/users/:id/projects` request body — full-set replace (spec §9; SRS §16). No `version`. */
export interface ReplaceAssignedProjectsInput {
  projectIds: string[];
}

// ── Audit log viewer (FE-20) ────────────────────────────────────────────────

/**
 * The audit-log `action` enum. The SRS/screen-spec's 7 lifecycle actions
 * (FR-AUD-020/021) plus the two the live backend also emits/validates
 * (`ACTIVATE`/`DEACTIVATE` — user activation toggles) so the filter never sends a
 * value the API would reject with `VALIDATION_ERROR`. `EXPORT` itself is
 * write-only (emitted when an export runs) and is deliberately NOT filterable —
 * mirrors the backend's `VALID_FILTER_ACTIONS` set.
 */
export const AUDIT_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "POST",
  "CANCEL",
  "APPROVE",
  "REJECT",
  "ACTIVATE",
  "DEACTIVATE",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Per-action badge tone (design file — action→badge tones). */
export type AuditActionTone = "positive" | "info" | "negative" | "brand" | "warning";

export const AUDIT_ACTION_TONE: Record<AuditAction, AuditActionTone> = {
  CREATE: "positive",
  UPDATE: "info",
  DELETE: "negative",
  POST: "brand",
  CANCEL: "warning",
  APPROVE: "positive",
  REJECT: "negative",
  ACTIVATE: "positive",
  DEACTIVATE: "warning",
};

/**
 * One audit-log list row (API contract 05 `GET /api/audit-logs` item; FR-AUD-020/
 * 021/026). The live endpoint's projection carries `userId` only (no `userName`
 * resolved in the list projection — confirmed against the merged backend); the
 * Actor cell falls back to the id. `projectId`/`ipAddress` are nullable — the UI
 * renders "—" for either (spec §6 partial state).
 */
export interface AuditLogRow {
  id: string;
  action: AuditAction | string;
  entityType: string;
  entityId: string;
  userId: string;
  userName?: string | null;
  projectId: string | null;
  ipAddress: string | null;
  createdAt: string; // ISO-8601 UTC
}

/**
 * The audit-log detail (API `GET /api/audit-logs/:id`; FR-AUD-022/024). `before`
 * is null on CREATE, `after` is null on DELETE, both populated on UPDATE/POST/
 * CANCEL/APPROVE/REJECT/ACTIVATE/DEACTIVATE. `before`/`after` are API-sanitised —
 * never render `password_hash`/encrypted fields even if present (defence-in-depth,
 * the UI does not special-case field names to hide, it trusts the API contract).
 * `seal` is display-only — no verify control exists (SRS §16).
 */
export interface AuditLogDetail {
  id: string;
  action: AuditAction | string;
  entityType: string;
  entityId: string;
  userId: string;
  userName?: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ipAddress: string | null;
  seal: string;
  createdAt: string; // ISO-8601 UTC
}

/** Query filters for `GET /api/audit-logs` (list) and `GET /api/audit-logs/export` — all optional, AND-combined. */
export interface AuditLogFilter {
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: AuditAction | string;
  projectId?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  page?: number;
  pageSize?: number;
}

/** `GET /api/audit-logs/export` format (default `csv` per the contract). */
export type AuditExportFormat = "csv" | "xlsx";

/**
 * One changed/unchanged field in the before/after diff (view-model computed
 * client-side from `before`/`after` — FR-AUD-022; spec §5/§9).
 */
export interface AuditDiffField {
  field: string;
  before: unknown;
  after: unknown;
  changed: boolean;
}

/** The diff view-model for one detail entry (CREATE → after-only, DELETE → before-only, else both). */
export interface AuditDiffViewModel {
  mode: "create" | "delete" | "both";
  fields: AuditDiffField[];
}
