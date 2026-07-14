import { z } from "zod";
import { parseDate } from "@/lib/format";
import { toDecimal } from "@/lib/money";
import {
  type PurchaseBillLineInput,
  type PurchaseBillWriteInput,
} from "../api/bills";
import { type PurchaseBillStatus, type PurchaseMatchStatus } from "../types";

/**
 * Purchase Bill entry-form schema + display / error helpers (brief §Scope; spec §7/§8;
 * FR-PUR-004/-005/-006/-007/-010/-024). The bill is the POSTING voucher — this validates
 * the draft capture and the postable-required superset. Every module error code maps to
 * its exact spec §8 copy via `mapBillError`. Live `netPayable` recompute is a client
 * preview only; the server figure is authoritative on the response.
 */

const DECIMAL = /^\d*\.?\d*$/;

export const BILL_STATUSES: readonly PurchaseBillStatus[] = ["DRAFT", "POSTED", "CANCELLED"];
export const BILL_STATUS_LABEL: Record<PurchaseBillStatus, string> = {
  DRAFT: "Draft",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
};

/** Only a DRAFT is editable/deletable on this screen (FR-PUR-024). */
export function isEditableBill(status: PurchaseBillStatus): boolean {
  return status === "DRAFT";
}

/** Cancel / Repost only from POSTED (FR-PUR-022). */
export function isCancellableBill(status: PurchaseBillStatus): boolean {
  return status === "POSTED";
}

/** Per-line field-scoped error placement (matches the line grid's column semantics). */
export type BillLineFieldKey =
  | "itemId"
  | "expenseAccountId"
  | "isStockLine"
  | "billedQty"
  | "rate"
  | "vatInputAmount"
  | "tdsAmount"
  | "aitAmount"
  | "godownId"
  | "costCentreId"
  | "purposeId";

export interface BillLineError {
  itemId?: string;
  expenseAccountId?: string;
  isStockLine?: string;
  billedQty?: string;
  rate?: string;
  vatInputAmount?: string;
  tdsAmount?: string;
  aitAmount?: string;
  godownId?: string;
  costCentreId?: string;
  purposeId?: string;
}

const lineSchema = z
  .object({
    isStockLine: z.boolean(),
    itemId: z.string().default(""),
    expenseAccountId: z.string().default(""),
    billedQty: z
      .string()
      .refine((v) => v === "" || DECIMAL.test(v.trim()), "Enter a valid quantity.")
      .default(""),
    rate: z.string().min(1, "Enter a valid rate.").refine(
      (v) => DECIMAL.test(v.trim()) && Number(v) >= 0,
      "Enter a valid rate.",
    ),
    vatInputAmount: z
      .string()
      .default("0")
      .refine((v) => v === "" || (DECIMAL.test(v.trim()) && Number(v) >= 0), "VAT input can't be negative."),
    tdsAmount: z
      .string()
      .default("0")
      .refine((v) => v === "" || (DECIMAL.test(v.trim()) && Number(v) >= 0), "TDS can't be negative."),
    aitAmount: z
      .string()
      .default("0")
      .refine((v) => v === "" || (DECIMAL.test(v.trim()) && Number(v) >= 0), "AIT can't be negative."),
    godownId: z.string().default(""),
    costCentreId: z.string().min(1, "Select a cost centre."),
    purposeId: z.string().min(1, "Select or create a purpose."),
    // Read-only server-derived fields kept on the form line so the editor can pass
    // them through to the grid's match-status badge (never sent back on save).
    receivedQty: z.string().optional(),
    matchStatus: z
      .enum(["MATCHED", "OVER_RECEIVED", "UNDER_RECEIVED", "PENDING_RECEIPT"] as [
        PurchaseMatchStatus,
        ...PurchaseMatchStatus[],
      ])
      .optional(),
  })
  .superRefine((line, ctx) => {
    // Stock XOR non-stock (LINE_TYPE_INVALID, FR-PUR-005 / edge 10).
    if (line.isStockLine) {
      if (!line.itemId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["itemId"], message: "Select an item." });
      }
      if (!line.godownId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["godownId"], message: "Select a godown." });
      }
      const qty = Number(line.billedQty);
      if (!line.billedQty || !Number.isFinite(qty) || qty <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["billedQty"],
          message: "Billed quantity must be greater than 0.",
        });
      }
      if (line.expenseAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["isStockLine"],
          message: "Choose either an item or an expense account for this line, not both.",
        });
      }
    } else {
      if (!line.expenseAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["expenseAccountId"],
          message: "Select an expense account.",
        });
      }
      if (line.itemId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["isStockLine"],
          message: "Choose either an item or an expense account for this line, not both.",
        });
      }
      // Non-stock line still needs a positive quantity (typically 1) for line amount.
      const qty = Number(line.billedQty || "1");
      if (line.billedQty && (!Number.isFinite(qty) || qty <= 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["billedQty"],
          message: "Enter a valid quantity.",
        });
      }
    }
  });

