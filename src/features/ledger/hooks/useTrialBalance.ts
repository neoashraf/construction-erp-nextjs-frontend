import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { getTrialBalance, type TrialBalanceFilter } from "../api/trial-balance";

/**
 * Trial-balance hook (skill §7). READ-ONLY — a query only, fired on Apply (the
 * screen controls `enabled`/the applied filter; there is no auto-fetch on every
 * keystroke — heavy aggregation, spec §9). The key is namespaced + tenant/FY-scoped
 * so a company/FY switch doesn't bleed cache; `keepPreviousData` keeps the prior
 * table + totals visible (dimmed) while a new filter/page loads. `companyId` is
 * implicit from the JWT.
 */
export function useTrialBalance(filter: TrialBalanceFilter) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("ledger", "trial-balance", scope, filter as Record<string, unknown>),
    queryFn: () => getTrialBalance(filter),
    placeholderData: keepPreviousData,
    retry: false,
  });
}
