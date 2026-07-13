import { z } from "zod";
import { parseDate } from "@/lib/format";
import { toDecimal } from "@/lib/money";
import { type GrnLineInput, type GrnWriteInput } from "../api/grns";
import {
  type GrnStatus,
  type PurchaseMatchStatus,
} from "../types";

/**
 * GRN entry-form schema + display / error helpers (brief §Scope; spec §7/§8;
 * FR-PUR-015/-016/-017/-018/-024). The GRN is a receipt voucher — this validates
 * draft capture and the postable-required superset. Every module error code maps to
 * its exact spec §8 copy via `mapGrnError`. `receivedValue` is a live client preview
 * only; the server figure is authoritative on the response.
 */

const DECIMAL = /^\d*\.?\d*$/;

export const GRN_STATUSES: readonly GrnStatus[] = ["DRAFT", "POSTED", "CANCELLED"];
export const GRN_STATUS_LABEL: Record<GrnStatus, string> = {
  DRAFT: "Draft",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
};

export const MATCH_STATUS_LABEL: Record<PurchaseMatchStatus, string> = {
  MATCHED: "Matched",
  OVER_RECEIVED: "Over-received",
  UNDER_RECEIVED: "Under-received",
  PENDING_RECEIPT: "Pending receipt",
};

/** Only a DRAFT is editable/deletable on this screen (FR-PUR-024). */
export function isEditableGrn(status: GrnStatus): boolean {
  return status === "DRAFT";
}

export type GrnLineFieldKey =
  | "itemId"
  | "receivedQty"
  | "rate"
  | "godownId"
  | "costCentreId"
  | "purposeId";

export interface GrnLineError {
  itemId?: string;
  receivedQty?: string;
  rate?: string;
  godownId?: string;
  costCentreId?: string;
  purposeId?: string;
}

const lineSchema = z
  .object({
    itemId: z.string().min(1, "Select an item."),
    orderedQty: z.string().default(""),
    billedQty: z.string().default(""),
    receivedQty: z
      .string()
      .min(1, "Received quantity must be greater than 0.")
      .refine((v) => DECIMAL.test(v.trim()) && Number(v) > 0, "Received quantity must be greater than 0."),
    rate: z
      .string()
      .min(1, "Enter a valid rate.")
      .refine((v) => DECIMAL.test(v.trim()) && Number(v) >= 0, "Enter a valid rate."),
    godownId: z.string().min(1, "Select a godown."),
    costCentreId: z.string().min(1, "Select a cost centre."),
    purposeId: z.string().min(1, "Select or create a purpose."),
    matchStatus: z
      .enum(["MATCHED", "OVER_RECEIVED", "UNDER_RECEIVED", "PENDING_RECEIPT"] as [
        PurchaseMatchStatus,
        ...PurchaseMatchStatus[],
      ])
      .optional(),
  });

export const grnFormSchema = z.object({
  projectId: z.string().min(1, "Select a project."),
  supplierId: z.string().min(1, "Select a supplier."),
  purchaseOrderId: z.string().default(""),
  purchaseBillId: z.string().default(""),
  receiptDate: z
    .string()
    .min(1, "Enter a valid receipt date.")
    .refine((v) => {
      try {
        parseDate(v);
        return true;
      } catch {
        return false;
      }
    }, "Enter a valid receipt date."),
  narration: z.string().default(""),
  lines: z.array(lineSchema).min(1, "Nothing left to receive on this reference."),
});

export type GrnFormValues = z.infer<typeof grnFormSchema>;

export const EMPTY_GRN_LINE: GrnFormValues["lines"][number] = {
  itemId: "",
  orderedQty: "",
  billedQty: "",
  receivedQty: "",
  rate: "",
  godownId: "",
  costCentreId: "",
  purposeId: "",
};

