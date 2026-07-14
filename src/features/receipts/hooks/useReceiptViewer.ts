import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { getReceipt, getReceiptJournalEntry } from "../api/receipt";

/**
 * Viewer-side reads for one POSTED/CANCELLED receipt (spec §4/§6; FR-REC-013/-024;
 * brief G1/G2). Two independent queries so the two panels degrade separately:
 *  - the **receipt** query drives the header + IPC/balance panel + linkage (from the
 *    server's `linkage` field, see brief G1) — `receipts:READ`.
 *  - the **journal entry** query drives the ledger-lines table
 *    (`ledger.journal_entries:READ` — brief G2 — a PM may hold `receipts:READ` yet
 *    `403` on the lines call; that renders as its own in-panel state, not a full-screen
 *    error).
 * `retry:false` on both so a `403`/`404` renders at once. The lines query is `enabled`
 * only after the receipt read supplies a `journalEntryId` (null on a DRAFT id — the
 * parent screen redirects to the editor before this hook runs, but the guard is cheap).
 */
export function useReceiptViewer(id: string | null) {
  const user = useAuthenticatedUser();
  const scope = `${user.companyId}:${user.financialYearId}:${id ?? ""}`;

  const receipt = useQuery({
    queryKey: queryKeys.detail("receipts", "viewer", scope),
    queryFn: () => getReceipt(id as string),
    enabled: !!id,
    retry: false,
  });

  const journalEntryId = receipt.data?.journalEntryId ?? null;
  const entry = useQuery({
    queryKey: queryKeys.detail("receipts", "viewer-lines", `${scope}:${journalEntryId ?? ""}`),
    queryFn: () => getReceiptJournalEntry(journalEntryId as string),
    enabled: !!journalEntryId,
    retry: false,
  });

  return { receipt, entry };
}
