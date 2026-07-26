import Decimal from "decimal.js";
import { parseDate } from "@/lib/format";
import { toDecimal } from "@/lib/money";
import { type Payment, type PayableType, type PaymentMode } from "../types";
import { type PaymentAllocationInput, type PaymentWriteInput } from "../api/payment";

/**
 * Payment editor schema + form/validate/error helpers (spec §7/§8; FR-PAY-001…-020).
 * The editor captures the draft + drives the bill-wise allocation grid + previews the
 * live Σ / unallocated / total-cash-out — it never asserts Σdebit=Σcredit (LED owns
 * PostingService; the server is authoritative). Money is `Decimal(18,4)` throughout
 * (decimal.js, never JS float). Every module error code maps to its exact spec §8
 * copy via `mapPaymentError`.
 */

const DECIMAL = /^\d*\.?\d*$/;

function dec(v: string): Decimal {
  try {
    return toDecimal(v.trim() === "" ? "0" : v);
  } catch {
    return new Decimal(0);
  }
}

export function requiresChequeRef(mode: PaymentMode | ""): boolean {
  return mode !== "" && mode !== "CASH";
}

export interface AllocationRow {
  key: string;
  payableType: PayableType;
  payableId: string;
  reference: string; // display label from the picker
  originalAmount: string;
  remainingOutstanding: string;
  accruedAmount: string | null;
  amountAllocated: string;
}

export interface PaymentFormValues {
  partyId: string;
  paymentDate: string; // DD/MM/YYYY
  paymentMode: PaymentMode | "";
  paymentAccountId: string;
  chequeTxnRef: string;
  bankChargesAmount: string;
  bankChargesProjectId: string;
  bankChargesCostCentreId: string;
  bankChargesPurposeId: string;
  paymentAmount: string;
  narration: string;
  allocations: AllocationRow[];
}

export const emptyPaymentForm: PaymentFormValues = {
  partyId: "",
  paymentDate: "",
  paymentMode: "",
  paymentAccountId: "",
  chequeTxnRef: "",
  bankChargesAmount: "0.0000",
  bankChargesProjectId: "",
  bankChargesCostCentreId: "",
  bankChargesPurposeId: "",
  paymentAmount: "",
  narration: "",
  allocations: [],
};

export type FieldErrors = Partial<Record<keyof PaymentFormValues | "allocationsBanner", string>>;

// ── Live totals ─────────────────────────────────────────────────────────────────────

export function allocatedTotal(rows: AllocationRow[]): string {
  return rows
    .reduce((s, r) => s.plus(dec(r.amountAllocated)), new Decimal(0))
    .toFixed(4);
}

export function unallocatedRemainder(paymentAmount: string, rows: AllocationRow[]): string {
  const total = dec(paymentAmount);
  const sum = dec(allocatedTotal(rows));
  const remainder = total.minus(sum);
  return (remainder.isNegative() ? new Decimal(0) : remainder).toFixed(4);
}

export function isOverAllocated(paymentAmount: string, rows: AllocationRow[]): boolean {
  return dec(allocatedTotal(rows)).greaterThan(dec(paymentAmount));
}

export function isFullyAllocated(paymentAmount: string, rows: AllocationRow[]): boolean {
  if (rows.length === 0) return false;
  return dec(paymentAmount).greaterThan(0) && dec(allocatedTotal(rows)).equals(dec(paymentAmount));
}

/** True when a row's amount exceeds its remaining outstanding (spec §7). */
export function exceedsRowCap(row: AllocationRow): boolean {
  return dec(row.amountAllocated).greaterThan(dec(row.remainingOutstanding));
}

// ── Validation ─────────────────────────────────────────────────────────────────────

