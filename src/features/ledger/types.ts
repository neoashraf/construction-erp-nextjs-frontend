/**
 * View-model types for the Ledger (LED) feature (skill §2.1). UI-facing types — NOT
 * the generated wire types in lib/api/generated. They mirror the fields in API
 * contract 02 (`GET /api/ledger/entries`, camelCase JSON). The ledger is READ-ONLY
 * over HTTP — there is no create/edit/delete type here (posting is internal, LED).
 */

/**
 * The LED-owned `VoucherType` enum (API contract 02 § entries; overview §10). Used
 * for the voucher-type filter + the per-row enum badge.
 */
export const VOUCHER_TYPES = [
  "SALES_IPC",
  "PURCHASE",
  "PAYMENT",
  "RECEIPT",
  "CONTRA",
  "JOURNAL",
  "STOCK_JOURNAL",
  "SALARY",
  "DAILY_LABOUR_ACCRUAL",
  "OPENING",
] as const;

export type VoucherType = (typeof VOUCHER_TYPES)[number];

/** Human labels for the voucher-type badge / filter (en). Bangla wraps, never clips. */
export const VOUCHER_TYPE_LABEL: Record<VoucherType, string> = {
  SALES_IPC: "Sales / IPC",
  PURCHASE: "Purchase",
  PAYMENT: "Payment",
  RECEIPT: "Receipt",
  CONTRA: "Contra",
  JOURNAL: "Journal",
  STOCK_JOURNAL: "Stock journal",
  SALARY: "Salary",
  DAILY_LABOUR_ACCRUAL: "Daily labour accrual",
  OPENING: "Opening",
};

/** Fall back to the raw enum value for an unknown voucher type (forward-compat). */
export function voucherTypeLabel(type: string): string {
  return VOUCHER_TYPE_LABEL[type as VoucherType] ?? type;
}

/**
 * A posted journal-entry HEADER (no lines) — API contract 02 §
 * `GET /api/ledger/entries` item. Money is `Decimal(18,4)` transported as a JSON
 * string (formatted via lib/money, never JS float). `isReversed` /
 * `reversedByEntryId` are DERIVED read-only fields (append-only; a reversal entry
 * references this one) — FR-LED-026.
 */
export interface JournalEntryHeader {
  id: string;
  entryNo: string;
  financialYearId: string;
  voucherType: VoucherType | string;
  voucherDate: string; // YYYY-MM-DD
  sourceType: string | null;
  sourceId: string | null;
  isReversal: boolean;
  reversalOf: string | null;
  isReversed: boolean;
  reversedByEntryId: string | null;
  narration: string | null;
  totalDebit: string; // Decimal(18,4) as string
  totalCredit: string; // Decimal(18,4) as string
  postedAt: string; // ISO-8601 UTC
  postedBy: string | null; // User id (AUD); name resolution is out of this endpoint
}

/**
 * The derived status of an entry row (spec §5/§13, FR-LED-026):
 * - `reversal` — this entry is itself a reversal (`isReversal`);
 * - `reversed` — an original that a later reversal references (`isReversed`);
 * - `normal` — neither.
 * `reversal` takes precedence when both could apply.
 */
export type EntryStatus = "normal" | "reversal" | "reversed";

export function entryStatus(e: Pick<JournalEntryHeader, "isReversal" | "isReversed">): EntryStatus {
  if (e.isReversal) return "reversal";
  if (e.isReversed) return "reversed";
  return "normal";
}

/** Tri-state reversal filter (design toggle) → API `isReversal` (undefined = all). */
export type ReversalFilter = "all" | "normal" | "reversal";
