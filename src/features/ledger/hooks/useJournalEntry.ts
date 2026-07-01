import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { getJournalEntry } from "../api/entries";

/**
 * Single journal-entry detail hook (Entry viewer; skill §7). READ-ONLY — a query
 * only, no mutations (the ledger has no HTTP write; corrections are reverse/repost on
 * the source voucher). The key is namespaced + tenant/FY-scoped so a company/FY switch
 * doesn't bleed cache. No retry: a 404 (cross-company / missing) or 403 (PM out of
 * project scope) should render immediately, not retry silently.
 */
export function useJournalEntry(id: string | null) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: [...queryKeys.detail("ledger", "entries", id ?? ""), scope],
    queryFn: () => getJournalEntry(id as string),
    enabled: id !== null,
    retry: false,
  });
}
