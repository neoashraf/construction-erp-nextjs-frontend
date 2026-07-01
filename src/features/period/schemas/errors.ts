import { type ApiError } from "@/lib/api/errors";

/**
 * Server-error -> exact UI copy mapping for the Period manager (screen spec §8).
 * Every string here is verbatim from the spec so the UI reads identically to the
 * design. `PERIOD_FY_LOCKED` is surfaced distinctly from `403 FORBIDDEN` — it is
 * the year-locked-state rejection on reopen (API contract 04, SRS §16).
 */

export const MESSAGES = {
  listLoadFailed: "Couldn't load periods.",
  financialYearNotFound: "This financial year wasn't found.",
  periodsAlreadyExist: "Periods already exist for this financial year.",
  generateFyBoundsInvalid:
    "This financial year's dates are invalid. Fix them in the financial-year settings first.",
  /** The standalone FSM-violation strings (spec §8) — kept for direct reference/tests;
   * in the screen flow these codes are treated as the conflict-refresh case (§6)
   * since the buttons are hidden once status flips, so a live one only happens as a race. */
  periodAlreadyClosed: "This period is already closed.",
  periodAlreadyOpen: "This period is already open.",
  periodFyLocked:
    "This period's financial year is locked. Unlock the financial year before reopening this period.",
  noPeriodsForFy: "No periods have been generated for this financial year yet.",
  concurrentChange: "This period was just changed by someone else. The list has been refreshed.",
  forbidden: "You don't have permission to do that.",
  offline: "You're offline. Try again when you're back online.",
  selectFinancialYear: "Select a financial year.",
} as const;

/** True when a dialog action's error means "refresh the row, no other message needed" (spec §6). */
export function isConflictRefresh(code: string): boolean {
  return (
    code === "OPTIMISTIC_LOCK_CONFLICT" ||
    code === "PERIOD_ALREADY_CLOSED" ||
    code === "PERIOD_ALREADY_OPEN" ||
    code === "CONFLICT"
  );
}

/** True for the year-locked reopen rejection — distinct from FORBIDDEN (API contract 04). */
export function isFyLocked(code: string): boolean {
  return code === "PERIOD_FY_LOCKED";
}

/** Map the list-load error (`GET /api/periods`) to the banner copy (spec §6). */
export function mapListError(err: ApiError): string {
  switch (err.code) {
    case "FINANCIAL_YEAR_NOT_FOUND":
      return MESSAGES.financialYearNotFound;
    case "NETWORK_ERROR":
      return MESSAGES.offline;
    case "FORBIDDEN":
      return MESSAGES.forbidden;
    default:
      return MESSAGES.listLoadFailed;
  }
}

/**
 * Map a dialog-action error (generate / close / reopen / close-fy) to the exact
 * toast/inline-dialog message (spec §8). `PERIOD_ALREADY_CLOSED`/`PERIOD_ALREADY_OPEN`/
 * `OPTIMISTIC_LOCK_CONFLICT`/`CONFLICT` all read as the single conflict-refresh
 * banner (spec §6 confirm-dialog-conflict) since this screen only reaches those
 * codes via a race with another user — `isConflictRefresh` gates that behaviour
 * at the call site (close dialog + refetch); this map keeps the same text.
 * `PERIOD_FY_LOCKED` is surfaced distinctly (via `isFyLocked`) as an inline
 * dialog error rather than a toast, but the text is still sourced from here.
 */
export function mapActionError(err: ApiError): string {
  switch (err.code) {
    case "FINANCIAL_YEAR_NOT_FOUND":
      return MESSAGES.financialYearNotFound;
    case "PERIODS_ALREADY_EXIST":
      return MESSAGES.periodsAlreadyExist;
    case "VALIDATION_ERROR":
      return MESSAGES.generateFyBoundsInvalid;
    case "PERIOD_FY_LOCKED":
      return MESSAGES.periodFyLocked;
    case "NO_PERIODS_FOR_FY":
      return MESSAGES.noPeriodsForFy;
    case "PERIOD_ALREADY_CLOSED":
    case "PERIOD_ALREADY_OPEN":
    case "OPTIMISTIC_LOCK_CONFLICT":
    case "CONFLICT":
      return MESSAGES.concurrentChange;
    case "FORBIDDEN":
      return MESSAGES.forbidden;
    case "NETWORK_ERROR":
      return MESSAGES.offline;
    default:
      return err.message || "Something went wrong. Try again.";
  }
}
