import Decimal from "decimal.js";
import { parseDate } from "@/lib/format";
import { toDecimal } from "@/lib/money";
import { type PaymentMode, type Receipt, type ReceiptStatus, type ReceiptType } from "../types";
import { type ReceiptWriteInput } from "../api/receipt";

/**
 * Receipt editor schema + form/validate/error helpers (spec §7/§8; FR-REC-001…-020, -024).
 * The editor captures the two-mode draft and previews the derived cash-received + live
 * balance-due-after — it never asserts Σdebit=Σcredit (LED owns `PostingService`; the
 * server is authoritative). Money is `Decimal(18,4)` throughout (decimal.js, never JS
 * float). Every module error code maps to its exact spec §8 copy via `mapReceiptError`.
 */

const DECIMAL = /^\d*\.?\d*$/;

function dec(v: string): Decimal {
  try {
    return toDecimal(v.trim() === "" ? "0" : v);
  } catch {
    return new Decimal(0);
  }
}

/** Editable only while DRAFT (FR-REC-024). A POSTED/CANCELLED id redirects to the viewer. */
export function isReceiptEditable(status: ReceiptStatus): boolean {
  return status === "DRAFT";
}

/** True when the mode requires a cheque/txn reference (FR-REC-004). */
export function requiresChequeRef(mode: PaymentMode | ""): boolean {
  return mode === "MFS" || mode === "BANK_TRANSFER" || mode === "CHEQUE";
}

export interface ReceiptFormValues {
  receiptType: ReceiptType | "";
  receiptDate: string; // DD/MM/YYYY
  paymentMode: PaymentMode | "";
  depositAccountId: string;
  chequeTxnRef: string;
  narration: string;
  // §A IPC-linked
  customerId: string;
  ipcId: string;
  taxDeductedAtSource: string; // Decimal string
  // §B General
  partyId: string;
  generalTargetAccountId: string;
  projectId: string; // "" = General (no project)
  costCentreId: string;
  purposeId: string;
  // Shared money
  amountSettled: string; // Decimal string
}

export const emptyReceiptForm: ReceiptFormValues = {
  receiptType: "",
  receiptDate: "",
  paymentMode: "",
  depositAccountId: "",
  chequeTxnRef: "",
  narration: "",
  customerId: "",
  ipcId: "",
  taxDeductedAtSource: "0.0000",
  partyId: "",
  generalTargetAccountId: "",
  projectId: "",
  costCentreId: "",
  purposeId: "",
  amountSettled: "",
};

export type FieldErrors = Partial<Record<keyof ReceiptFormValues, string>>;

/** Derived cash-received = amountSettled − taxDeductedAtSource, clamped ≥ 0 (FR-REC-019). */
export function derivedCashReceived(v: Pick<ReceiptFormValues, "receiptType" | "amountSettled" | "taxDeductedAtSource">): string {
  const settled = dec(v.amountSettled);
  if (v.receiptType !== "IPC_LINKED") return settled.toFixed(4);
  const tds = dec(v.taxDeductedAtSource);
  const cash = settled.minus(tds);
  return (cash.isNegative() ? new Decimal(0) : cash).toFixed(4);
}

/** Balance-due-after = last-fetched outstanding − amountSettled (FR-REC-018). May go negative. */
export function balanceDueAfter(outstanding: string | null, amountSettled: string): string {
  if (outstanding == null) return "0.0000";
  return dec(outstanding).minus(dec(amountSettled)).toFixed(4);
}

/** True when amountSettled exceeds the last-fetched outstanding (client pre-check; FR-REC-017). */
export function exceedsOutstanding(outstanding: string | null, amountSettled: string): boolean {
  if (outstanding == null) return false;
  const settled = dec(amountSettled);
  if (settled.lessThanOrEqualTo(0)) return false;
  return settled.greaterThan(dec(outstanding));
}

