import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { listRoles, getRole } from "../api";

/**
 * Role list + role detail queries (skill §7). The six roles are a small,
 * pre-seeded set (FR-AUD-011) — no pagination. `useRole` carries the `version`
 * the batched save's optimistic lock needs (FR-AUD-019).
 */

export const ROLES_KEY = ["audit", "roles"] as const;

/**
 * The six fixed roles for the role selector (spec §5). `enabled` lets the
 * Admin-only screen skip the request entirely for a non-Admin session (defence-
 * in-depth — mirrors `useUsersList`'s pattern in this module).
 */
export function useRoles(enabled = true) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("audit", "roles", scope),
    queryFn: () => listRoles(),
    enabled,
  });
}

/** One role's full grant list + `version` (FR-AUD-011/013/016/019). */
export function useRole(id: string | null) {
  return useQuery({
    queryKey: queryKeys.detail("audit", "roles", id ?? ""),
    queryFn: () => getRole(id as string),
    enabled: !!id,
    retry: false,
  });
}

/** Invalidate both the role list and a specific role's detail (after a successful save). */
export function useInvalidateRole() {
  const qc = useQueryClient();
  return (id: string) => {
    qc.invalidateQueries({ queryKey: ROLES_KEY });
    qc.invalidateQueries({ queryKey: queryKeys.detail("audit", "roles", id) });
  };
}
