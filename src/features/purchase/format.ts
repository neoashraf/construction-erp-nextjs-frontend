import { formatMoney, type DecimalInput } from "@/lib/money";

/**
 * Purchase display-money formatter. Values are Decimal(18,4) end-to-end; for DISPLAY the
 * purchase design files (08-purchase/*.dc.html) render money to 2 decimals with Bangladeshi
 * lakh grouping (`35,40,000.00`) — see the `grp()` helper in those files. Underlying precision
 * is never lost; this only controls the rendered scale. Mirrors `IpcList`'s `money()` helper.
 */
export function money(value: DecimalInput): string {
  return formatMoney(value, { withSymbol: false, fractionDigits: 2, grouping: "lakh" });
}

/** Purchase display-money WITH the ৳ symbol, 2 decimals, lakh grouping (totals, mobile cards). */
export function moneyWithSymbol(value: DecimalInput): string {
  return formatMoney(value, { fractionDigits: 2, grouping: "lakh" });
}

/**
 * Purchase display-quantity — Decimal(18,3), rendered to 3 decimals (lakh-grouped, no symbol)
 * to match the design's `40.000` ordered-quantity rendering. Underlying precision is unchanged.
 */
export function qty(value: DecimalInput): string {
  return formatMoney(value, { withSymbol: false, fractionDigits: 3, grouping: "lakh" });
}
