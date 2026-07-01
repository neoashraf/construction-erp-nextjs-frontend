import { apiClient } from "@/lib/api";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import {
  type PermissionRecord,
  type CreatePermissionInput,
  type UpdatePermissionInput,
} from "../types";

/**
 * Permissions API bindings (API contract 05 § Permissions, Admin only). A
 * `Permission` is a `(role, module, action)` grant with a `projectScope` and an
 * optional per-permission `valueLimit` (FR-AUD-013/016). Grants/revokes/scope-limit
 * edits are the batched-save operations the role-permission editor issues
 * (spec §9) — each write carries the role's `version` where the endpoint takes one.
 *
 * Import boundary: this feature imports `@/lib/api`, never `@/lib/api/generated/*`.
 */

const BASE = "/permissions";

interface Envelope<T> {
  data: T;
}

function csrf() {
  return { csrfToken: readCsrfToken() };
}

/** POST a new grant. `DUPLICATE_PERMISSION` (409) means it already exists — reconcile as on. */
export async function createPermission(input: CreatePermissionInput): Promise<PermissionRecord> {
  const res = await apiClient.post<Envelope<PermissionRecord>>(BASE, input, csrf());
  return res.data;
}

/** PATCH a grant's scope/limit; carries the role's `version` for the optimistic lock. */
export async function updatePermission(
  id: string,
  input: UpdatePermissionInput,
): Promise<PermissionRecord> {
  const res = await apiClient.patch<Envelope<PermissionRecord>>(`${BASE}/${id}`, input, csrf());
  return res.data;
}

/** DELETE (revoke) a grant. */
export async function deletePermission(id: string): Promise<void> {
  await apiClient.delete<void>(`${BASE}/${id}`, csrf());
}
