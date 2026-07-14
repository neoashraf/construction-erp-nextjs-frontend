import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { getIpc } from "../api/ipc";
import { getJournalEntry } from "../api/ledger";

/**
 * Viewer-side reads for one posted/cancelled IPC (spec §4/§6; FR-SAL-010/-021/-022; brief
 * G1/G3). Two independent queries so the two panels degrade separately:
 *  - the **IPC** query drives the header + key figures + linkage (`sales.ipcs:READ`);
 *  - the **journal entry** query drives the ledger-lines table
 *    (`ledger.journal_entries:READ` — brief G3 — a PM may hold the IPC grant but 403 on
 *    the lines call, which surfaces as its own in-panel state, not a full-screen error).
 * `retry:false` on both so a `403`/`404` renders at once. The lines query is `enabled`
 * only after the IPC read supplies a `journalEntryId` (null on a DRAFT id — the parent
 * screen redirects to the editor before this hook runs, but the guard is cheap).
 */
export function useIpcViewer(id: string | null) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };

  const ipc = useQuery({
    queryKey: queryKeys.detail("sales-ipc", "ipc", id ?? ""),
    queryFn: () => getIpc(id as string),
    enabled: !!id,
    retry: false,
  });

  const journalEntryId = ipc.data?.journalEntryId ?? null;
  const entry = useQuery({
    queryKey: [...queryKeys.detail("sales-ipc", "ipc-lines", journalEntryId ?? ""), scope],
    queryFn: () => getJournalEntry(journalEntryId as string),
    enabled: !!journalEntryId,
    retry: false,
  });

  return { ipc, entry };
}
