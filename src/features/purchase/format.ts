import { formatMoney, type DecimalInput } from "@/lib/money";

/**
 * Purchase display-money formatter. Values are Decimal(18,4) end-to-end; for DISPLAY the
 * purchase design files (08-purchase/*.dc.html) render money to 2 decimals — matching the
 * app-wide table convention (sales-ipc / hr register tables). Underlying precision is never
 * lost; this only controls the rendered scale. Mirrors `IpcList`'s `money()` helper.
 */
export function money(value: DecimalInput): string {
  return formatMoney(value, { withSymbol: false, fractionDigits: 2 });
}

/** Purchase display-money WITH the ৳ symbol, 2 decimals (totals cards, mobile card amounts). */
export function moneyWithSymbol(value: DecimalInput): string {
  return formatMoney(value, { fractionDigits: 2 });
}
