import { apiClient } from "@/lib/api";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import {
  type RoleListItem,
  type RoleDetail,
  type CreateRoleInput,
  type UpdateRoleInput,
  type ReplaceRolePermissionsInput,
} from "../types";

/**
 * Roles API bindings (API contract 05 § Roles, Admin only · RBAC v2). Roles are a
 * dynamic set — six protected built-ins (`isSystem`) plus Admin-created custom
 * roles: create / rename / edit / delete (FR-AUD-034), each meta write
 * optimistic-locked via `version`. The permission grid persists atomically through
 * `replaceRolePermissions` (full-set replace, one version check — FR-AUD-013/019).
 *
 * Import boundary: this feature imports `@/lib/api`, never `@/lib/api/generated/*`.
 */

const BASE = "/roles";

interface Envelope<T> {
  data: T;
}

function csrf() {
  return { csrfToken: readCsrfToken() };
}

/** GET all roles (built-in + custom), each with `isSystem` + `userCount` + `version`. */
export async function listRoles(): Promise<RoleListItem[]> {
  const res = await apiClient.get<{ data: RoleListItem[] }>(BASE);
  return res.data;
}

/** GET one role with its full resource-level grant list + `version` (company-scoped). */
export async function getRole(id: string): Promise<RoleDetail> {
  const res = await apiClient.get<Envelope<RoleDetail>>(`${BASE}/${id}`);
  return res.data;
}

/** POST a new custom role (FR-AUD-034); may seed its grid via `permissions`. */
export async function createRole(input: CreateRoleInput): Promise<RoleDetail> {
  const res = await apiClient.post<Envelope<RoleDetail>>(BASE, input, csrf());
  return res.data;
}

/** PATCH role meta (`name` for custom roles, `approvalLimit`, `isUnscoped`) under `version`. */
export async function updateRole(id: string, input: UpdateRoleInput): Promise<RoleDetail> {
  const res = await apiClient.patch<Envelope<RoleDetail>>(`${BASE}/${id}`, input, csrf());
  return res.data;
}

/** DELETE a custom role (built-ins reject `SYSTEM_ROLE_IMMUTABLE`; in-use → `ROLE_IN_USE`). */
export async function deleteRole(id: string): Promise<void> {
  await apiClient.delete<void>(`${BASE}/${id}`, csrf());
}

/**
 * PATCH the role's ENTIRE permission grid in one atomic write under a single
 * optimistic-lock `version` check — the batch persistence model this editor uses
 * (its Save + module/resource bulk toggles commit here; FR-AUD-013/019/020/034/035).
 * Returns the updated role with its bumped `version`.
 */
export async function replaceRolePermissions(
  id: string,
  input: ReplaceRolePermissionsInput,
): Promise<RoleDetail> {
  const res = await apiClient.patch<Envelope<RoleDetail>>(`${BASE}/${id}/permissions`, input, csrf());
  return res.data;
}
