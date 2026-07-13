import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { getStockJournal, listStockJournals, type StockJournalListFilter } from "../api/stock-journal";

/**
 * Stock Journal list + detail hooks (skill §7). Tenant-scoped keys; `keepPreviousData`
 * keeps the table visible (dimmed) while a filter/page reloads. `retry:false` on the
 * detail so a `403`/`404` surfaces at once (the read-only viewer handles it).
 */
export const STOCK_JOURNALS_KEY = ["inventory", "stock-journals"] as const;

export function useStockJournals(filter: StockJournalListFilter, enabled = true) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return useQuery({
    queryKey: queryKeys.list("inventory", "stock-journals", scope, filter as Record<string, unknown>),
    queryFn: () => listStockJournals(filter),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useStockJournal(id: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.detail("inventory", "stock-journal", id ?? ""),
    queryFn: () => getStockJournal(id as string),
    enabled: enabled && !!id,
    retry: false,
  });
}
