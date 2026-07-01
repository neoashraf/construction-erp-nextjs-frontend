import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { asApiError, type ApiError } from "@/lib/api/errors";
import { createPermission, updatePermission, deletePermission, updateRole } from "../api";
import { type RoleDetail, type PermissionBatchDiff } from "../types";
import { ROLES_KEY } from "./use-roles";

/**
 * The batched save mutation (spec §9 — the load-bearing optimistic-lock model).
 * Grants -> `POST /api/permissions`, revokes -> `DELETE /api/permissions/:id`,
 * scope/limit changes -> `PATCH /api/permissions/:id`, and (if the approval limit
 * itself changed) `PATCH /api/roles/:id` — every write that accepts a `version`
 * carries the role's current one (FR-AUD-013, FR-AUD-016, FR-AUD-019).
 *
 * `DUPLICATE_PERMISSION` (409) on a grant is reconciled silently as already-on
 * (spec §6) rather than failing the whole batch — the other ops still proceed.
 * Any `OPTIMISTIC_LOCK_CONFLICT` (from the role PATCH, the source of the single
 * coherent version check) aborts the remaining ops and surfaces the conflict
 * banner; the caller preserves the Admin's pending edits for re-entry (never a
 * silent overwrite).
 */

export interface SaveRolePermissionsInput {
  role: RoleDetail;
  diff: PermissionBatchDiff;
}

export interface SaveRolePermissionsResult {
  /** True when the role's approval limit still needs writing (kept version-safe). */
  roleUpdated: boolean;
}

export function useSaveRolePermissions() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      role,
      diff,
    }: SaveRolePermissionsInput): Promise<SaveRolePermissionsResult> => {
      // Grants and revokes/updates first — the role PATCH (approval limit) is last
      // so it can carry the version that "closes" this save as one coherent lock
      // check (spec §9: "a single coherent optimistic-lock check per save").
      for (const op of diff.ops) {
        if (op.kind === "grant") {
          try {
            await createPermission({
              roleId: role.id,
              module: op.module,
              action: op.action,
              projectScope: op.scope,
              valueLimit: op.valueLimit,
            });
          } catch (err) {
            const e = asApiError(err);
            if (e.code !== "DUPLICATE_PERMISSION") throw e;
            // Already granted server-side — reconcile silently as on (spec §6).
          }
        } else if (op.kind === "revoke") {
          await deletePermission(op.permissionId);
        } else {
          await updatePermission(op.permissionId, {
            projectScope: op.scope,
            valueLimit: op.valueLimit,
            version: role.version,
          });
        }
      }

      if (diff.approvalLimitChanged) {
        await updateRole(role.id, { approvalLimit: diff.approvalLimit, version: role.version });
        return { roleUpdated: true };
      }
      return { roleUpdated: false };
    },
    onSuccess: (_result, { role }) => {
      qc.invalidateQueries({ queryKey: ROLES_KEY });
      qc.invalidateQueries({ queryKey: queryKeys.detail("audit", "roles", role.id) });
    },
    retry: false,
  });
}

export type SaveRolePermissionsError = ApiError;
