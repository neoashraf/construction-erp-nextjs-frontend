/**
 * Receipts (REC) view-model types (API contract 11). Money is `Decimal(18,4)` JSON
 * strings — always transported as strings, never JS `number`. Dates are `YYYY-MM-DD`
 * (ISO for timestamps). A Receipt is a **voucher module**: drafts over HTTP, posting
 * via LED internally (`PostingService`) — there is no `POST /api/ledger` and REC never
 * writes the ledger directly. `entryNo` (the gapless `RECEIPT` number) is `null` while
 * `DRAFT` and set once `POSTED`; cancel/repost retain the original number.
 * `companyId` is implicit from the JWT; PM readers are scoped to assigned projects
 * server-side (general no-project receipts excluded for PM).
 */

/** Receipt lifecycle — the standard three-state voucher matrix. */
export type ReceiptStatus = "DRAFT" | "POSTED" | "CANCELLED";

/** IPC-linked (a certified payment certificate collection) vs a general/non-project receipt. */
export type ReceiptType = "IPC_LINKED" | "GENERAL";

/** All four rendered as equally normal (overview §9) — cash/MFS are not edge cases. */
export type PaymentMode = "CASH" | "MFS" | "BANK_TRANSFER" | "CHEQUE";

/** One list-row summary (contract 11 `GET /api/receipt` response element). */
export interface ReceiptSummary {
  id: string;
  entryNo: string | null;
  receiptType: ReceiptType;
  receiptDate: string;
  paymentMode: PaymentMode;
  partyId: string;
  projectId: string | null;
  ipcId: string | null;
  amountSettled: string;
  taxDeductedAtSource: string;
  status: ReceiptStatus;
}

export interface ReceiptPage {
  data: ReceiptSummary[];
  page: number;
  pageSize: number;
  total: number;
}

/** One row of the "receipts applied to this IPC" read (contract 11 `GET /api/receipt/ipc/{ipcId}`). */
export interface ReceiptAppliedRow {
  receiptId: string;
  entryNo: string;
  receiptDate: string;
  paymentMode: PaymentMode;
  amountApplied: string;
  status: ReceiptStatus;
}

/** The collection-against-certificate view (FR-REC-016, FR-REC-018). */
export interface ReceiptsForIpc {
  rows: ReceiptAppliedRow[];
  ipcCurrentlyDue: string;
  totalApplied: string;
  balanceDue: string;
}

// ── Master picker options (thin REC-local views over MAS lookups; skill §2.4 import
// boundary — REC owns these rather than importing `features/master-data`). ──────────

export interface ProjectOption {
  id: string;
  name: string;
  projectCode?: string;
  status?: string; // OPEN | CLOSED
}

export interface CustomerOption {
  id: string;
  name: string;
  isActive: boolean;
}
