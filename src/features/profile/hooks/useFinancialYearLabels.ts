import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { listFinancialYearLabels } from "../api/financial-years";

/**
 * FE-52 — FY id→label lookup for the read-only detail grid. Cached tenant-wide
 * so the FY switcher and the profile screen share the same fetch.
 */
export function useFinancialYearLabels() {
  const user = useAuthenticatedUser();
  return useQuery({
    queryKey: queryKeys.list("master-data", "financial-year-labels", {
      companyId: user.companyId,
      financialYearId: user.financialYearId,
    }),
    queryFn: listFinancialYearLabels,
    staleTime: 5 * 60 * 1000,
  });
}
