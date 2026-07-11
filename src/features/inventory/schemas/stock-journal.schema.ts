import { z } from "zod";
import { type StockJournalMode } from "../types";
import { type StockJournalWriteInput } from "../api/stock-journal";

/**
 * Stock Journal editor schema (spec §7). A voucher form. TRANSFER carries OUT + IN sides
 * (four dimensions each, source ≠ destination); ISSUE / ADJUSTMENT carry the single OUT
 * side. Every message is the exact spec §8 copy. `rate`/`value` are NOT in the form —
 * they are server-computed at post (FR-INV-003). Purpose supports inline-create (handled
 * in the field component, not here).
 */

export const STOCK_JOURNAL_MODES = ["TRANSFER", "ISSUE", "ADJUSTMENT"] as const;
export const MODE_LABEL: Record<StockJournalMode, string> = {
  TRANSFER: "Transfer",
  ISSUE: "Issue",
  ADJUSTMENT: "Adjustment",
};

const dim = z.string().default("");

export const stockJournalSchema = z
  .object({
    mode: z.enum(STOCK_JOURNAL_MODES),
    voucherDate: z.string().min(1, "Enter a voucher date."),
    itemId: z.string().min(1, "Select an item."),
    quantity: z.string().min(1, "Enter a quantity greater than zero."),
    issuedById: dim,
    receivedById: dim,
    narration: dim,
    outGodownId: dim,
    outProjectId: dim,
    outCostCentreId: dim,
    outPurposeId: dim,
    inGodownId: dim,
    inProjectId: dim,
    inCostCentreId: dim,
    inPurposeId: dim,
  })
  .superRefine((v, ctx) => {
    const n = Number(v.quantity);
    if (v.quantity && (!Number.isFinite(n) || n <= 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["quantity"], message: "Enter a quantity greater than zero." });
    }
    // OUT side — always required (the source / single side).
    const outSideLabel = v.mode === "TRANSFER" ? "the source" : "this side";
    if (!v.outGodownId)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["outGodownId"], message: v.mode === "TRANSFER" ? "Select a source godown." : "Select a godown." });
    if (!v.outProjectId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["outProjectId"], message: `Select a project for ${outSideLabel}.` });
    if (!v.outCostCentreId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["outCostCentreId"], message: `Select a cost centre for ${outSideLabel}.` });
    if (!v.outPurposeId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["outPurposeId"], message: `Select or create a purpose for ${outSideLabel}.` });
    // IN side — TRANSFER only.
    if (v.mode === "TRANSFER") {
      if (!v.inGodownId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["inGodownId"], message: "Select a destination godown." });
      if (!v.inProjectId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["inProjectId"], message: "Select a project for the destination." });
      if (!v.inCostCentreId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["inCostCentreId"], message: "Select a cost centre for the destination." });
      if (!v.inPurposeId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["inPurposeId"], message: "Select or create a purpose for the destination." });
      if (v.outGodownId && v.inGodownId && v.outGodownId === v.inGodownId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["inGodownId"], message: "Source and destination can't be the same godown." });
      }
    }
  });

export type StockJournalFormValues = z.infer<typeof stockJournalSchema>;

export function emptyStockJournalForm(mode: StockJournalMode = "TRANSFER", voucherDate = ""): StockJournalFormValues {
  return {
    mode,
    voucherDate,
    itemId: "",
    quantity: "",
    issuedById: "",
    receivedById: "",
    narration: "",
    outGodownId: "",
    outProjectId: "",
    outCostCentreId: "",
    outPurposeId: "",
    inGodownId: "",
    inProjectId: "",
    inCostCentreId: "",
    inPurposeId: "",
  };
}

/** Build the API write payload (per-side `lines[]`) from the form (§5.1 four-dim matrix). */
export function formToWriteInput(v: StockJournalFormValues): StockJournalWriteInput {
  const lines: StockJournalWriteInput["lines"] = [
    { side: "OUT", godownId: v.outGodownId || "", projectId: v.outProjectId || "", costCentreId: v.outCostCentreId || "", purposeId: v.outPurposeId || "" },
  ];
  if (v.mode === "TRANSFER") {
    lines.push({ side: "IN", godownId: v.inGodownId || "", projectId: v.inProjectId || "", costCentreId: v.inCostCentreId || "", purposeId: v.inPurposeId || "" });
  }
  return {
    voucherDate: v.voucherDate,
    mode: v.mode,
    itemId: v.itemId,
    quantity: v.quantity,
    issuedById: v.issuedById || null,
    receivedById: v.receivedById || null,
    narration: v.narration || null,
    lines,
  };
}

/** Reverse-confirm reason (spec §8) — required by the API. */
export const reverseReasonSchema = z.object({
  reason: z.string().trim().min(1, "Enter a reason for reversing this Stock Journal."),
});

/** Negative-stock override (post-time dialog, §7) — reason required when allowing. */
export const negativeStockSchema = z.object({
  reason: z.string().trim().min(1, "Enter a reason for allowing negative stock."),
});

/** Map a module error code → the exact spec §8 message. Falls back to a generic save error. */
export function mapStockJournalError(code: string | undefined, ctx?: { itemName?: string; godownName?: string; onHand?: string }): string {
  switch (code) {
    case "SAME_GODOWN_TRANSFER":
      return "Source and destination can't be the same godown.";
    case "STOCK_JOURNAL_NOT_APPROVED":
      return "This Stock Journal must be approved before it can be posted.";
    case "VOUCHER_POSTED_IMMUTABLE":
      return "Posted Stock Journals can't be edited. To correct this, reverse it and create a new one.";
    case "PERIOD_CLOSED":
      return "This date falls in a closed accounting period. Choose a date in an open period.";
    case "PROJECT_CLOSED":
      return "This project is closed. Stock Journals can't be posted against it.";
    case "ALREADY_REVERSED":
      return "This Stock Journal has already been reversed.";
    case "OPTIMISTIC_LOCK_CONFLICT":
      return "This Stock Journal was updated elsewhere. Reload to see the latest version.";
    case "NEGATIVE_STOCK_BLOCKED":
      return `This would take ${ctx?.itemName ?? "this item"} at ${ctx?.godownName ?? "this godown"} below zero. You don't have authorisation to allow negative stock.`;
    case "MISSING_REQUIRED_DIMENSION":
      return "A required dimension (project, cost centre, purpose, or godown) is missing on one side.";
    case "CROSS_PROJECT_DIMENSION":
      return "This purpose or godown belongs to a different project.";
    case "INVALID_STOCK_JOURNAL_TRANSITION":
      return "This Stock Journal can't move to that state.";
    case "FORBIDDEN":
      return "You don't have access to this Stock Journal.";
    default:
      return "Couldn't save this Stock Journal.";
  }
}
