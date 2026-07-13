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
