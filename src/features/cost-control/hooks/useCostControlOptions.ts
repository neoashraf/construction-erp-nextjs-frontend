import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import {
  listCostCentreOptions,
  listFinancialYearOptions,
  listProjectOptions,
} from "../api/masters-options";

/**
 * Selector-option hooks for the filter bar (read-only MAS lookups). Longer `staleTime`
 * since masters change rarely; tenant-scoped keys so a company switch refetches. These
 * populate the project / cost-centre / financial-year dropdowns.
 */
const OPTIONS_STALE_MS = 5 * 60_000;

export function useProjectOptions() {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("cost-control", "project-options", scope),
    queryFn: listProjectOptions,
    staleTime: OPTIONS_STALE_MS,
  });
}

export function useCostCentreOptions() {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("cost-control", "cost-centre-options", scope),
    queryFn: listCostCentreOptions,
    staleTime: OPTIONS_STALE_MS,
  });
}

export function useFinancialYearOptions() {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("cost-control", "fy-options", scope),
    queryFn: listFinancialYearOptions,
    staleTime: OPTIONS_STALE_MS,
  });
}