export const emptyGrnForm: GrnFormValues = {
  projectId: "",
  supplierId: "",
  purchaseOrderId: "",
  purchaseBillId: "",
  receiptDate: "",
  narration: "",
  lines: [],
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
export function formToWriteInput(v: GrnFormValues): GrnWriteInput {
  return {
    projectId: v.projectId,
    supplierId: v.supplierId,
    purchaseOrderId: v.purchaseOrderId || null,
    purchaseBillId: v.purchaseBillId || null,
    receiptDate: uiDateToApi(v.receiptDate),
    narration: v.narration.trim() || null,
    lines: v.lines.map(
      (l): GrnLineInput => ({
        itemId: l.itemId,
        receivedQty: l.receivedQty,
        rate: decOrZero(l.rate),
        godownId: l.godownId,
        costCentreId: l.costCentreId,
        purposeId: l.purposeId,
      }),
    ),
  };
}

/** Live client-preview `receivedValue = receivedQty × rate` per line + total. */
export function computeGrnTotals(lines: GrnFormValues["lines"]): { total: string; perLine: string[] } {
  let total = toDecimal("0");
  const perLine: string[] = [];
  for (const l of lines) {
    const q = Number(l.receivedQty);
    const r = Number(l.rate);
    if (Number.isFinite(q) && Number.isFinite(r) && q > 0 && r >= 0) {
      const v = toDecimal(String(q)).times(toDecimal(String(r)));
      total = total.plus(v);
      perLine.push(v.toFixed(4));
    } else {
      perLine.push("0.0000");
    }
  }
  return { total: total.toFixed(4), perLine };
}

/**
 * Client-side guard: postable-required superset (FR-PUR-015/-016; spec §11).
 * The server re-checks every constraint; this only prevents an obvious client-side
 * call. Post requires receipt date + at least one line + per-line qty > 0 + all
 * four dimensions on every line.
 */
export function isPostable(v: GrnFormValues): boolean {
  if (!v.projectId || !v.supplierId || !v.receiptDate) return false;
  if (v.lines.length === 0) return false;
  for (const l of v.lines) {
    if (!l.itemId || !l.godownId || !l.costCentreId || !l.purposeId) return false;
    const q = Number(l.receivedQty);
    if (!Number.isFinite(q) || q <= 0) return false;
    const r = Number(l.rate);
    if (!Number.isFinite(r) || r < 0) return false;
  }
  return true;
}

/**
 * Compute the advisory per-line match status from the reference (ordered/billed)
 * and received quantities — a client preview only; the server figure is authoritative
 * once posted. `null` while received qty is blank / zero (rendered as "Pending receipt").
 */
export function previewMatch(
  referenceOpenQty: string,
  receivedQty: string,
): { status: PurchaseMatchStatus | null; delta: number } {
  const ref = Number(referenceOpenQty);
  const rec = Number(receivedQty);
  if (!Number.isFinite(rec) || rec <= 0) return { status: null, delta: 0 };
  if (!Number.isFinite(ref) || ref <= 0) return { status: "OVER_RECEIVED", delta: rec };
  const delta = rec - ref;
  if (Math.abs(delta) < 0.0001) return { status: "MATCHED", delta: 0 };
  if (delta > 0) return { status: "OVER_RECEIVED", delta };
  return { status: "UNDER_RECEIVED", delta };
}

export type GrnFormFieldKey = keyof GrnFormValues;

/**
 * Map a module error code to its exact spec §8 copy. Field-scoped errors are surfaced
 * inline at the offending control; the rest render as a top-of-form banner. Optional
 * `lineField`/`lineIndex` targets per-line inline placement (e.g. cross-project godown).
 */
export function mapGrnError(
  code: string,
  hints?: { path?: (string | number)[] },
): { field?: GrnFormFieldKey; lineField?: GrnLineFieldKey; lineIndex?: number; message: string } {
  let lineIndex: number | undefined;
  let leaf: string | undefined;
  const p = hints?.path;
  if (p && p.length >= 3 && p[0] === "lines") {
    const idx = Number(p[1]);
    if (Number.isFinite(idx)) lineIndex = idx;
    leaf = String(p[2]);
  }
  switch (code) {
    case "CROSS_PROJECT_DIMENSION": {
      const target: GrnLineFieldKey =
        leaf === "purposeId" ? "purposeId" : "godownId";
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
        message: "This PO isn't receivable right now.",
      };
    case "PERIOD_CLOSED":
    case "NO_PERIOD_DEFINED":
      return { message: "The period for this receipt's date is closed — posting isn't allowed." };
    case "PROJECT_CLOSED":
      return { message: "This project is closed — posting isn't allowed." };
    case "MISSING_REQUIRED_DIMENSION":
      return {
        lineIndex,
        message:
          "Every line needs project, cost centre, purpose, and godown before you can post.",
      };
    case "NEGATIVE_STOCK":
      return { message: "This receipt would take stock negative. Reduce the received quantity." };
    case "VOUCHER_POSTED_IMMUTABLE":
      return { message: "This GRN has been posted and can't be edited here." };
    case "OPTIMISTIC_LOCK_CONFLICT":
      return { message: "This GRN was changed elsewhere. Reload to see the latest version." };
    case "NOT_FOUND":
      return { message: "This GRN doesn't exist or isn't in your company." };
    case "FORBIDDEN":
      return { message: "You don't have access to this GRN." };
    case "VALIDATION_ERROR":
      return { message: "Couldn't save this GRN. Please check the highlighted fields." };
    default:
      return { message: "Couldn't save this GRN. Please try again." };
  }
}
