import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { listSalarySheets, type SalarySheetListFilter } from "../api/salary";

/**
 * Salary-sheet list hook (spec §4/§6; FR-HR-013). Tenant + FY-scoped keys; `keepPreviousData`
 * keeps the table visible dimmed while a filter/page reloads. Company-global (a sheet spans
 * projects via its lines) — no project-scope filter here.
 */
export function useSalarySheets(filter: SalarySheetListFilter, enabled = true) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("hr", "salary-sheets", scope, filter as unknown as Record<string, unknown>),
    queryFn: () => listSalarySheets(filter),
    placeholderData: keepPreviousData,
    enabled,
  });
}