function uiDateToApi(value: string): string {
  const d = parseDate(value);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function apiDateToUi(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

export function validatePayment(
  form: PaymentFormValues,
): { values: PaymentFormValues; errors: null } | { values: null; errors: FieldErrors } {
  const errors: FieldErrors = {};

  if (!form.paymentDate.trim()) errors.paymentDate = "Enter a payment date.";
  else {
    try {
      parseDate(form.paymentDate);
    } catch {
      errors.paymentDate = "Enter a valid date (DD/MM/YYYY).";
    }
  }
  if (!form.paymentMode) errors.paymentMode = "Choose a payment mode.";
  if (!form.paymentAccountId) errors.paymentAccountId = "Choose the paying account.";
  if (requiresChequeRef(form.paymentMode) && !form.chequeTxnRef.trim()) {
    errors.chequeTxnRef = "Enter a reference for this payment mode.";
  }

  if (!form.paymentAmount.trim() || !DECIMAL.test(form.paymentAmount)) {
    errors.paymentAmount = "Enter a payment amount.";
  } else if (dec(form.paymentAmount).lessThanOrEqualTo(0)) {
    errors.paymentAmount = "Enter an amount greater than zero.";
  }

  if (form.bankChargesAmount.trim() && !DECIMAL.test(form.bankChargesAmount)) {
    errors.bankChargesAmount = "Enter a valid amount.";
  } else if (dec(form.bankChargesAmount).isNegative()) {
    errors.bankChargesAmount = "Bank charges can't be negative.";
  } else if (dec(form.bankChargesAmount).greaterThan(0)) {
    if (!form.bankChargesProjectId) errors.bankChargesProjectId = "Choose a project for the bank-charge line.";
    if (!form.bankChargesCostCentreId) errors.bankChargesCostCentreId = "Choose a cost centre.";
    if (!form.bankChargesPurposeId) errors.bankChargesPurposeId = "Choose a purpose.";
  }

  if (form.allocations.length === 0) {
    errors.allocationsBanner = "Add at least one payable to allocate.";
  } else {
    for (const row of form.allocations) {
      if (dec(row.amountAllocated).lessThanOrEqualTo(0)) {
        errors.allocationsBanner = "Every allocation must be greater than zero.";
        break;
      }
      if (exceedsRowCap(row)) {
        errors.allocationsBanner = `This allocation exceeds ${row.reference}'s remaining outstanding of ৳${row.remainingOutstanding}.`;
        break;
      }
    }
    if (!errors.allocationsBanner && isOverAllocated(form.paymentAmount, form.allocations)) {
      errors.allocationsBanner = "Total allocations exceed the payment amount.";
    }
  }

  if (form.allocations.length > 0 && !form.partyId) {
    // A pure salary/labour aggregate has no party; the server enforces it — most bills need one.
    if (form.allocations.some((a) => a.payableType === "PURCHASE_BILL")) {
      errors.partyId = "Choose a payee for the supplier bill.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { values: null, errors };
  }
  return { values: form, errors: null };
}

/** True when the form is Save-ready (draft-persist minimum). */
export function isSaveable(form: PaymentFormValues): boolean {
  return validatePayment(form).errors === null;
}

/** True when Post is gated open — validation clean + fully allocated (Phase-1). */
export function isPostable(form: PaymentFormValues): boolean {
  if (!isSaveable(form)) return false;
  return isFullyAllocated(form.paymentAmount, form.allocations);
}

// ── Payload building ───────────────────────────────────────────────────────────────

export function formToWriteInput(v: PaymentFormValues): PaymentWriteInput {
  const allocations: PaymentAllocationInput[] = v.allocations.map((a) => ({
    payableType: a.payableType,
    payableId: a.payableId,
    amountAllocated: dec(a.amountAllocated).toFixed(4),
  }));
  return {
    partyId: v.partyId,
    paymentDate: uiDateToApi(v.paymentDate),
    paymentMode: v.paymentMode as PaymentMode,
    paymentAccountId: v.paymentAccountId,
    chequeTxnRef: requiresChequeRef(v.paymentMode) ? v.chequeTxnRef.trim() || null : null,
    bankChargesAmount: dec(v.bankChargesAmount).toFixed(4),
    bankChargesProjectId: dec(v.bankChargesAmount).greaterThan(0) ? v.bankChargesProjectId || null : null,
    bankChargesCostCentreId: dec(v.bankChargesAmount).greaterThan(0) ? v.bankChargesCostCentreId || null : null,
    bankChargesPurposeId: dec(v.bankChargesAmount).greaterThan(0) ? v.bankChargesPurposeId || null : null,
    paymentAmount: dec(v.paymentAmount).toFixed(4),
    narration: v.narration.trim() || null,
    allocations,
  };
}

export function paymentToForm(p: Payment): PaymentFormValues {
  return {
    partyId: p.partyId ?? "",
    paymentDate: apiDateToUi(p.paymentDate),
    paymentMode: p.paymentMode,
    paymentAccountId: p.paymentAccountId,
    chequeTxnRef: p.chequeTxnRef ?? "",
    bankChargesAmount: dec(p.bankChargesAmount).toFixed(4),
    bankChargesProjectId: p.bankChargesProjectId ?? "",
    bankChargesCostCentreId: p.bankChargesCostCentreId ?? "",
    bankChargesPurposeId: p.bankChargesPurposeId ?? "",
    paymentAmount: dec(p.paymentAmount).toFixed(4),
    narration: p.narration ?? "",
    allocations: p.allocations.map((a, i) => ({
      key: `existing-${i}-${a.payableId}`,
      payableType: a.payableType,
      payableId: a.payableId,
      reference: a.payableId, // enriched by the editor via lookup when the picker resolves
      originalAmount: a.amountAllocated,
      remainingOutstanding: a.amountAllocated,
      accruedAmount: a.accruedAmount,
      amountAllocated: dec(a.amountAllocated).toFixed(4),
    })),
  };
}

// ── Error mapping (contract 13; spec §8) ───────────────────────────────────────────

export function mapPaymentError(code: string): { field?: keyof FieldErrors; message: string } {
  switch (code) {
    case "VALIDATION_ERROR":
      return { message: "Couldn't save this payment. Please check the highlighted fields." };
    case "CHEQUE_REF_REQUIRED":
      return { field: "chequeTxnRef", message: "Enter a reference for this payment mode." };
    case "OVER_ALLOCATION":
      return { field: "allocationsBanner", message: "Total allocations exceed the payment amount." };
    case "ALLOCATION_EXCEEDS_OUTSTANDING":
      return { field: "allocationsBanner", message: "An allocation exceeds the payable's remaining outstanding. Refresh and adjust." };
    case "PAYABLE_NOT_SETTLEABLE":
      return { field: "allocationsBanner", message: "This payable can't be settled. It may be fully settled or belong to another company." };
    case "CROSS_PROJECT_DIMENSION":
      return { field: "bankChargesPurposeId", message: "The bank-charge purpose must belong to the chosen project." };
    case "MISSING_REQUIRED_DIMENSION":
      return { message: "A required posting dimension (project, cost centre or purpose) is missing." };
    case "MISSING_PARTY_ON_CONTROL_LINE":
      return { message: "The payee couldn't be resolved for the settlement control line." };
    case "UNBALANCED_ENTRY":
      return { message: "Couldn't post this payment. Please contact support." };
    case "VOUCHER_POSTED_IMMUTABLE":
      return { message: "This payment has been posted and can no longer be edited." };
    case "VOUCHER_NOT_POSTED":
      return { message: "This payment isn't posted, so it can't be cancelled or reposted." };
    case "ALREADY_REVERSED":
      return { message: "This payment has already been cancelled." };
    case "OPTIMISTIC_LOCK_CONFLICT":
      return { message: "This payment was just changed by someone else. Reload and try again." };
    case "PERIOD_CLOSED":
      return { message: "This period is closed. Choose a date in an open period or contact Admin." };
    case "NO_PERIOD_DEFINED":
      return { message: "No accounting period is defined for this date. Define one before posting." };
    case "PROJECT_CLOSED":
      return { message: "This project is closed and can't accept new postings." };
    case "FORBIDDEN":
      return { message: "You don't have permission to perform this action." };
    case "NOT_FOUND":
      return { message: "This payment could not be found." };
    default:
      return { message: "Something went wrong. Please try again." };
  }
}
