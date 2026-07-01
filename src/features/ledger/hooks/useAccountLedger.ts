import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { listLedgerLines, type LedgerLinesFilter } from "../api/lines";

/**
 * Account-ledger / drill-down hook (skill §7). READ-ONLY — a query only. The key is
 * namespaced + tenant/FY-scoped so a company / FY switch doesn't bleed cache;
 * `keepPreviousData` keeps prior lines visible (dimmed) while a new filter/page
 * loads. `companyId` is implicit from the JWT. The server computes `openingBalance`
 * + `runningBalance` (account-ledger mode) — the FE only renders them.
 */
export function useAccountLedger(filter: LedgerLinesFilter, enabled = true) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("ledger", "lines", scope, filter as Record<string, unknown>),
    queryFn: () => listLedgerLines(filter),
    placeholderData: keepPreviousData,
    enabled,
    retry: false,
  });
}