/** `DD/MM/YYYY` → the API's `YYYY-MM-DD`. */
function uiDateToApi(value: string): string {
  const d = parseDate(value);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** `YYYY-MM-DD` (or ISO) → `DD/MM/YYYY` for the form. */
export function apiDateToUi(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

interface ValidateContext {
  /** Last-fetched outstanding for the picked IPC — set once the picker resolves; used only for the client-side over-application pre-check. */
  outstanding: string | null;
}

/**
 * Full form validate for Save/Post (spec §7/§8; FR-REC-001…-020). Returns `{ values }`
 * on success, else `{ errors }`. Every message is the exact spec §8 string. Excludes the
 * postable-required checks that only Post enforces (Post-gate is composed separately).
 */
export function validateReceipt(
  form: ReceiptFormValues,
  ctx: ValidateContext,
): { values: ReceiptFormValues; errors: null } | { values: null; errors: FieldErrors } {
  const errors: FieldErrors = {};

  if (!form.receiptType) errors.receiptType = "Choose a receipt mode.";
  if (!form.receiptDate.trim()) errors.receiptDate = "Enter a receipt date.";
  else {
    try {
      parseDate(form.receiptDate);
    } catch {
      errors.receiptDate = "Enter a valid date (DD/MM/YYYY).";
    }
  }
  if (!form.paymentMode) errors.paymentMode = "Choose a payment mode.";
  if (!form.depositAccountId) errors.depositAccountId = "Choose the account receiving this payment.";
  if (requiresChequeRef(form.paymentMode) && !form.chequeTxnRef.trim()) {
    errors.chequeTxnRef = "Enter a reference for this payment mode.";
  }

  // Amount settled — must be > 0.
  if (!form.amountSettled.trim()) {
    errors.amountSettled = "Enter an amount greater than zero.";
  } else if (!DECIMAL.test(form.amountSettled.trim())) {
    errors.amountSettled = "Enter a valid amount.";
  } else if (dec(form.amountSettled).lessThanOrEqualTo(0)) {
    errors.amountSettled = "Enter an amount greater than zero.";
  }

  if (form.receiptType === "IPC_LINKED") {
    if (!form.customerId) errors.customerId = "Choose a customer.";
    if (!form.ipcId) errors.ipcId = "Choose a posted IPC to reference.";
    if (form.taxDeductedAtSource.trim()) {
      if (!DECIMAL.test(form.taxDeductedAtSource.trim())) {
        errors.taxDeductedAtSource = "Enter a valid amount.";
      } else if (dec(form.taxDeductedAtSource).isNegative()) {
        errors.taxDeductedAtSource = "Tax deducted can't be negative.";
      } else if (
        !errors.amountSettled &&
        dec(form.taxDeductedAtSource).greaterThan(dec(form.amountSettled))
      ) {
        errors.taxDeductedAtSource = "Tax deducted can't exceed the amount settled.";
      }
    }
    // Client-side over-application pre-check (FR-REC-017). Server re-checks at Post.
    if (
      !errors.amountSettled &&
      form.ipcId &&
      exceedsOutstanding(ctx.outstanding, form.amountSettled)
    ) {
      errors.amountSettled = `This exceeds the IPC's remaining outstanding of ৳${dec(ctx.outstanding!).toFixed(4)}.`;
    }
  }

  if (form.receiptType === "GENERAL") {
    if (!form.partyId) errors.partyId = "Choose a party.";
    if (!form.generalTargetAccountId) errors.generalTargetAccountId = "Choose an income account or the advance-from-customer liability.";
    if (!form.costCentreId) errors.costCentreId = "Choose a cost centre.";
    if (form.projectId && !form.purposeId) errors.purposeId = "Choose a purpose.";
  }

  if (Object.keys(errors).length > 0) {
    return { values: null, errors };
  }
  return { values: form, errors: null };
}

/**
 * Compose the Post-gate: all postable-required fields must be present + valid. The gate
 * is a *pre-request* UX gate (Post button disabled state); the server remains authoritative
 * (`MISSING_REQUIRED_DIMENSION` / `MISSING_PARTY_ON_CONTROL_LINE` backstops).
 */
export function isPostable(form: ReceiptFormValues, outstanding: string | null): boolean {
  const res = validateReceipt(form, { outstanding });
  return res.errors === null;
}

/** Build the create/patch payload from validated form values (contract 11 § "POST /api/receipt"). */
export function formToWriteInput(v: ReceiptFormValues): ReceiptWriteInput {
  const receiptDate = uiDateToApi(v.receiptDate);
  const paymentMode = v.paymentMode as PaymentMode;
  const chequeTxnRef = requiresChequeRef(paymentMode) ? (v.chequeTxnRef.trim() || null) : null;
  const narration = v.narration.trim() || null;

  if (v.receiptType === "IPC_LINKED") {
    return {
      receiptType: "IPC_LINKED",
      receiptDate,
      paymentMode,
      depositAccountId: v.depositAccountId,
      ipcId: v.ipcId,
      amountSettled: dec(v.amountSettled).toFixed(4),
      taxDeductedAtSource: dec(v.taxDeductedAtSource || "0").toFixed(4),
      chequeTxnRef,
      narration,
    };
  }
  // GENERAL
  return {
    receiptType: "GENERAL",
    receiptDate,
    paymentMode,
    depositAccountId: v.depositAccountId,
    partyId: v.partyId,
    generalTargetAccountId: v.generalTargetAccountId,
    projectId: v.projectId || null,
    costCentreId: v.costCentreId,
    purposeId: v.projectId ? v.purposeId : null,
    amountSettled: dec(v.amountSettled).toFixed(4),
    chequeTxnRef,
    narration,
  };
}

/** Populate the form from a loaded DRAFT (edit pre-fill). */
export function receiptToForm(r: Receipt): ReceiptFormValues {
  return {
    receiptType: r.receiptType,
    receiptDate: apiDateToUi(r.receiptDate),
    paymentMode: r.paymentMode,
    depositAccountId: r.depositAccountId,
    chequeTxnRef: r.chequeTxnRef ?? "",
    narration: r.narration ?? "",
    customerId: r.receiptType === "IPC_LINKED" ? r.partyId : "",
    ipcId: r.ipcId ?? "",
    taxDeductedAtSource: dec(r.taxDeductedAtSource ?? "0").toFixed(4),
    partyId: r.receiptType === "GENERAL" ? r.partyId : "",
    generalTargetAccountId: r.generalTargetAccountId ?? "",
    projectId: r.receiptType === "GENERAL" ? (r.projectId ?? "") : "",
    costCentreId: r.receiptType === "GENERAL" ? (r.costCentreId ?? "") : "",
    purposeId: r.receiptType === "GENERAL" ? (r.purposeId ?? "") : "",
    amountSettled: dec(r.amountSettled).toFixed(4),
  };
}

/**
 * Map a module error code (API contract 11) to its exact spec §8 copy. `field`-scoped
 * errors surface inline at the offending control; others render as a top-of-form banner.
 */
export function mapReceiptError(
  code: string,
  ctx?: { outstanding?: string | null },
): { field?: keyof ReceiptFormValues; message: string } {
  switch (code) {
    case "VALIDATION_ERROR":
      return { message: "Couldn't save this receipt. Please check the highlighted fields." };
    case "SETTLED_COMPOSITION_INVALID":
      return { field: "amountSettled", message: "The settled amount, cash received and tax deducted don't add up. Please review the figures." };
    case "REFERENCE_XOR_VIOLATION":
      return { message: "This receipt must reference either a posted IPC or a general target — not both." };
    case "CHEQUE_REF_REQUIRED":
      return { field: "chequeTxnRef", message: "Enter a reference for this payment mode." };
    case "IPC_NOT_POSTED":
      return { field: "ipcId", message: "This IPC is no longer posted." };
    case "RECEIPT_EXCEEDS_OUTSTANDING":
      return {
        field: "amountSettled",
        message: ctx?.outstanding != null
          ? `This exceeds the IPC's remaining outstanding of ৳${dec(ctx.outstanding).toFixed(4)}.`
          : "The IPC's remaining outstanding has changed since you started — refresh and re-check the amount.",
      };
    case "INVALID_GENERAL_TARGET":
      return { field: "generalTargetAccountId", message: "This account can't receive a general receipt." };
    case "MISSING_REQUIRED_DIMENSION":
      return { message: "A required posting dimension (project, cost centre or purpose) is missing." };
    case "MISSING_PARTY_ON_CONTROL_LINE":
      return { message: "The party couldn't be resolved for the control line." };
    case "UNBALANCED_ENTRY":
      return { message: "Couldn't post this receipt. Please try again." };
    case "VOUCHER_POSTED_IMMUTABLE":
      return { message: "This receipt was already posted (by someone else). Refresh to see it." };
    case "OPTIMISTIC_LOCK_CONFLICT":
      return { message: "This receipt was just changed by someone else. Reload and try again." };
    case "PERIOD_CLOSED":
      return { message: "This period is closed. Choose a date in an open period or contact Admin." };
    case "NO_PERIOD_DEFINED":
      return { message: "No accounting period is defined for this date. Define one before posting." };
    case "PROJECT_CLOSED":
      return { message: "This project is closed and can't accept new postings." };
    case "FORBIDDEN":
      return { message: "You don't have permission to perform this action." };
    case "NOT_FOUND":
      return { message: "This receipt could not be found." };
    default:
      return { message: "Something went wrong. Please try again." };
  }
}
