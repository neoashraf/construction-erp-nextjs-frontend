import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { type ApiError } from "@/lib/api/errors";
import { replaceRolePermissions, updateRole } from "../api";
import { type RoleDetail, type PermissionInput } from "../types";
import { ROLES_KEY } from "./use-roles";

/**
 * The batch save mutation (spec §9 — RBAC v2 atomic full-set replace). All grid
 * edits commit in ONE `PATCH /api/roles/:id/permissions` carrying the role's
 * `version` (FR-AUD-013/019); if the role's approval limit ALSO changed, a
 * `PATCH /api/roles/:id` follows for the meta (limits live on the role, not the
 * grid). A stale `version`, catalogue-invalid pair, ROLE_SCOPE_CONFLICT, or Admin
 * ADMIN_LOCKOUT_FORBIDDEN rejects the whole batch — nothing partial applies.
 */

export interface SaveRolePermissionsInput {
  role: RoleDetail;
  permissions: PermissionInput[];
  /** The role's next approval limit (Decimal string or null), if it changed; else undefined. */
  approvalLimit?: string | null;
}

export function useSaveRolePermissions() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ role, permissions, approvalLimit }: SaveRolePermissionsInput): Promise<RoleDetail> => {
      // Atomic grid replace first (the single coherent version check for the grid).
      const updated = await replaceRolePermissions(role.id, { version: role.version, permissions });
      // Role meta (approval limit) is separate from the grid; write it under the
      // freshly-bumped version so the two writes stay lock-consistent.
      if (approvalLimit !== undefined) {
        return updateRole(role.id, { approvalLimit, version: updated.version });
      }
      return updated;
    },
    onSuccess: (_result, { role }) => {
      qc.invalidateQueries({ queryKey: ROLES_KEY });
      qc.invalidateQueries({ queryKey: queryKeys.detail("audit", "roles", role.id) });
    },
    retry: false,
  });
}

export type SaveRolePermissionsError = ApiError;
