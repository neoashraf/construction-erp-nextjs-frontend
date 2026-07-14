/**
 * FE-56 viewer-owned row + totals types for the four dense-register reports
 * (contract 15 §Financial statements & registers). Money fields are
 * `Decimal(18,4)` **strings** — never client-recomputed.
 */

export type ReportTab = "TB" | "LEDGER" | "DAYBOOK" | "CASH_BANK";

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string | null;
  isActive?: boolean;
  /** Grouping-dimension label rendered under the account when groupBy adds a dimension. */
  groupDimensionLabel?: string | null;
  debit: string;
  credit: string;
  net: string; // debit - credit, positive when debit-heavy
}

export interface TrialBalanceTotals {
  debit: string;
  credit: string;
}

export interface LedgerRow {
  entryId: string; // for the source-voucher link
  journalEntryId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  entryNo: string;
  voucherDate: string; // ISO YYYY-MM-DD
  voucherType: string; // human label (e.g. "Contra", "Journal", "Receipt")
  accountId: string;
  accountCode: string;
  accountName: string | null;
  partyId?: string | null;
  partyName?: string | null;
  narration?: string | null;
  isReversal?: boolean;
  isInactive?: boolean;
  debit: string;
  credit: string;
  /** Server-computed running balance — carries across pages; UI never recomputes. */
  runningBalance: string;
}

export interface LedgerMeta {
  openingBalance: string;
  openingAsOf: string; // ISO YYYY-MM-DD
  dateFrom: string;
  dateTo: string;
}
