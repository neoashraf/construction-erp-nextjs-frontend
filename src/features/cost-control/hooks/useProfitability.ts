import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { getProfitability, type ProfitabilityQuery } from "../api/profitability";

/**
 * Profitability hook (skill §7). READ-ONLY. Unlike budget-vs-actual there is no required
 * context — the screen loads at the default grouping on mount (`enabled` only gates
 * offline). Key is namespaced + tenant-scoped so a company/FY switch doesn't bleed cache;
 * `keepPreviousData` keeps the prior table visible (dimmed) while a mode/filter reloads.
 * `retry:false` — a `403` (out-of-scope filter) must surface immediately.
 */
export function useProfitability(query: ProfitabilityQuery, enabled: boolean) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("cost-control", "profitability", scope, query as Record<string, unknown>),
    queryFn: () => getProfitability(query),
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
  });
}
