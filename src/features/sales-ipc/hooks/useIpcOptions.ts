import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import {
  createPurpose,
  listCostCentreOptions,
  listCustomerOptions,
  listFinancialYearOptions,
  listProjectOptions,
  listPurposeOptions,
} from "../api/masters";

/**
 * Picker-option hooks for the IPC editor + filter bar (skill §7). Masters change rarely → a
 * longer `staleTime`; tenant-scoped keys refetch on a company switch. Purposes are project-
 * scoped and support inline-create (reusing the MAS Purpose component's endpoint).
 */
const STALE = 5 * 60_000;

function useScope() {
  const user = useAuthenticatedUser();
  return { companyId: user.companyId, financialYearId: user.financialYearId };
}

export function useProjectOptions() {
  const scope = useScope();
  return useQuery({ queryKey: queryKeys.list("sales-ipc", "project-options", scope), queryFn: listProjectOptions, staleTime: STALE });
}
export function useCustomerOptions() {
  const scope = useScope();
  return useQuery({ queryKey: queryKeys.list("sales-ipc", "customer-options", scope), queryFn: listCustomerOptions, staleTime: STALE });
}
export function useCostCentreOptions() {
  const scope = useScope();
  return useQuery({ queryKey: queryKeys.list("sales-ipc", "cc-options", scope), queryFn: listCostCentreOptions, staleTime: STALE });
}
export function usePurposeOptions(projectId: string) {
  const scope = useScope();
  return useQuery({
    queryKey: queryKeys.list("sales-ipc", "purpose-options", scope, { projectId }),
    queryFn: () => listPurposeOptions(projectId),
    enabled: !!projectId,
    staleTime: STALE,
  });
}

/** FY options for the register's optional FY filter (fe-ipc-register-retention). */
export function useFinancialYearOptions() {
  const scope = useScope();
  return useQuery({
    queryKey: queryKeys.list("sales-ipc", "fy-options", scope),
    queryFn: listFinancialYearOptions,
    staleTime: STALE,
  });
}

/** Inline-create a purpose under a project (FR-SAL-002); refreshes that project's options. */
export function useCreatePurpose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, name }: { projectId: string; name: string }) => createPurpose(projectId, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales-ipc", "purpose-options"] }),
    retry: false,
  });
}
