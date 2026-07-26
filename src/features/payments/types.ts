/**
 * Payments (PAY) view-model types (API contract 13). Money is `Decimal(18,4)` JSON
 * strings — always transported as strings, never JS `number`. Dates are `YYYY-MM-DD`
 * (ISO for timestamps). A Payment is a **voucher module**: drafts over HTTP, posting
 * via LED internally (`PostingService`) — there is no `POST /api/ledger` and PAY never
 * writes the ledger directly. `entryNo` (the gapless `PAYMENT` number) is `null` while
 * `DRAFT` and set once `POSTED`; cancel/repost retain the original number.
 * `companyId` is implicit from the JWT; PM readers are project-scoped server-side.
 *
 * Shared with FE-46 (fe-payment-editor) and FE-47 (fe-payment-viewer) — the type set
 * and badges are authored here.
 */

/** Payment lifecycle — the standard three-state voucher matrix. */
export type PaymentStatus = "DRAFT" | "POSTED" | "CANCELLED";

/** All five modes rendered as equally normal (overview §9). */
export type PaymentMode = "CASH" | "MFS" | "BANK_TRANSFER" | "CHEQUE" | "RTGS";

/** What kind of payable an allocation targets (PUR bill · HR labour · HR salary). */
export type PayableType = "PURCHASE_BILL" | "LABOUR_PAYABLE" | "SALARY";

/** One allocation line on a payment (contract 13 § "Payment Voucher" resource shape). */
export interface PaymentAllocation {
  lineNo: number;
  payableType: PayableType;
  payableId: string;
  amountAllocated: string;
  /** LABOUR_PAYABLE only — the true-up basis. */
  accruedAmount: string | null;
  /** Party carried on the settlement control line (supplier; null for aggregate liabilities). */
  partyId: string | null;
  projectId: string | null;
  costCentreId: string | null;
  purposeId: string | null;
}

/** One entry in the cancel/repost chain (FR-PAY-019), derived read-only from the ledger. */
export interface PaymentLinkageEntry {
  entryId: string;
  entryNo: string;
  isReversal: boolean;
  isReversed: boolean;
  isCurrent: boolean;
  reversalOfEntryNo: string | null;
  reversedByEntryNo: string | null;
  postedAt: string;
}

export interface PaymentLinkage {
  hasHistory: boolean;
  currentEntryNo: string | null;
  originalEntryNo: string | null;
  entries: PaymentLinkageEntry[];
}

/** The full Payment Voucher resource (`GET /api/payment/{id}`). */
export interface Payment {
  id: string;
  partyId: string | null;
  paymentDate: string;
  paymentMode: PaymentMode;
  paymentAccountId: string;
  chequeTxnRef: string | null;
  bankChargesAmount: string;
  bankChargesProjectId: string | null;
  bankChargesCostCentreId: string | null;
  bankChargesPurposeId: string | null;
  paymentAmount: string;
  narration: string | null;
  status: PaymentStatus;
  entryNo: string | null;
  journalEntryId: string | null;
  allocatedAmount: string;
  unallocatedAmount: string;
  allocations: PaymentAllocation[];
  postedAt: string | null;
  postedBy: string | null;
  version: number;
  linkage: PaymentLinkage | null;
}

/** One list-row summary (contract 13 `GET /api/payment` response element). */
export interface PaymentSummary {
  id: string;
  entryNo: string | null;
  partyId: string | null;
  paymentDate: string;
  paymentMode: PaymentMode;
  paymentAccountId: string;
  chequeTxnRef: string | null;
  paymentAmount: string;
  allocatedAmount: string;
  unallocatedAmount: string;
  status: PaymentStatus;
}

export interface PaymentPage {
  data: PaymentSummary[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Open-payable row for the Outstanding view (contract 13 `GET /api/payment/open-payables`).
 * `remainingOutstanding = originalAmount − appliedAmount` — a live query over
 * `payment_allocation`, never a stored balance (FR-PAY-007, FR-PAY-017).
 */
export interface OpenPayable {
  payableType: PayableType;
  payableId: string;
  reference: string;
  partyId: string | null;
  originalAmount: string;
  appliedAmount: string;
  remainingOutstanding: string;
  accruedAmount: string | null;
  payableDate: string;
}

/** One posted, non-reversed payment applied to a payable (contract 13 `…/applied`). */
export interface PayableAppliedPayment {
  paymentId: string;
  entryNo: string;
  paymentDate: string;
  amountAllocated: string;
  status: PaymentStatus;
}

/** The per-payable settlement trail (contract 13 `…/payables/{type}/{id}/applied`). */
export interface PayableAppliedResult {
  payableType: PayableType;
  payableId: string;
  originalAmount: string;
  appliedAmount: string;
  remainingOutstanding: string;
  applications: PayableAppliedPayment[];
}

// ── Master picker options (thin PAY-local views over MAS lookups; skill §2.4 import
// boundary — PAY owns these rather than importing `features/master-data`). ──────────

export interface ProjectOption {
  id: string;
  name: string;
  projectCode?: string;
  status?: string; // OPEN | CLOSED
}

export interface PartyOption {
  id: string;
  name: string;
  isActive: boolean;
}

export interface AccountOption {
  id: string;
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
  isActive: boolean;
}

/** A DRAFT row (no legal number yet — FR-PAY-013) routes to the editor, not the viewer. */
export function isPaymentDraft(status: PaymentStatus): boolean {
  return status === "DRAFT";
}
