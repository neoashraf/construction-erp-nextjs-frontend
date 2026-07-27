import Decimal from "decimal.js";

/**
 * Exact-decimal money + quantity helpers (CLAUDE.md "exact money", ADR-0003
 * constants, skill §8). Money is `Decimal(18,4)`, quantity is `Decimal(18,3)`.
 *
 * NEVER use JS `number`/`parseFloat`/`toFixed` for money — every value the API
 * documents as a decimal is transported as a string and handled via decimal.js.
 */

// Bangladeshi Taka sign.
export const TAKA = "৳";

export const MONEY_SCALE = 4; // Decimal(18,4)
export const QTY_SCALE = 3; // Decimal(18,3)

/** A value that can be coerced to a Decimal without going through JS float. */
export type DecimalInput = Decimal | string | number;

// decimal.js: round half-up (banker's rounding is not the BD convention here),
// and a generous precision so 18-digit values never lose information.
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

/**
 * Coerce input to a Decimal. Numbers are accepted only for small integer-ish
 * literals (counts) — for money ALWAYS pass a string to avoid float ingress.
 */
export function toDecimal(value: DecimalInput): Decimal {
  if (value instanceof Decimal) return value;
  if (value === null || value === undefined || value === "") {
    // decimal.js throws a bare "[DecimalError] Invalid argument: undefined" with no hint
    // as to WHICH field was missing — during a render that takes the whole page down.
    // Name the problem instead; callers that can legitimately be empty use formatMoneyOr.
    throw new Error(`Not a valid money amount: ${JSON.stringify(value)}`);
  }
  return new Decimal(value);
}

/**
 * Format a money value that MAY be absent (a field the API omits, an optional total),
 * rendering `fallback` instead of throwing. Use this at display sites that can tolerate
 * a gap; keep `formatMoney` where a missing amount is a real contract violation.
 */
export function formatMoneyOr(
  value: DecimalInput | null | undefined,
  fallback = "—",
  options: FormatMoneyOptions = {},
): string {
  if (value === null || value === undefined || value === "") return fallback;
  try {
    return formatMoney(value, options);
  } catch {
    return fallback;
  }
}

/**
 * Digit-grouping style for the integer part.
 * - `western` — groups of three: `1,234,567` (default; the app-wide convention).
 * - `lakh` — Bangladeshi/Indian numbering: `12,34,567` (last three, then twos).
 *   Used where a screen's design file renders lakh grouping (e.g. the dashboard KPIs).
 */
export type MoneyGrouping = "western" | "lakh";

/** Group the integer part with separators, keep the (already-fixed) fraction. */
function groupInteger(fixed: string, grouping: MoneyGrouping): string {
  const negative = fixed.startsWith("-");
  const unsigned = negative ? fixed.slice(1) : fixed;
  const [intPart, fracPart] = unsigned.split(".");
  const digits = intPart ?? "0";
  const grouped = grouping === "lakh" ? groupLakh(digits) : digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = fracPart !== undefined ? `${grouped}.${fracPart}` : grouped;
  return negative ? `-${body}` : body;
}

/** Bangladeshi/Indian grouping of an unsigned integer string: last three, then twos. */
function groupLakh(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

export interface FormatMoneyOptions {
  /** Render the `৳` sign (default true). */
  withSymbol?: boolean;
  /** Override the displayed fraction digits (default = MONEY_SCALE = 4). */
  fractionDigits?: number;
  /** Integer digit grouping (default `western`; `lakh` for BD-numbering screens). */
  grouping?: MoneyGrouping;
}

/**
 * Format a `Decimal(18,4)` money value for display: `৳ 1,234,567.8900`.
 * Rounds to the requested scale with ROUND_HALF_UP — exactly, no float.
 */
export function formatMoney(value: DecimalInput, options: FormatMoneyOptions = {}): string {
  const { withSymbol = true, fractionDigits = MONEY_SCALE, grouping = "western" } = options;
  const fixed = toDecimal(value).toFixed(fractionDigits, Decimal.ROUND_HALF_UP);
  const grouped = groupInteger(fixed, grouping);
  return withSymbol ? `${TAKA} ${grouped}` : grouped;
}

/**
 * Format a `Decimal(18,3)` quantity for display: `1,234.500`. No currency sign.
 */
export function formatQty(value: DecimalInput, fractionDigits = QTY_SCALE): string {
  const fixed = toDecimal(value).toFixed(fractionDigits, Decimal.ROUND_HALF_UP);
  return groupInteger(fixed, "western");
}

/**
 * Parse a user-entered money string ("1,234.56", "৳ 1,234.5600") into a Decimal,
 * normalised to MONEY_SCALE. Throws on non-numeric input. No float ever touches it.
 */
export function parseMoney(input: string): Decimal {
  const cleaned = input.replace(new RegExp(`[${TAKA},\\s]`, "g"), "").trim();
  if (cleaned === "" || !/^-?\d*\.?\d*$/.test(cleaned) || cleaned === "." || cleaned === "-") {
    throw new Error(`Not a valid money amount: "${input}"`);
  }
  return new Decimal(cleaned).toDecimalPlaces(MONEY_SCALE, Decimal.ROUND_HALF_UP);
}

/** Parse a quantity string, normalised to QTY_SCALE. */
export function parseQty(input: string): Decimal {
  const cleaned = input.replace(/[,\s]/g, "").trim();
  if (cleaned === "" || !/^-?\d*\.?\d*$/.test(cleaned) || cleaned === "." || cleaned === "-") {
    throw new Error(`Not a valid quantity: "${input}"`);
  }
  return new Decimal(cleaned).toDecimalPlaces(QTY_SCALE, Decimal.ROUND_HALF_UP);
}

/** True when the value is a valid, non-negative money amount. */
export function isNonNegativeMoney(value: DecimalInput): boolean {
  try {
    return toDecimal(value).greaterThanOrEqualTo(0);
  } catch {
    return false;
  }
}

const WORDS_ONES = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const WORDS_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function twoDigitWords(v: number): string {
  if (v === 0) return "";
  if (v < 20) return WORDS_ONES[v]!;
  const t = Math.floor(v / 10);
  const o = v % 10;
  return o === 0 ? WORDS_TENS[t]! : `${WORDS_TENS[t]}-${WORDS_ONES[o]}`;
}

function threeDigitWords(v: number): string {
  const h = Math.floor(v / 100);
  const rest = v % 100;
  const parts: string[] = [];
  if (h > 0) parts.push(`${WORDS_ONES[h]} hundred`);
  if (rest > 0) parts.push(twoDigitWords(rest));
  return parts.join(" ");
}

/**
 * A minimal amount-in-words helper (Indian numbering: lakh/crore) for print/document
 * templates. Whole-taka only (fraction is dropped) — not a general-purpose i18n helper.
 */
export function amountInWords(amount: DecimalInput): string {
  const n = toDecimal(amount).floor().toNumber();
  if (!Number.isFinite(n) || n <= 0) return "zero";
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${threeDigitWords(crore)} crore`);
  if (lakh) parts.push(`${twoDigitWords(lakh)} lakh`);
  if (thousand) parts.push(`${twoDigitWords(thousand)} thousand`);
  if (rest) parts.push(threeDigitWords(rest));
  return parts.join(" ").trim();
}
