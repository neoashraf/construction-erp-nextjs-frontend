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
