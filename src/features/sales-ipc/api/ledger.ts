import { apiClient } from "@/lib/api";

/**
 * Thin LED binding for the IPC viewer's ledger-lines panel (spec §5; API contract 02 §
 * `GET /api/ledger/entries/{id}`). SAL owns this local wrapper rather than importing
 * `features/ledger` (skill §2.4 import boundary). READ-ONLY (LED writes are internal via
 * PostingService — the FE never sends debit/credit). The endpoint is guarded by
 * `ledger.journal_entries:READ` (distinct from `sales.ipcs:READ`, gap G3 in the brief) —
 * a PM may `403` on this call while succeeding on the IPC read; the hook renders that as
 * its own in-panel state instead of blanking the whole screen.
 */

export interface JournalEntryLine {
  id: string;
  lineNo: number;
  accountId: string;
  projectId: string | null;
  costCentreId: string | null;
  purposeId: string | null;
  godownId: string | null;
  partyId: string | null;
  debit: string; // Decimal(18,4) as string
  credit: string; // Decimal(18,4) as string
  narration: string | null;
}

export interface JournalEntry {
  id: string;
  entryNo: string;
  voucherType: string;
  voucherDate: string;
  postedAt: string;
  totalDebit: string;
  totalCredit: string;
  lines: JournalEntryLine[];
}

export async function getJournalEntry(id: string): Promise<JournalEntry> {
  return apiClient.get<JournalEntry>(`/ledger/entries/${id}`);
}
