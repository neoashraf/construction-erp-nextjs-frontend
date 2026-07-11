import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { getOverBudgetAlerts, type OverBudgetAlertsQuery } from "../api/alerts";

/**
 * Over-budget alerts hook (skill §7). READ-ONLY, LIVE — pull-based (no auto-poll /
 * websocket in Phase 1, spec §9); the screen re-reads on mount and on manual Refresh.
 * Key is namespaced + tenant-scoped so a company switch doesn't bleed cache;
 * `keepPreviousData` keeps the prior list visible (dimmed) while a chip/project filter
 * reloads. `retry:false` — a `403` (PM cross-scope project filter) must surface at once.
 */
export function useOverBudgetAlerts(query: OverBudgetAlertsQuery, enabled: boolean) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("cost-control", "alerts", scope, query as Record<string, unknown>),
    queryFn: () => getOverBudgetAlerts(query),
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
  });
}
