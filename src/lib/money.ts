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
  return new Decimal(value);
}

/** Group the integer part with thousands separators, keep the (already-fixed) fraction. */
function groupThousands(fixed: string): string {
  const negative = fixed.startsWith("-");
  const unsigned = negative ? fixed.slice(1) : fixed;
  const [intPart, fracPart] = unsigned.split(".");
  const grouped = (intPart ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = fracPart !== undefined ? `${grouped}.${fracPart}` : grouped;
  return negative ? `-${body}` : body;
}

export interface FormatMoneyOptions {
  /** Render the `৳` sign (default true). */
  withSymbol?: boolean;
  /** Override the displayed fraction digits (default = MONEY_SCALE = 4). */
  fractionDigits?: number;
}

/**
 * Format a `Decimal(18,4)` money value for display: `৳ 1,234,567.8900`.
 * Rounds to the requested scale with ROUND_HALF_UP — exactly, no float.
 */
export function formatMoney(value: DecimalInput, options: FormatMoneyOptions = {}): string {
  const { withSymbol = true, fractionDigits = MONEY_SCALE } = options;
  const fixed = toDecimal(value).toFixed(fractionDigits, Decimal.ROUND_HALF_UP);
  const grouped = groupThousands(fixed);
  return withSymbol ? `${TAKA} ${grouped}` : grouped;
}

/**
 * Format a `Decimal(18,3)` quantity for display: `1,234.500`. No currency sign.
 */
export function formatQty(value: DecimalInput, fractionDigits = QTY_SCALE): string {
  const fixed = toDecimal(value).toFixed(fractionDigits, Decimal.ROUND_HALF_UP);
  return groupThousands(fixed);
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
