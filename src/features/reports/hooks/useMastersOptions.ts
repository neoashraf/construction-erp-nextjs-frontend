import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import {
  listCostCentreOptions,
  listEmployeeOptions,
  listFinancialYearOptions,
  listProjectOptions,
  listSalaryRunOptions,
} from "../api/masters";

/**
 * FE-54 lookup hooks for the shared parameter panel. Cached tenant-wide so
 * every viewer + the hub share the same fetches.
 */
export function useFinancialYearOptions() {
  const user = useAuthenticatedUser();
  return useQuery({
    queryKey: queryKeys.list("reports", "fy-options", {
      companyId: user.companyId,
      financialYearId: user.financialYearId,
    }),
    queryFn: listFinancialYearOptions,
    staleTime: 5 * 60_000,
  });
}
export function useProjectOptions() {
  const user = useAuthenticatedUser();
  return useQuery({
    queryKey: queryKeys.list("reports", "project-options", {
      companyId: user.companyId,
      financialYearId: user.financialYearId,
    }),
    queryFn: listProjectOptions,
    staleTime: 5 * 60_000,
  });
}
export function useCostCentreOptions() {
  const user = useAuthenticatedUser();
  return useQuery({
    queryKey: queryKeys.list("reports", "cc-options", {
      companyId: user.companyId,
      financialYearId: user.financialYearId,
    }),
    queryFn: listCostCentreOptions,
    staleTime: 5 * 60_000,
  });
}
export function useEmployeeOptions() {
  const user = useAuthenticatedUser();
  return useQuery({
    queryKey: queryKeys.list("reports", "employee-options", {
      companyId: user.companyId,
      financialYearId: user.financialYearId,
    }),
    queryFn: listEmployeeOptions,
    staleTime: 5 * 60_000,
  });
}
export function useSalaryRunOptions() {
  const user = useAuthenticatedUser();
  return useQuery({
    queryKey: queryKeys.list("reports", "salary-run-options", {
      companyId: user.companyId,
      financialYearId: user.financialYearId,
    }),
    queryFn: () => listSalaryRunOptions(user.financialYearId ?? undefined),
    staleTime: 5 * 60_000,
  });
}
