import { apiClient } from "@/lib/api";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import { type RoleListItem, type RoleDetail, type UpdateRoleInput } from "../types";

/**
 * Roles API bindings (API contract 05 § Roles, Admin only). The six roles are
 * fixed/pre-seeded (no create/delete) — writes only adjust `approvalLimit` /
 * `isUnscoped`, optimistic-locked via `version` (FR-AUD-016/019).
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

/** GET the six fixed roles (small, unpaginated set). */
export async function listRoles(): Promise<RoleListItem[]> {
  const res = await apiClient.get<{ data: RoleListItem[] }>(BASE);
  return res.data;
}

/** GET one role with its full permission grant list + `version` (company-scoped). */
export async function getRole(id: string): Promise<RoleDetail> {
  const res = await apiClient.get<Envelope<RoleDetail>>(`${BASE}/${id}`);
  return res.data;
}

/** PATCH a role's `approvalLimit` / `isUnscoped`, carrying `version` for the optimistic lock. */
export async function updateRole(id: string, input: UpdateRoleInput): Promise<RoleDetail> {
  const res = await apiClient.patch<Envelope<RoleDetail>>(`${BASE}/${id}`, input, csrf());
  return res.data;
}
