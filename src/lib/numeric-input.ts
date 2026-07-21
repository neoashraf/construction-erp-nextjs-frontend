/**
 * Keystroke-level numeric input filtering (shared by the `NumericInput` and
 * `MoneyInput` primitives). This is the "digits only" enforcement layer: it
 * decides, given the value that WOULD result from an edit, whether that edit is
 * allowed to land in the field at all.
 *
 * Why this and not `type="number"` or `onChange` stripping:
 * - `type="number"` still admits `e`/`E`/`+`/`-`/scientific notation, hijacks the
 *   scroll wheel, and its `.value` is browser-normalised — unreliable for the
 *   string-valued form layer this app uses (RHF `register`, `parseMoney`, …).
 * - `onChange` string-stripping runs AFTER React has moved the caret, so it fights
 *   the cursor and mangles mid-string edits, paste, and IME composition.
 *
 * Instead we validate the *prospective* value on the native `beforeinput` event
 * (see `useNumericGuard`) and cancel the event when it would be non-numeric. The
 * caret, selection, paste, and undo stack are all left untouched by the browser.
 * Values never become JS numbers here — everything stays a string.
 */

export type NumericMode = "integer" | "decimal";

export interface NumericConstraints {
  /** `integer` = digits only; `decimal` = digits + a single decimal point. */
  mode?: NumericMode;
  /** Max fraction digits after the point (decimal mode only). Default: unlimited. */
  decimalPlaces?: number;
  /** Allow a leading minus sign. Default: false (most ERP fields are non-negative). */
  allowNegative?: boolean;
  /**
   * Tolerate thousands separators / currency framing in the *typed or pasted* value
   * (e.g. money fields where a user pastes `৳ 1,234.56`). These characters are
   * ignored when judging validity — they don't count toward the decimal-place cap —
   * so the parse layer (`parseMoney`) can strip them. Default: none.
   */
  allowGrouping?: boolean;
}

/** Characters money fields tolerate as framing: comma, space, ৳. Stripped before checks. */
const GROUPING_CHARS = /[,\s৳]/g;

/**
 * Is `next` a valid *intermediate* value for a field with these constraints?
 *
 * Intermediate is the operative word: a user mid-type is allowed to sit on `""`,
 * `"-"`, `"12."` or `"."` — states that are not yet a complete number but are on
 * the path to one. Final-form validation (non-empty, range, scale) stays the job
 * of Zod at submit; this only stops characters that could never belong.
 */
export function isAllowedNumericValue(next: string, c: NumericConstraints = {}): boolean {
  const { mode = "decimal", decimalPlaces, allowNegative = false, allowGrouping = false } = c;

  // Money-style fields accept grouping/currency framing on paste; drop it before
  // judging the numeric shape so `1,234.56` (and `৳ 1,234.56`) are permitted.
  if (allowGrouping) next = next.replace(GROUPING_CHARS, "");

  // Empty is always a legal intermediate (the user cleared the field).
  if (next === "") return true;

  const sign = allowNegative ? "-?" : "";

  if (mode === "integer") {
    // Optional sign, then any run of digits. A lone "-" is allowed while typing.
    return new RegExp(`^${sign}\\d*$`).test(next);
  }

  // decimal: optional sign, digits, at most one dot, then digits.
  if (!new RegExp(`^${sign}\\d*\\.?\\d*$`).test(next)) return false;

  if (decimalPlaces != null) {
    const dot = next.indexOf(".");
    if (dot !== -1 && next.length - dot - 1 > decimalPlaces) return false;
  }
  return true;
}

/**
 * Compute the value an input would hold if the pending `beforeinput` were applied:
 * replace the current selection `[start, end)` with `inserted`. `inserted` is `""`
 * for deletions. This lets us judge paste, typing, and delete uniformly before the
 * browser commits them.
 */
export function applyEdit(
  current: string,
  start: number,
  end: number,
  inserted: string,
): string {
  return current.slice(0, start) + inserted + current.slice(end);
}
