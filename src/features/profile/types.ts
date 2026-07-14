/**
 * FE-52 fe-account-profile — DTOs for the self-service profile surface (SRS §8;
 * FR-AUD-029..043). Mirrors the AUD ProfileView contract (see
 * `codebases/ze-erp-nestjs-backend/src/core/auth/read/dto/profile-view.dto.ts`):
 * NEVER carries `password_hash` or `avatar_public_id` (FR-AUD-043); NEVER carries
 * `permissions` (that lives on `/api/auth/me`).
 */

export type AssignedProjectsScope =
  | { scope: "ALL" }
  | Array<{ projectId: string; projectName: string }>;

export interface ProfileView {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  role: string;
  isUnscoped: boolean;
  isActive: boolean;
  financialYearId: string;
  lastLoginAt: string | null;
  assignedProjects: AssignedProjectsScope;
  version: number;
}

/** PATCH body — only name/phone are editable; `version` is required for optimistic lock. */
export interface ProfileUpdate {
  name?: string;
  phone?: string | null;
  version: number;
}
