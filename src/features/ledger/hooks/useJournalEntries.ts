import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { listJournalEntries, type JournalEntriesFilter } from "../api/entries";

/**
 * Journal-entries list hook (skill §7). READ-ONLY — a query only, no mutations (the
 * ledger has no HTTP write). The key is namespaced + tenant/FY-scoped so a company /
 * FY switch doesn't bleed cache; `keepPreviousData` keeps prior rows visible (dimmed)
 * while a new filter/page loads. `companyId` is implicit from the JWT — never sent.
 */
export function useJournalEntries(filter: JournalEntriesFilter) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("ledger", "entries", scope, filter as Record<string, unknown>),
    queryFn: () => listJournalEntries(filter),
    placeholderData: keepPreviousData,
    retry: false,
  });
}
