import { z } from "zod";
import { parseDate } from "@/lib/format";
import { type PurchaseOrderLineInput, type PurchaseOrderWriteInput } from "../api/orders";
import { type PurchaseOrderStatus } from "../types";

/**
 * PO entry-form schema + display / error helpers (brief §Scope; spec §7/§8; FR-PUR-001/-002/-024).
 * The PO is a NON-posting commitment — this validates the draft capture: header + a repeatable
 * line grid where each line carries the four dimensions (project inherited from the header +
 * cost_centre + purpose + godown). Line `lineAmount` is a live read-only client preview
 * (`orderedQty × rate`) reconciled to the server figure on Save. Every module error code
 * maps to its exact spec §8 copy via `mapPoError`.
 */

const DECIMAL = /^\d*\.?\d*$/;

export const PO_STATUSES: readonly PurchaseOrderStatus[] = [
  "DRAFT",
  "APPROVED",
  "PARTIALLY_BILLED",
  "PARTIALLY_RECEIVED",
  "CLOSED",
  "CANCELLED",
];
export const PO_STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  DRAFT: "Draft",
  APPROVED: "Approved",
  PARTIALLY_BILLED: "Partially billed",
  PARTIALLY_RECEIVED: "Partially received",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

/** Only a DRAFT is editable/approvable/cancellable-from-DRAFT on this screen (FR-PUR-024). */
export function isEditablePo(status: PurchaseOrderStatus): boolean {
  return status === "DRAFT";
}

/** Cancel is enabled only from DRAFT or APPROVED (brief §Scope 8). */
export function isCancellablePo(status: PurchaseOrderStatus): boolean {
  return status === "DRAFT" || status === "APPROVED";
}

const lineSchema = z.object({
  itemId: z.string().min(1, "Select an item."),
  orderedQty: z
    .string()
    .min(1, "Enter an ordered quantity greater than zero.")
    .refine(
      (v) => DECIMAL.test(v.trim()) && Number(v) > 0,
      "Enter an ordered quantity greater than zero.",
    ),
  rate: z
    .string()
    .min(1, "Enter a rate.")
    .refine((v) => DECIMAL.test(v.trim()) && Number(v) >= 0, "Enter a non-negative rate."),
  godownId: z.string().min(1, "Select a godown."),
  costCentreId: z.string().min(1, "Select a cost centre."),
  purposeId: z.string().min(1, "Select a purpose."),
});

export const poFormSchema = z.object({
  projectId: z.string().min(1, "Select a project."),
  supplierId: z.string().min(1, "Select a supplier."),
  poDate: z
    .string()
    .min(1, "Enter the PO date.")
    .refine((v) => {
      if (!v) return true;
      try {
        parseDate(v);
        return true;
      } catch {
        return false;
      }
    }, "Enter a valid PO date."),
  expectedDeliveryDate: z
    .string()
    .default("")
    .refine((v) => {
      if (!v) return true;
      try {
        parseDate(v);
        return true;
      } catch {
        return false;
      }
    }, "Enter a valid expected-delivery date."),
  narration: z.string().default(""),
  lines: z.array(lineSchema).min(1, "Add a line to continue."),
});

export type PoFormValues = z.infer<typeof poFormSchema>;

export const EMPTY_PO_LINE: PoFormValues["lines"][number] = {
  itemId: "",
  orderedQty: "",
  rate: "",
  godownId: "",
  costCentreId: "",
  purposeId: "",
};

export const emptyPoForm: PoFormValues = {
  projectId: "",
  supplierId: "",
  poDate: "",
  expectedDeliveryDate: "",
  narration: "",
  lines: [{ ...EMPTY_PO_LINE }],
};

/** `DD/MM/YYYY` → the API's `YYYY-MM-DD`. */
function uiDateToApi(value: string): string {
  const d = parseDate(value);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Build the create/patch payload from validated form values. */
export function formToWriteInput(v: PoFormValues): PurchaseOrderWriteInput {
  return {
    projectId: v.projectId,
    supplierId: v.supplierId,
    poDate: uiDateToApi(v.poDate),
    expectedDeliveryDate: v.expectedDeliveryDate ? uiDateToApi(v.expectedDeliveryDate) : null,
    narration: v.narration.trim() || null,
    lines: v.lines.map(
      (l): PurchaseOrderLineInput => ({
        itemId: l.itemId,
        orderedQty: l.orderedQty,
        rate: l.rate,
        godownId: l.godownId,
        costCentreId: l.costCentreId,
        purposeId: l.purposeId,
      }),
    ),
  };
}

/** Per-line field-scoped error placement (matches the line grid's column semantics). */
export type PoLineFieldKey = "itemId" | "orderedQty" | "rate" | "godownId" | "costCentreId" | "purposeId";

export interface PoLineError {
  itemId?: string;
  orderedQty?: string;
  rate?: string;
  godownId?: string;
  costCentreId?: string;
  purposeId?: string;
}

export type PoFormFieldKey = keyof PoFormValues;

/**
 * Map a module error code to its exact spec §8 copy. `field`-scoped errors are surfaced
 * inline at the offending control; the rest render as a top-of-form banner. Optional
 * `lineField`/`lineIndex` targets a per-line inline placement (e.g. cross-project godown).
 */
export function mapPoError(
  code: string,
  hints?: { path?: string[] },
): { field?: PoFormFieldKey; lineField?: PoLineFieldKey; lineIndex?: number; message: string } {
  // Best-effort line-field extraction from a server `details.path` like ["lines", 2, "godownId"].
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
      const target: PoLineFieldKey =
        leaf === "godownId" ? "godownId" : leaf === "purposeId" ? "purposeId" : "godownId";
      const label = target === "purposeId" ? "purpose" : "godown";
      return {
        lineField: target,
        lineIndex,
        message: `This ${label} doesn't belong to the selected project.`,
      };
    }
    case "PO_HAS_BILLS":
      return { message: "This PO already has a bill raised against it and can't be cancelled." };
    case "INVALID_PO_TRANSITION":
      return { message: "This purchase order can no longer be changed from its current state. Reload to see the latest." };
    case "OPTIMISTIC_LOCK_CONFLICT":
      return { message: "This purchase order was just changed by someone else. Reload and try again." };
    case "VOUCHER_POSTED_IMMUTABLE":
      return { message: "This purchase order has been approved and can't be edited here." };
    case "PROJECT_CLOSED":
      return { message: "This project is closed and can't accept a new purchase order." };
    case "FORBIDDEN":
      return { message: "You don't have permission to perform this action on this purchase order." };
    case "NOT_FOUND":
      return { message: "This purchase order could not be found. It may have been removed." };
    case "VALIDATION_ERROR":
      return { message: "Couldn't save this purchase order. Please check the highlighted fields." };
    default:
      return { message: "Couldn't save this purchase order. Please try again." };
  }
}

/** Cancel dialog schema — the mandatory non-empty reason (spec §8). */
export const cancelPoSchema = z.object({
  reason: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, "Enter a reason for the cancellation."),
});
export type CancelPoFormValues = z.infer<typeof cancelPoSchema>;
