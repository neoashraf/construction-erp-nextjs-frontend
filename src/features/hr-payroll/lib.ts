/**
 * Small HR-payroll display helpers shared across the screens — kept out of the
 * components so the list, detail, and card views resolve fields identically
 * (mirrors `master-data`'s per-feature helpers).
 */

import { formatMoney } from "@/lib/money";
import { type Employee, type WageType } from "./types";

/** A `FAIL:*` project sentinel models a project whose name couldn't be resolved. */
export function projectResolves(id: string | null | undefined): boolean {
  return !!id && !id.startsWith("FAIL:");
}

/** Resolve a default-project id to its display text; `null` → "Unassigned". */
export function projectText(id: string | null | undefined): string {
  if (!id) return "Unassigned";
  if (id.startsWith("FAIL:")) return id.slice("FAIL:".length);
  return id;
}

/** The wage-amount sub-label follows the wage type (design + FR-HR-001). */
export function wageAmountSubLabel(wageType: WageType): string {
  return wageType === "MONTHLY" ? "per month" : "per day";
}

/** The wage-amount field label follows the wage type. */
export function wageAmountLabel(wageType: WageType): string {
  return wageType === "MONTHLY" ? "Monthly salary" : "Daily rate";
}

/** Money formatted with the ৳ sign and Bangladeshi grouping, 2-dp for display. */
export function displayMoney(value: string): string {
  return formatMoney(value, { fractionDigits: 2 });
}

/** Bare money (no ৳ sign), 2-dp — for cells that render the sign separately. */
export function displayMoneyBare(value: string): string {
  return formatMoney(value, { withSymbol: false, fractionDigits: 2 });
}

export const WORK_BASE_LABEL: Record<Employee["workBase"], string> = {
  HEAD_OFFICE: "Head office",
  SITE: "Site",
};

export const WAGE_TYPE_LABEL: Record<WageType, string> = {
  MONTHLY: "Monthly",
  DAILY: "Daily",
};
