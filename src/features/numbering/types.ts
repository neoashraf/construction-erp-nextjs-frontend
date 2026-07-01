/**
 * View-model types for the Voucher Numbering (NUM) feature (skill §2.1). UI-facing
 * types — NOT the generated wire types in lib/api/generated. They mirror the fields
 * in API contract 03 (`/api/masters/numbering-series*`, camelCase JSON).
 */

/**
 * The LED-owned `VoucherType` enum (overview §10; API contract 03 § list). One
 * numbering series exists per (company, financial year, voucher type) triple.
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

/** Human labels for each voucher type (design file §5; en). Bangla labels wrap, never clip. */
export const VOUCHER_TYPE_LABEL: Record<VoucherType, string> = {
  SALES_IPC: "Sales / IPC bill",
  PURCHASE: "Purchase",
  PAYMENT: "Payment",
  RECEIPT: "Receipt",
  CONTRA: "Contra",
  JOURNAL: "Journal",
  STOCK_JOURNAL: "Stock journal",
  SALARY: "Salary",
  DAILY_LABOUR_ACCRUAL: "Daily labour accrual",
  OPENING: "Opening balance",
};

/** Fall back to the raw enum value for an unknown voucher type (forward-compat). */
export function voucherTypeLabel(type: string): string {
  return VOUCHER_TYPE_LABEL[type as VoucherType] ?? type;
}

/**
 * A numbering series (API contract 03 § `GET /api/masters/numbering-series` item).
 * `lastSequence` is READ-ONLY everywhere — it advances only via the in-transaction
 * allocator, never through the API (FR-NUM-018). `nextNumberPreview` is composed
 * server-side (`<prefix>/<FY label>/<padded lastSequence+1>`) and is informational,
 * non-consuming (FR-NUM-013).
 */
export interface NumberingSeries {
  id: string;
  companyId: string;
  financialYearId: string;
  voucherType: VoucherType | string;
  prefix: string;
  paddingWidth: number;
  lastSequence: number;
  nextNumberPreview: string;
}

/** The non-consuming next-number preview (API `GET …/{id}/next-preview`). */
export interface NextNumberPreview {
  seriesId: string;
  lastSequence: number;
  nextSequence: number;
  nextNumberPreview: string;
}

/**
 * The gap-audit continuity report (API `GET …/{id}/gap-audit`, FR-NUM-021).
 * `expectedCount = highestSequence − lowestSequence + 1`; `continuous` /
 * `integrityAlert` flag whether `committedCount` equals `expectedCount`.
 */
export interface GapAudit {
  seriesId: string;
  voucherType: VoucherType | string;
  lowestSequence: number;
  highestSequence: number;
  committedCount: number;
  expectedCount: number;
  continuous: boolean;
  integrityAlert: boolean;
}

/** Editable fields (API `PATCH …/{id}`) — only prefix + paddingWidth (FR-NUM-002). */
export interface SeriesEditInput {
  prefix: string;
  paddingWidth: number;
}
