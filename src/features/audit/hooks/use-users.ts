import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  activateUser,
  deactivateUser,
  resetUserPassword,
  listFinancialYearOptions,
  type UserListFilter,
} from "../api";
import { type CreateUserInput, type UpdateUserInput, type ResetPasswordInput } from "../types";

/**
 * User-management hooks (skill §7; spec §9). Server-confirmed mutations — no
 * optimistic flip for activate/deactivate/reset (spec §9) — every mutation
 * invalidates the list (and the detail, where relevant) on success so the row/
 * badge reflects the server's response, never a local guess.
 */

export const USERS_KEY = ["audit", "users"] as const;

/**
 * Filtered, paginated user list (FR-AUD-011/018/027). `enabled` lets the Admin-only
 * screen skip the request entirely for a non-Admin session (defence-in-depth —
 * the inline 403 view never needs a fetch, and the backend would 403 it anyway).
 */
export function useUsersList(filter: UserListFilter, enabled = true) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("audit", "users", scope, filter as Record<string, unknown>),
    queryFn: () => listUsers(filter),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** A single user by id (FR-AUD-011/027); a stale link 404s as NOT_FOUND (spec §13). */
export function useUserDetail(id: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.detail("audit", "users", id ?? ""),
    queryFn: () => getUser(id as string),
    enabled: enabled && !!id,
    retry: false,
  });
}

/** Financial-year options for the create/edit form's FY select. */
export function useFinancialYearOptions() {
  return useQuery({
    queryKey: ["audit", "users", "financial-year-options"],
    queryFn: () => listFinancialYearOptions(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
    retry: false,
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) => updateUser(id, input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: USERS_KEY });
      qc.invalidateQueries({ queryKey: queryKeys.detail("audit", "users", vars.id) });
    },
    retry: false,
  });
}

/** Server-confirmed activate (spec §9) — no optimistic flip. */
export function useActivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => activateUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
    retry: false,
  });
}

/** Server-confirmed deactivate (spec §9) — revokes refresh tokens; no optimistic flip. */
export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
    retry: false,
  });
}

/**
 * Reset password — `204` no content; nothing secret ever flows back through this
 * hook (_open-questions.md AUD 4). Callers show the fixed success copy, never a
 * password from the response.
 */
export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ResetPasswordInput }) =>
      resetUserPassword(id, input),
    retry: false,
  });
}