export const billFormSchema = z
  .object({
    projectId: z.string().min(1, "Select a project."),
    supplierId: z.string().min(1, "Select a supplier."),
    purchaseOrderId: z.string().default(""),
    supplierInvoiceRef: z.string().default(""),
    billDate: z.string().min(1, "Enter a valid bill date.").refine((v) => {
      try {
        parseDate(v);
        return true;
      } catch {
        return false;
      }
    }, "Enter a valid bill date."),
    dueDate: z.string().min(1, "Enter a valid due date.").refine((v) => {
      try {
        parseDate(v);
        return true;
      } catch {
        return false;
      }
    }, "Enter a valid due date."),
    narration: z.string().default(""),
    lines: z.array(lineSchema).min(1, "Add a line to continue."),
  })
  .superRefine((form, ctx) => {
    // Due date must be on or after the bill date (dueDate ≥ billDate).
    try {
      const bill = parseDate(form.billDate);
      const due = parseDate(form.dueDate);
      if (due.getTime() < bill.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dueDate"],
          message: "Due date can't be before the bill date.",
        });
      }
    } catch {
      // Already surfaced by the field-level refinements above.
    }
  });

export type BillFormValues = z.infer<typeof billFormSchema>;

export const EMPTY_BILL_LINE: BillFormValues["lines"][number] = {
  isStockLine: true,
  itemId: "",
  expenseAccountId: "",
  billedQty: "",
  rate: "",
  vatInputAmount: "0",
  tdsAmount: "0",
  aitAmount: "0",
  godownId: "",
  costCentreId: "",
  purposeId: "",
};

export const emptyBillForm: BillFormValues = {
  projectId: "",
  supplierId: "",
  purchaseOrderId: "",
  supplierInvoiceRef: "",
  billDate: "",
  dueDate: "",
  narration: "",
  lines: [{ ...EMPTY_BILL_LINE }],
};

