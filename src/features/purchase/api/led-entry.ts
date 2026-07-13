import { apiClient } from "@/lib/api";
import type { JournalEntryDetail } from "@/features/ledger/types";

/**
 * PUR-local binding for the LED "get one entry" read used by the bill viewer's
 * balanced ledger-lines table (API contract 02 § `GET /api/ledger/entries/{id}`).
 * Keeps the import boundary clean — features/purchase never reaches into
 * features/ledger's `api` module (nextjs-author skill §2.4). The LED wire type is
 * imported from `@/features/ledger/types` — type imports are erased at compile
 * time and don't count as a feature cross-import at runtime.
 */
export async function getBillLedgerEntry(id: string): Promise<JournalEntryDetail> {
  return apiClient.get<JournalEntryDetail>(`/ledger/entries/${id}`);
}
