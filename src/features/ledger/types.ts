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

/**
 * A denormalised journal LINE — API contract 02 § `GET /api/ledger/lines` item (the
 * account-ledger + dimension drill-down substrate). Each line carries its parent
 * entry's identifying fields plus the four dimensions + party (FR-LED-006/012/030).
 * `runningBalance` is present ONLY in account-ledger mode (`accountId` + date range),
 * computed cumulatively server-side, debit-positive (FR-LED-007). Money is
 * `Decimal(18,4)` as a string (formatted via lib/money, never float).
 */
export interface LedgerLine {
  lineId: string;
  lineNo: number;
  entryId: string;
  entryNo: string;
  voucherType: VoucherType | string;
  voucherDate: string; // YYYY-MM-DD
  sourceType: string | null;
  sourceId: string | null;
  isReversal: boolean;
  accountId: string;
  projectId: string | null;
  costCentreId: string | null;
  purposeId: string | null;
  godownId: string | null;
  partyId: string | null;
  debit: string; // Decimal(18,4) as string (exactly one of debit/credit non-zero)
  credit: string; // Decimal(18,4) as string
  runningBalance?: string | null; // Decimal(18,4); only in account-ledger mode
  narration: string | null;
}

/**
 * The account-ledger / drill-down response (API contract 02 § lines). `openingBalance`
 * is present ONLY in account-ledger mode — the carry immediately before `dateFrom`,
 * rendered as the synthesised "Opening balance" first row that seeds the running
 * balance. In drill-down mode (no `accountId`) both `openingBalance` and each row's
 * `runningBalance` are omitted (spec §13).
 */
export interface LedgerLinesPage {
  data: LedgerLine[];
  openingBalance?: string | null;
  page: number;
  pageSize: number;
  total: number;
}

/**
 * A single balanced LINE within one journal-entry detail (Entry viewer) — API
 * contract 02 § `GET /api/ledger/entries/{id}` `lines[]` item (FR-LED-006). Unlike
 * `LedgerLine` (the flat `/ledger/lines` read), this line does NOT repeat its parent
 * entry's identifying fields — it belongs to one `JournalEntryDetail`. Money is
 * `Decimal(18,4)` as a string (formatted via lib/money, never float); exactly one of
 * debit/credit is non-zero per line (FR-LED-007).
 */
export interface JournalEntryDetailLine {
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

/**
 * The derived reversed-by linkage, expanded with the reversing entry's number
 * (API contract 02 § `GET /api/ledger/entries/{id}` `reversedBy`; FR-LED-026).
 * `null` when no reversal references this entry.
 */
export interface ReversedByLink {
  entryId: string;
  entryNo: string;
}

/**
 * One posted journal entry with its full set of balanced lines (Entry viewer;
 * API contract 02 § `GET /api/ledger/entries/{id}`). READ-ONLY (FR-LED-024) — this
 * is the detail counterpart of `JournalEntryHeader` (the list-row shape); it adds
 * `lines[]` and the expanded `reversedBy` linkage. `isReversed` / `reversedByEntryId`
 * / `reversedBy` are derived, append-only fields computed at read time from the
 * existence of a reversal entry — the original row is never mutated (FR-LED-026).
 */
export interface JournalEntryDetail {
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
  reversedBy: ReversedByLink | null;
  narration: string | null;
  postedAt: string; // ISO-8601 UTC
  postedBy: string | null; // User id (AUD); name resolution is out of this endpoint
  totalDebit: string; // Decimal(18,4) as string
  totalCredit: string; // Decimal(18,4) as string
  lines: JournalEntryDetailLine[];
}

/**
 * One aggregated row of the trial balance (API contract 02 §
 * `GET /api/ledger/trial-balance` `data[]` item; FR-LED-031/001). Grouping columns
 * not requested via `groupBy` come back `null` (spec §5). `net` is server-computed
 * (`debit − credit`, debit-positive) — the FE never recomputes it. Money is
 * `Decimal(18,4)` as a string (formatted via lib/money, never float).
 */
export interface TrialBalanceRow {
  accountId: string;
  projectId: string | null;
  costCentreId: string | null;
  purposeId: string | null;
  godownId: string | null;
  partyId: string | null;
  debit: string; // Decimal(18,4) as string
  credit: string; // Decimal(18,4) as string
  net: string; // Decimal(18,4) as string (debit - credit, debit-positive)
}

/**
 * The balance-proof totals (API contract 02 § trial-balance `totals`; FR-LED-014).
 * `debit` always equals `credit` for a posted, balanced ledger — the balance-proof
 * chip and sticky totals footer assert this rather than recomputing it.
 */
export interface TrialBalanceTotals {
  debit: string; // Decimal(18,4) as string
  credit: string; // Decimal(18,4) as string
}

/**
 * The trial-balance response page (API contract 02 § trial-balance). Grouped rows
 * paginate like any other list (`page`/`pageSize`/`total`, default `pageSize` 25).
 */
export interface TrialBalancePage {
  data: TrialBalanceRow[];
  totals: TrialBalanceTotals;
  page: number;
  pageSize: number;
  total: number;
}
