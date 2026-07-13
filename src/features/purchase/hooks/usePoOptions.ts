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
  listSupplierOptions,
} from "../api/masters";

/**
 * Picker-option hooks for the PO entry form + filter bar (nextjs-author skill §7). Masters
 * change rarely → a longer `staleTime`; tenant-scoped keys refetch on a company switch.
 * Purposes/godowns are project-scoped and only fire once a project is selected. The
 * inline-create purpose mutation invalidates the project-scoped purpose cache on success.
 */
const STALE = 5 * 60_000;

function useScope() {
  const user = useAuthenticatedUser();
  return { companyId: user.companyId, financialYearId: user.financialYearId };
}

export function useProjectOptions() {
  const scope = useScope();
  return useQuery({
    queryKey: queryKeys.list("purchase", "project-options", scope),
    queryFn: listProjectOptions,
    staleTime: STALE,
  });
}

export function useSupplierOptions() {
  const scope = useScope();
  return useQuery({
    queryKey: queryKeys.list("purchase", "supplier-options", scope),
    queryFn: listSupplierOptions,
    staleTime: STALE,
  });
}

export function useCostCentreOptions() {
  const scope = useScope();
  return useQuery({
    queryKey: queryKeys.list("purchase", "cc-options", scope),
    queryFn: listCostCentreOptions,
    staleTime: STALE,
  });
}

export function useItemOptions() {
  const scope = useScope();
  return useQuery({
    queryKey: queryKeys.list("purchase", "item-options", scope),
    queryFn: listItemOptions,
    staleTime: STALE,
  });
}

export function usePurposeOptions(projectId: string) {
  const scope = useScope();
  return useQuery({
    queryKey: queryKeys.list("purchase", "purpose-options", scope, { projectId }),
    queryFn: () => listPurposeOptions(projectId),
    enabled: !!projectId,
    staleTime: STALE,
  });
}

export function useGodownOptions(projectId?: string) {
  const scope = useScope();
  return useQuery({
    queryKey: queryKeys.list("purchase", "godown-options", scope, { projectId: projectId ?? "" }),
    queryFn: () => listGodownOptions(projectId),
    staleTime: STALE,
  });
}

export function useCreatePurpose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, name }: { projectId: string; name: string }) => createPurpose(projectId, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase", "purpose-options"] }),
    retry: false,
  });
}
