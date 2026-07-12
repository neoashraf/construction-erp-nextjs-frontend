import { z } from "zod";
import { toDecimal } from "@/lib/money";

/**
 * Requisition-issue validation + error copy (spec §7/§8; FR-REQ-012…-020). The issue itself
 * writes NO debit/credit logic here — INV `issueOut` + LED `PostingService` post the consumption
 * server-side inside the atomic `…/issue` transaction. This module validates the client capture
 * (per-line quantity within balance, the mandatory reasons) and maps every module error code to
 * its exact spec §8 message. Rates/values are server-computed and never validated here.
 */

const DECIMAL = /^\d*\.?\d*$/;

/** Mandatory close reason (FR-REQ-020; empty → the inline required message). */
export const closeReasonSchema = z.object({
  reason: z.string().trim().min(1, "Enter a reason for closing this requisition."),
});

/** Mandatory reverse reason (FR-REQ-017). */
export const reverseReasonSchema = z.object({
  reason: z.string().trim().min(1, "Enter a reason for reversing this issue."),
});

/** Mandatory negative-stock override reason (FR-REQ-016), required only when overriding. */
export const negativeStockReasonSchema = z.object({
  reason: z.string().trim().min(1, "Enter a reason for issuing beyond on-hand stock."),
});

/**
 * Validate a single line's issue quantity against its balance (edge 2; `ISSUE_EXCEEDS_BALANCE`).
 * Returns the inline error message, or `null` when valid. An empty/zero quantity is **not** an
 * error here — such a line is simply skipped from the issue (spec §7); callers filter those out.
 */
export function validateIssueQuantity(qty: string, balance: string): string | null {
  const raw = qty.trim();
  if (raw === "" || !DECIMAL.test(raw)) return "Enter a quantity greater than zero.";
  const q = toDecimal(raw);
  if (q.lte(0)) return "Enter a quantity greater than zero.";
  if (q.gt(toDecimal(balance))) return `This exceeds the outstanding balance (${balance}).`;
  return null;
}

/** True when a line carries a positive quantity (i.e. it participates in this issue). */
export function isIssuable(qty: string): boolean {
  const raw = qty.trim();
  return raw !== "" && DECIMAL.test(raw) && toDecimal(raw).gt(0);
}

/**
 * Map an issue/close/reverse error code to its exact spec §8 copy. Some carry context — the
 * over-balance message names the fresh balance (edge 8 concurrency). `field`/`scope` tell the
 * caller where to surface it: a per-line quantity error, a reason-field error, or the top banner.
 */
export function mapIssueError(
  code: string,
  ctx?: { balance?: string },
): { message: string; scope: "line" | "reason" | "banner"; refresh?: boolean } {
  switch (code) {
    case "ISSUE_EXCEEDS_BALANCE":
      return {
        message: ctx?.balance
          ? `This exceeds the outstanding balance (${ctx.balance}).`
          : "This exceeds the outstanding balance.",
        scope: "line",
        refresh: true,
      };
    case "GODOWN_NOT_IN_PROJECT":
      return { message: "This godown doesn't belong to the requisition's project.", scope: "line" };
    case "NEGATIVE_STOCK_BLOCKED":
      return { message: "Not enough stock on hand.", scope: "line" };
    case "INACTIVE_MASTER_REFERENCE":
      return { message: "This item or godown is no longer active.", scope: "line" };
    case "MISSING_REJECT_REASON":
      return { message: "Enter a reason for issuing beyond on-hand stock.", scope: "reason" };
    case "PERIOD_CLOSED":
      return { message: "This accounting period is closed.", scope: "banner" };
    case "PROJECT_CLOSED":
      return { message: "This project is closed.", scope: "banner" };
    case "REQUISITION_NOT_APPROVED":
      return {
        message: "This requisition can no longer be issued.",
        scope: "banner",
        refresh: true,
      };
    case "NO_OUTSTANDING_BALANCE":
      return {
        message: "There's no outstanding balance left to close.",
        scope: "banner",
        refresh: true,
      };
    case "ALREADY_REVERSED":
      return { message: "This issue has already been reversed.", scope: "banner", refresh: true };
    case "OPTIMISTIC_LOCK_CONFLICT":
      return {
        message: "This requisition was just changed by someone else. Refresh and try again.",
        scope: "banner",
        refresh: true,
      };
    default:
      return { message: "Couldn't complete the issue. Please try again.", scope: "banner" };
  }
}
