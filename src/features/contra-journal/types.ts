/**
 * Contra & Journal (GEN) view-model types (API contract 14). Money is `Decimal(18,4)`
 * JSON strings — always transported as strings, never JS `number`. Dates are
 * `YYYY-MM-DD` (ISO for timestamps). Both contra + journal are voucher modules with
 * the standard `DRAFT | POSTED | CANCELLED` lifecycle; the opening journal rides
 * `/api/journal` with `voucherType = OPENING`. Shared with FE-49/FE-50/FE-51.
 */

export type VoucherStatus = "DRAFT" | "POSTED" | "CANCELLED";
export type ContraVoucherType = "CONTRA";
export type JournalVoucherType = "JOURNAL" | "OPENING";
export type VoucherType = ContraVoucherType | JournalVoucherType;

/** One line of a Contra voucher (own bank/cash accounts only; no dimensions/party). */
export interface ContraLine {
  lineNo: number;
  accountId: string;
  debit: string;
  credit: string;
  narration: string | null;
}

/** One line of a Journal voucher (any account; may carry party + four dimensions per
 * the line's account type — server enforces the exact matrix). */
export interface JournalLine {
  lineNo: number;
  accountId: string;
  debit: string;
  credit: string;
  partyId: string | null;
  projectId: string | null;
  costCentreId: string | null;
  purposeId: string | null;
  narration: string | null;
}

interface VoucherHeaderBase {
  id: string;
  voucherDate: string; // YYYY-MM-DD
  narration: string | null;
  status: VoucherStatus;
  entryNo: string | null;
  journalEntryId: string | null;
  postedAt: string | null;
  postedBy: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContraVoucher extends VoucherHeaderBase {
  voucherType: ContraVoucherType;
  lines: ContraLine[];
}

export interface JournalVoucher extends VoucherHeaderBase {
  voucherType: JournalVoucherType;
  lines: JournalLine[];
}

/** Header-only summary row for the list surface (contract 14 `GET /api/{contra,journal}` — lines omitted). */
export interface ContraVoucherSummary extends VoucherHeaderBase {
  voucherType: ContraVoucherType;
  /**
   * Σ debit across the (omitted) lines. Optional: the NestJS list endpoints return the
   * voucher header only and do not aggregate the lines, so this is absent on real rows —
   * display sites must tolerate it (see VoucherList's `money()`).
   */
  totalDebit?: string;
}
export interface JournalVoucherSummary extends VoucherHeaderBase {
  voucherType: JournalVoucherType;
  /** Optional for the same reason as ContraVoucherSummary.totalDebit. */
  totalDebit?: string;
}
export type AnyVoucherSummary = ContraVoucherSummary | JournalVoucherSummary;

export interface VoucherListPage {
  data: AnyVoucherSummary[];
  page: number;
  pageSize: number;
  total: number;
}
