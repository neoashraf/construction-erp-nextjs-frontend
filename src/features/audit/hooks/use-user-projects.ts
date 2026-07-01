import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { getAssignedProjects, replaceAssignedProjects, listProjectOptions } from "../api";
import { type ReplaceAssignedProjectsInput } from "../types";

/**
 * Project-assignment hooks (skill §7; spec §9). The replace-set mutation is a
 * single batched `PUT` — no per-row mutation, no optimistic flip (server-
 * confirmed only, SRS §16: last-writer-wins on the whole set, no `version`).
 */

/** The target user's assigned-project set (or the all-projects scope marker). */
export function useAssignedProjects(userId: string, enabled = true) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("audit", "user-projects", scope, { userId }),
    queryFn: () => getAssignedProjects(userId),
    enabled: enabled && !!userId,
    retry: false,
  });
}

/** Every project in this company, for the add-projects picker (client-side search filter). */
export function useProjectOptions(enabled = true) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("audit", "project-options", scope),
    queryFn: () => listProjectOptions(),
    enabled,
    staleTime: 60 * 1000,
  });
}

/**
 * Commit the pending set as ONE full-set-replace `PUT` (spec §9 — not an append).
 * On success, invalidates this user's assigned-projects query so the list re-
 * renders from the server's confirmed set.
 */
export function useReplaceAssignedProjects(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReplaceAssignedProjectsInput) => replaceAssignedProjects(userId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.module("audit") });
    },
    retry: false,
  });
}
