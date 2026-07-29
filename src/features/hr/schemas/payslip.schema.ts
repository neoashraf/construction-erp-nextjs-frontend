import { z } from "zod";

/**
 * Payslip zod schema (spec §5; API contract 12 § "Salary" — `GET …/sheets/:id/payslips`).
 * Money is a JSON string (`Decimal(18,4)`) preserved end-to-end — never coerced to number.
 * The screen is read-only so this schema is only used to validate the API response shape;
 * no form uses it. `designation` may be `null` (partial state, spec §6/§13).
 */

const money = () => z.string().min(1, "Missing amount.");
const nonNegDays = () => z.string().min(1, "Missing paid days.");

export const payslipDeductionsSchema = z.object({
  tds: money(),
  pf: money(),
  advanceRecovery: money(),
  other: money(),
});
export type PayslipDeductions = z.infer<typeof payslipDeductionsSchema>;

export const payslipSchema = z.object({
  employeeId: z.string().min(1),
  employeeCode: z.string().min(1),
  name: z.string().min(1),
  designation: z.string().nullable(),
  periodLabel: z.string().min(1),
  paidDays: nonNegDays(),
  // FR-HR-013a day/penalty fields — ALL tolerant of absence so a run posted before the
  // rule parses without error (absent ≠ nil; the document omits the penalty line).
  wageType: z.enum(["MONTHLY", "DAILY"]).nullish(),
  standardDays: z.string().nullish(),
  unpaidDays: z.string().nullish(),
  lateCount: z.number().nullish(),
  latePenaltyDays: z.string().nullish(),
  latePenaltyAmount: z.string().nullish(),
  grossAmount: money(),
  allowances: money(),
  deductions: payslipDeductionsSchema,
  netAmount: money(),
});
export type PayslipSchemaShape = z.infer<typeof payslipSchema>;

export const payslipListSchema = z.array(payslipSchema);

/** Exact document labels from spec §8 — imported by the document renderer + tests. */
export const PAYSLIP_LABELS = {
  earnings: "Earnings",
  grossSalary: "Gross salary",
  allowances: "Allowances",
  deductions: "Deductions",
  tds: "TDS",
  pf: "Provident Fund (PF)",
  advanceRecovery: "Advance recovery",
  otherDeductions: "Other deductions",
  netPay: "Net pay",
  paidDaysLabel: "Paid days",
} as const;

// ── FR-HR-013a — late-penalty presentation (spec §8; decision record §8.3) ──

import type { Payslip } from "../api/salary";

/** `latePenaltyDays > 0` — the ONLY condition the penalty line renders on. A lateCount
 *  below the divisor produced no deduction, so nothing is explained (never a ৳0 row);
 *  absent stored fields (pre-FR-HR-013a run) are absent, not nil. */
export function hasLatePenalty(p: Pick<Payslip, "latePenaltyDays">): boolean {
  return p.latePenaltyDays != null && Number(p.latePenaltyDays) > 0;
}

/** `"Late penalty (7 lates → 2 days)"` with singular forms where they apply. */
export function latePenaltyLabel(lateCount: number, latePenaltyDays: string): string {
  const days = Math.trunc(Number(latePenaltyDays));
  return `Late penalty (${lateCount} late${lateCount === 1 ? "" : "s"} → ${days} day${days === 1 ? "" : "s"})`;
}

/** The red helper sub-line inside the penalty row. */
export function latePenaltyHelper(latesPerDeductedDay: number): string {
  return `Every ${latesPerDeductedDay} lates cost one day of pay — taken off gross, not from paid days.`;
}

/** The always-present pay-rule footnote (footer, above the system-generated line).
 *  Interpolates the CURRENT divisor — a known, accepted defect for historical reprints. */
export function payRuleFootnote(latesPerDeductedDay: number): string {
  return `Monthly pay covers the full month, including weekly and government holidays. Absences, unpaid leave, and days with no attendance record are deducted; every ${latesPerDeductedDay} late days cost one day's pay.`;
}

/** `"{paid} of {standard} — {unpaid} unpaid"` — rendered only when unpaidDays > 0. */
export function paidDaysSubLine(p: Pick<Payslip, "paidDays" | "standardDays" | "unpaidDays">): string | null {
  if (p.standardDays == null || p.unpaidDays == null) return null;
  const unpaid = Number(p.unpaidDays);
  if (!(unpaid > 0)) return null;
  const fmt = (v: string) => String(Number(v));
  return `${fmt(p.paidDays)} of ${fmt(p.standardDays)} — ${fmt(p.unpaidDays)} unpaid`;
}

/** List `Late` cell — `"{lateCount} → {days}d"`, `"—"` at zero/absent. */
export function listLateCell(p: Pick<Payslip, "lateCount" | "latePenaltyDays">): string {
  if (!p.lateCount) return "—";
  const days = Math.trunc(Number(p.latePenaltyDays ?? 0));
  return `${p.lateCount} → ${days}d`;
}

/** List rule note under the header (comp; interpolates the company divisor). */
export function listLateRuleNote(latesPerDeductedDay: number): string {
  return `Late reads lates → days deducted. Every ${latesPerDeductedDay} late days cost one day of pay. The cost reduces gross — it is not a deduction — and paid days stays at the full month.`;
}

/** Microcopy strings (spec §8) — imported by the screen + tests to prevent copy drift. */
export const PAYSLIP_COPY = {
  emptyNoRun: "No payslips available for this run yet.",
  emptyNoRunSub: "Payslips are generated once the salary sheet is posted.",
  emptyFiltered: "No employees match this search.",
  clearSearch: "Clear search",
  notPosted: "Payslips aren't available until this salary sheet is posted.",
  backToSheet: "Back to salary sheet",
  searchPlaceholder: "Search by employee name or code",
  errorLoad: "Couldn't load payslips.",
  errorPrint: "Couldn't prepare this document. Please try again.",
  forbidden: "You don't have permission to view payslips.",
  offline: "You're offline — showing the last loaded payslips.",
  reversedBanner:
    "This salary run has been reversed. These figures reflect the original posting, not a corrected one.",
} as const;
