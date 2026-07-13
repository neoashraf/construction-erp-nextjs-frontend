import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import {
  createPurpose,
  listCostCentreOptions,
  listGodownOptions,
  listItemOptions,
  listProjectOptions,
  listPurposeOptions,
  listUserOptions,
} from "../api/masters";
import { getStockBalance } from "../api/stock-ledger";

/**
 * Editor/filter picker-option hooks + the on-hand balance (skill §7). Masters change
 * rarely → a longer `staleTime`; tenant-scoped keys refetch on a company switch. Godowns
 * and purposes are project-scoped (fetched per selected project).
 */
const STALE = 5 * 60_000;

function useScope() {
  const user = useAuthenticatedUser();
  return { companyId: user.companyId, financialYearId: user.financialYearId };
}

export function useProjectOptions() {
  const scope = useScope();
  return useQuery({ queryKey: queryKeys.list("inventory", "project-options", scope), queryFn: listProjectOptions, staleTime: STALE });
}
export function useCostCentreOptions() {
  const scope = useScope();
  return useQuery({ queryKey: queryKeys.list("inventory", "cc-options", scope), queryFn: listCostCentreOptions, staleTime: STALE });
}
export function useItemOptions() {
  const scope = useScope();
  return useQuery({ queryKey: queryKeys.list("inventory", "item-options", scope), queryFn: listItemOptions, staleTime: STALE });
}
export function useUserOptions() {
  const scope = useScope();
  return useQuery({ queryKey: queryKeys.list("inventory", "user-options", scope), queryFn: listUserOptions, staleTime: STALE });
}
export function useGodownOptions(projectId?: string) {
  const scope = useScope();
  return useQuery({
    queryKey: queryKeys.list("inventory", "godown-options", scope, { projectId: projectId ?? "" }),
    queryFn: () => listGodownOptions(projectId),
    staleTime: STALE,
  });
}
export function usePurposeOptions(projectId: string) {
  const scope = useScope();
  return useQuery({
    queryKey: queryKeys.list("inventory", "purpose-options", scope, { projectId }),
    queryFn: () => listPurposeOptions(projectId),
    enabled: !!projectId,
    staleTime: STALE,
  });
}

/** Inline-create a purpose under a project (FR-CC-003); refreshes that project's options. */
export function useCreatePurpose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, name }: { projectId: string; name: string }) => createPurpose(projectId, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory", "purpose-options"] }),
    retry: false,
  });
}

/** The `(godown, item)` on-hand balance behind the on-hand badge (spec §5). */
export function useOnHand(godownId: string, itemId: string) {
  const scope = useScope();
  return useQuery({
    queryKey: queryKeys.list("inventory", "on-hand", scope, { godownId, itemId }),
    queryFn: () => getStockBalance(godownId, itemId),
    enabled: !!godownId && !!itemId,
    staleTime: 30_000,
    retry: false,
  });
}
