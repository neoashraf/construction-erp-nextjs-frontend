import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { getPayment, getPaymentJournalEntry } from "../api/payment";

/**
 * Viewer-side reads for one POSTED/CANCELLED payment (spec §4/§6; FR-PAY-013/-018;
 * Backend-support note). Two independent queries so the two panels degrade separately:
 *  - the **payment** query drives the header + allocations + linkage (`payments.list:READ`);
 *  - the **journal entry** query drives the ledger-lines table
 *    (`ledger.journal_entries:READ`; an Accounts user without the LED grant `403`s on
 *    lines while succeeding on the payment read).
 * `retry:false` on both. The lines query is `enabled` only after the payment read
 * supplies a `journalEntryId` (null on a DRAFT id — the viewer route redirects to the
 * editor before the hook runs, but the guard is cheap).
 */
export function usePaymentViewer(id: string | null) {
  const user = useAuthenticatedUser();
  const scope = `${user.companyId}:${user.financialYearId}:${id ?? ""}`;

  const payment = useQuery({
    queryKey: queryKeys.detail("payments", "viewer", scope),
    queryFn: () => getPayment(id as string),
    enabled: !!id,
    retry: false,
  });

  const journalEntryId = payment.data?.journalEntryId ?? null;
  const entry = useQuery({
    queryKey: queryKeys.detail("payments", "viewer-lines", `${scope}:${journalEntryId ?? ""}`),
    queryFn: () => getPaymentJournalEntry(journalEntryId as string),
    enabled: !!journalEntryId,
    retry: false,
  });

  return { payment, entry };
}
