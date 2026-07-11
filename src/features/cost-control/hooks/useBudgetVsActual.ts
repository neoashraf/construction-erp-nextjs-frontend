import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { getBudgetVsActual, type BudgetVsActualQuery } from "../api/budget-vs-actual";

/**
 * Budget-vs-actual hook (skill §7). READ-ONLY — fired on Apply only (the screen owns
 * `enabled`, gated on a chosen project/cost-centre; no auto-fetch). Key is namespaced +
 * tenant/FY-scoped so a company/FY switch doesn't bleed cache; `keepPreviousData` keeps
 * the prior table visible (dimmed) while a new filter/page loads. `retry:false` — a
 * `403` (PM unassigned project) must surface immediately, not be retried.
 */
export function useBudgetVsActual(query: BudgetVsActualQuery, enabled: boolean) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("cost-control", "budget-vs-actual", scope, query as Record<string, unknown>),
    queryFn: () => getBudgetVsActual(query),
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
  });
}