/** `DD/MM/YYYY` → the API's `YYYY-MM-DD`. */
function uiDateToApi(value: string): string {
  const d = parseDate(value);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function decOrZero(v: string): string {
  if (!v.trim()) return "0";
  return v;
}

/** Build the create/patch payload from validated form values. */
export function formToWriteInput(v: BillFormValues): PurchaseBillWriteInput {
  return {
    projectId: v.projectId,
    supplierId: v.supplierId,
    purchaseOrderId: v.purchaseOrderId || null,
    supplierInvoiceRef: v.supplierInvoiceRef.trim() || null,
    billDate: uiDateToApi(v.billDate),
    dueDate: uiDateToApi(v.dueDate),
    narration: v.narration.trim() || null,
    lines: v.lines.map(
      (l): PurchaseBillLineInput => ({
        itemId: l.isStockLine ? l.itemId || null : null,
        expenseAccountId: !l.isStockLine ? l.expenseAccountId || null : null,
        isStockLine: l.isStockLine,
        billedQty: l.billedQty || "1",
        rate: decOrZero(l.rate),
        vatInputAmount: decOrZero(l.vatInputAmount),
        tdsAmount: decOrZero(l.tdsAmount),
        aitAmount: decOrZero(l.aitAmount),
        godownId: l.isStockLine ? l.godownId || null : null,
        costCentreId: l.costCentreId,
        purposeId: l.purposeId,
      }),
    ),
  };
}

/** Live totals-strip figures computed as a client preview (FR-PUR-007). */
export interface BillTotals {
  gross: string;
  vatInput: string;
  tds: string;
  ait: string;
  netPayable: string;
  netPayableNegative: boolean;
}

export function computeBillTotals(lines: BillFormValues["lines"]): BillTotals {
  let gross = toDecimal("0");
  let vat = toDecimal("0");
  let tds = toDecimal("0");
  let ait = toDecimal("0");
  for (const l of lines) {
    const q = Number(l.billedQty || (l.isStockLine ? "0" : "1"));
    const r = Number(l.rate);
    if (Number.isFinite(q) && Number.isFinite(r) && q > 0 && r >= 0) {
      gross = gross.plus(toDecimal(String(q)).times(toDecimal(String(r))));
    }
    const v = Number(l.vatInputAmount);
    if (Number.isFinite(v) && v >= 0) vat = vat.plus(toDecimal(String(v)));
    const t = Number(l.tdsAmount);
    if (Number.isFinite(t) && t >= 0) tds = tds.plus(toDecimal(String(t)));
    const a = Number(l.aitAmount);
    if (Number.isFinite(a) && a >= 0) ait = ait.plus(toDecimal(String(a)));
  }
  const net = gross.plus(vat).minus(tds).minus(ait);
  return {
    gross: gross.toFixed(4),
    vatInput: vat.toFixed(4),
    tds: tds.toFixed(4),
    ait: ait.toFixed(4),
    netPayable: net.toFixed(4),
    netPayableNegative: net.lt(0),
  };
}

/**
 * Client-side guard: the postable-required superset (FR-PUR-008, FR-PUR-010; spec §11).
 * The server re-checks every constraint; this only prevents an obvious client-side call.
 */
export function isPostable(v: BillFormValues, totals: BillTotals): boolean {
  if (!v.projectId || !v.supplierId || !v.billDate || !v.dueDate) return false;
  if (v.lines.length === 0) return false;
  if (totals.netPayableNegative) return false;
  for (const l of v.lines) {
    if (!l.costCentreId || !l.purposeId) return false;
    if (l.isStockLine) {
      if (!l.itemId || !l.godownId) return false;
      const q = Number(l.billedQty);
      if (!Number.isFinite(q) || q <= 0) return false;
    } else {
      if (!l.expenseAccountId) return false;
    }
    const r = Number(l.rate);
    if (!Number.isFinite(r) || r < 0) return false;
  }
  return true;
}

export type BillFormFieldKey = keyof BillFormValues;

/**
 * Map a module error code to its exact spec §8 copy. `field`-scoped errors are surfaced
 * inline at the offending control; the rest render as a top-of-form banner. Optional
 * `lineField`/`lineIndex` targets a per-line inline placement (e.g. cross-project godown).
 */
export function mapBillError(
  code: string,
  hints?: { path?: (string | number)[] },
): { field?: BillFormFieldKey; lineField?: BillLineFieldKey; lineIndex?: number; message: string } {
  let lineIndex: number | undefined;
  let leaf: string | undefined;
  const p = hints?.path;
  if (p && p.length >= 3 && p[0] === "lines") {
    const idx = Number(p[1]);
    if (Number.isFinite(idx)) lineIndex = idx;
    leaf = String(p[2]);
  }

  switch (code) {
    case "LINE_TYPE_INVALID":
      return {
        lineIndex,
        lineField: "isStockLine",
        message: "Choose either an item or an expense account for this line, not both.",
      };
    case "NET_PAYABLE_NEGATIVE":
      return {
        message:
          "TDS and AIT together are larger than the gross plus VAT input — net payable can't be negative. Reduce the withholding or increase the bill value.",
      };
    case "CROSS_PROJECT_DIMENSION": {
      const target: BillLineFieldKey =
        leaf === "godownId" ? "godownId" : leaf === "purposeId" ? "purposeId" : "godownId";
      const label = target === "purposeId" ? "purpose" : "godown";
      return {
        lineField: target,
        lineIndex,
        message: `This ${label} doesn't belong to the selected project.`,
      };
    }
    case "PO_NOT_BILLABLE":
      return {
        field: "purchaseOrderId",
        message: "This PO isn't billable — it must be approved first.",
      };
    case "PERIOD_CLOSED":
    case "NO_PERIOD_DEFINED":
      return { message: "The period for this bill's date is closed — posting isn't allowed." };
    case "PROJECT_CLOSED":
      return { message: "This project is closed — posting isn't allowed." };
    case "MISSING_REQUIRED_DIMENSION":
      return {
        lineIndex,
        message:
          "Every line needs project, cost centre, purpose, and (for stock lines) godown before you can post.",
      };
    case "MISSING_PARTY_ON_CONTROL_LINE":
      return { message: "The supplier is missing on the accounts-payable line. Reselect the supplier and try again." };
    case "UNBALANCED_ENTRY":
      return {
        message: "This bill couldn't be posted due to a system error. Please contact support.",
      };
    case "BILL_HAS_APPLIED_PAYMENTS":
      return {
        message:
          "This bill has payments applied to it. Reverse or reallocate those payments first before cancelling.",
      };
    case "ALREADY_REVERSED":
      return { message: "This bill has already been reversed." };
    case "VOUCHER_POSTED_IMMUTABLE":
      return { message: "This bill has been posted and can't be edited here." };
    case "VOUCHER_NOT_POSTED":
      return { message: "This bill isn't posted yet — there's nothing to cancel or repost." };
    case "OPTIMISTIC_LOCK_CONFLICT":
      return { message: "This bill was changed elsewhere. Reload to see the latest version." };
    case "NEGATIVE_STOCK":
      return { message: "This receipt would take stock negative. Reduce the received quantity." };
    case "NOT_FOUND":
      return { message: "This bill doesn't exist or isn't in your company." };
    case "FORBIDDEN":
      return { message: "You don't have access to this bill." };
    case "VALIDATION_ERROR":
      return { message: "Couldn't save this bill. Please check the highlighted fields." };
    default:
      return { message: "Couldn't save this bill. Please try again." };
  }
}

/** Cancel dialog schema — the mandatory non-empty reason (spec §8). */
export const cancelBillSchema = z.object({
  reason: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, "Enter a reason for this cancellation."),
});
export type CancelBillFormValues = z.infer<typeof cancelBillSchema>;

/** Repost dialog schema — the same mandatory reason. */
export const repostBillSchema = z.object({
  reason: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, "Enter a reason for this correction."),
});
export type RepostBillFormValues = z.infer<typeof repostBillSchema>;
