import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { getBillLedgerEntry } from "../api/led-entry";

/**
 * LED entry read for the bill viewer's balanced ledger-lines table (brief §Scope 9).
 * READ-ONLY — the viewer displays what the backend wrote (never re-derives / never
 * asserts Σdr=Σcr). Disabled while the bill is DRAFT (`null` journalEntryId). A `403`
 * on this call is common for PM (grant `ledger.journal_entries:READ` distinct from
 * `purchase.bills:READ`) — surfaced as the panel's own permission-denied state.
 */
export function useBillLedgerEntry(journalEntryId: string | null) {
  return useQuery({
    queryKey: queryKeys.detail("ledger", "entry-for-bill", journalEntryId ?? ""),
    queryFn: () => getBillLedgerEntry(journalEntryId as string),
    enabled: !!journalEntryId,
    retry: false,
  });
}
