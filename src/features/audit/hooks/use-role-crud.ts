import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { type ApiError } from "@/lib/api/errors";
import { createRole, updateRole, deleteRole } from "../api";
import { type RoleDetail, type CreateRoleInput, type UpdateRoleInput } from "../types";
import { ROLES_KEY } from "./use-roles";

/**
 * Custom-role CRUD mutations (FR-AUD-034). Create a custom role (optionally seeding
 * its grid), rename/edit meta (custom only — built-ins reject SYSTEM_ROLE_IMMUTABLE),
 * or delete a custom role (blocked ROLE_IN_USE while assigned). All invalidate the
 * role list; edits/deletes also invalidate the affected detail.
 */

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoleInput): Promise<RoleDetail> => createRole(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROLES_KEY }),
    retry: false,
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRoleInput }): Promise<RoleDetail> =>
      updateRole(id, input),
    onSuccess: (_r, { id }) => {
      qc.invalidateQueries({ queryKey: ROLES_KEY });
      qc.invalidateQueries({ queryKey: queryKeys.detail("audit", "roles", id) });
    },
    retry: false,
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string): Promise<void> => deleteRole(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROLES_KEY }),
    retry: false,
  });
}

export type RoleCrudError = ApiError;
