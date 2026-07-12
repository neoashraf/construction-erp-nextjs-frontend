import { z } from "zod";
import { parseDate } from "@/lib/format";
import { type RequisitionWriteInput } from "../api/requisition";
import { type RequisitionPriority, type RequisitionStatus } from "../types";

/**
 * Requisition entry-form schema + display/error helpers (spec §7/§8). The requisition is a
 * workflow document, not a ledger voucher — this validates the request capture only. Money
 * is never entered (indicative rate/estimated value are server-derived). Every module error
 * code maps to its exact spec §8 copy via `mapRequisitionError`.
 */

export const PRIORITIES: readonly RequisitionPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];
export const PRIORITY_LABEL: Record<RequisitionPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

export const REQUISITION_STATUSES: readonly RequisitionStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "PARTIALLY_ISSUED",
  "ISSUED",
  "CLOSED",
];
export const STATUS_LABEL: Record<RequisitionStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PARTIALLY_ISSUED: "Partially issued",
  ISSUED: "Issued",
  CLOSED: "Closed",
};

/** Only a DRAFT is editable/deletable on this screen (FR-REQ-022). */
export function isEditable(status: RequisitionStatus): boolean {
  return status === "DRAFT";
}

const DECIMAL = /^\d*\.?\d*$/;

const lineSchema = z.object({
  itemId: z.string().min(1, "Select an item."),
  requestedQuantity: z
    .string()
    .min(1, "Enter a quantity greater than zero.")
    .refine((v) => DECIMAL.test(v.trim()) && Number(v) > 0, "Enter a quantity greater than zero."),
});

export const requisitionFormSchema = z.object({
  projectId: z.string().min(1, "Select a project."),
  costCentreId: z.string().min(1, "Select a cost centre."),
  purposeId: z.string().min(1, "Select a purpose."),
  fromGodownId: z.string().default(""),
  requiredDate: z
    .string()
    .min(1, "Enter the required date.")
    .refine((v) => {
      try {
        parseDate(v);
        return true;
      } catch {
        return false;
      }
    }, "Enter a valid date."),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  narration: z.string().default(""),
  lines: z.array(lineSchema).min(1, "Add at least one material line."),
});

export type RequisitionFormValues = z.infer<typeof requisitionFormSchema>;

export const emptyRequisitionForm: RequisitionFormValues = {
  projectId: "",
  costCentreId: "",
  purposeId: "",
  fromGodownId: "",
  requiredDate: "",
  priority: "NORMAL",
  narration: "",
  lines: [{ itemId: "", requestedQuantity: "" }],
};

/** `DD/MM/YYYY` → the API's `YYYY-MM-DD`. */
function uiDateToApi(value: string): string {
  const d = parseDate(value);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Build the create/patch payload from validated form values. */
export function formToWriteInput(v: RequisitionFormValues): RequisitionWriteInput {
  return {
    projectId: v.projectId,
    costCentreId: v.costCentreId,
    purposeId: v.purposeId,
    fromGodownId: v.fromGodownId || null,
    requiredDate: uiDateToApi(v.requiredDate),
    priority: v.priority,
    narration: v.narration.trim() || null,
    lines: v.lines.map((l) => ({ itemId: l.itemId, requestedQuantity: l.requestedQuantity })),
  };
}

/**
 * Map a module error code to its exact spec §8 copy. `field`-scoped errors are surfaced
 * inline at the offending control; the rest render as a top-of-form banner. Returns a
 * `{ field?, message }` the form uses to place the message.
 */
export function mapRequisitionError(code: string): { field?: keyof RequisitionFormValues | "lines"; message: string } {
  switch (code) {
    case "CROSS_PROJECT_DIMENSION":
      return { field: "purposeId", message: "This purpose doesn't belong to the selected project." };
    case "GODOWN_NOT_IN_PROJECT":
      return { field: "fromGodownId", message: "This godown doesn't belong to the selected project." };
    case "INACTIVE_MASTER_REFERENCE":
      return { field: "lines", message: "This item is inactive." };
    case "PROJECT_CLOSED":
      return { message: "This project is closed and can't accept new requisitions." };
    case "VOUCHER_POSTED_IMMUTABLE":
      return { message: "This requisition has been submitted and can't be edited here." };
    case "INVALID_REQUISITION_TRANSITION":
      return { message: "This requisition can no longer be submitted." };
    case "OPTIMISTIC_LOCK_CONFLICT":
      return { message: "This requisition was just changed by someone else. Reload and try again." };
    case "VALIDATION_ERROR":
      return { message: "Couldn't save this requisition. Please check the highlighted fields." };
    default:
      return { message: "Couldn't save this requisition. Please try again." };
  }
}
