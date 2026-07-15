import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { listFinancialYearOptions, listProjectOptions } from "../api/masters";

export function useFinancialYearOptions() {
  const user = useAuthenticatedUser();
  return useQuery({
    queryKey: queryKeys.list("dashboard", "fy-options", {
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
    queryKey: queryKeys.list("dashboard", "project-options", {
      companyId: user.companyId,
      financialYearId: user.financialYearId,
    }),
    queryFn: listProjectOptions,
    staleTime: 5 * 60_000,
  });
}
