import { z } from "zod";

/**
 * Salary schemas + error-code → spec §8 microcopy map (FR-HR-013..-018). Every code from
 * API contract 12 § "Salary" maps here so the editor + dialogs share one message table.
 * Money is always a JSON string (`Decimal(18,4)`); percent is a JSON string in 0..100.
 */

const MONEY_RE = /^\d*\.?\d*$/;

const money = () =>
  z
    .string()
    .refine((v) => v !== "" && MONEY_RE.test(v) && Number(v) >= 0, "Enter an amount of ৳0 or more.");

const percent = () =>
  z
    .string()
    .refine(
      (v) => v !== "" && MONEY_RE.test(v) && Number(v) >= 0 && Number(v) <= 100,
      "TDS rate must be between 0 and 100.",
    );

// ── Generate dialog ──
export const generateSheetSchema = z
  .object({
    financialYearId: z.string().min(1, "Select a financial year."),
    periodLabel: z.string().trim().min(1, "Enter a period label."),
    periodStart: z.string().min(1, "Enter a start date."),
    periodEnd: z.string().min(1, "Enter an end date."),
    projectId: z.string().min(1, "Select a project."),
    purposeId: z.string().min(1, "Select a purpose."),
  })
  .refine((v) => v.periodEnd >= v.periodStart, {
    path: ["periodEnd"],
    message: "Period end can't be before period start.",
  });
export type GenerateSheetValues = z.infer<typeof generateSheetSchema>;

// ── Per-line editor (DRAFT) ──
export const lineEditSchema = z.object({
  allowances: money().optional(),
  tdsAmount: z
    .string()
    .refine((v) => v === "" || (MONEY_RE.test(v) && Number(v) >= 0), "TDS can't be negative.")
    .optional(),
  pfAmount: z
    .string()
    .refine((v) => v === "" || (MONEY_RE.test(v) && Number(v) >= 0), "PF can't be negative.")
    .optional(),
  advanceRecovery: z
    .string()
    .refine((v) => v === "" || (MONEY_RE.test(v) && Number(v) >= 0), "Advance recovery can't be negative.")
    .optional(),
  otherDeductions: z
    .string()
    .refine((v) => v === "" || (MONEY_RE.test(v) && Number(v) >= 0), "Other deductions can't be negative.")
    .optional(),
});
export type LineEditValues = z.infer<typeof lineEditSchema>;

// ── Bulk-component panel ──
export const bulkComponentSchema = z
  .object({
    allowances: z
      .string()
      .refine((v) => v === "" || (MONEY_RE.test(v) && Number(v) >= 0), "Allowances can't be negative.")
      .optional(),
    tdsRate: z
      .string()
      .refine((v) => v === "" || (MONEY_RE.test(v) && Number(v) >= 0 && Number(v) <= 100), "TDS rate must be between 0 and 100.")
      .optional(),
    pfAmount: z
      .string()
      .refine((v) => v === "" || (MONEY_RE.test(v) && Number(v) >= 0), "PF can't be negative.")
      .optional(),
    advanceRecovery: z
      .string()
      .refine((v) => v === "" || (MONEY_RE.test(v) && Number(v) >= 0), "Advance recovery can't be negative.")
      .optional(),
    employeeIds: z.array(z.string()).nullable().optional(),
  })
  .refine(
    (v) =>
      !!(
        (v.allowances && v.allowances !== "") ||
        (v.tdsRate && v.tdsRate !== "") ||
        (v.pfAmount && v.pfAmount !== "") ||
        (v.advanceRecovery && v.advanceRecovery !== "")
      ),
    { message: "Enter at least one value to apply.", path: ["allowances"] },
  );
export type BulkComponentValues = z.infer<typeof bulkComponentSchema>;
// Also export the schemas so tests can import them:
export { percent, money };

// ── Reverse dialog ──
export const reverseSalarySchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Enter a reason for reversing this salary run."),
});
export type ReverseSalaryValues = z.infer<typeof reverseSalarySchema>;

/**
 * Map every API contract 12 § "Salary" code → the exact spec §8 microcopy. Callers pass
 * the raw ApiError code; unknown codes fall back to the server's own `message` (still more
 * actionable than a generic string — e.g. HR_ACCOUNT_NOT_CONFIGURED names the missing
 * account role) and only drop to `fallback` when there's no server message at all.
 */
export function mapSalaryError(
  code: string,
  fallback = "Something went wrong. Please try again.",
  serverMessage?: string | null,
): string {
  const M: Record<string, string> = {
    VALIDATION_ERROR: "Some fields need attention. Please check and try again.",
    DUPLICATE_DRAFT_SHEET:
      "A draft salary sheet already exists for this period. Edit it instead of generating a new one.",
    SALARY_NOT_DRAFT: "This salary sheet is already posted and can't be edited or posted again.",
    SALARY_NOT_POSTED: "This salary sheet isn't posted, so it can't be reversed.",
    MISSING_REQUIRED_DIMENSION:
      "One or more lines is missing a project, cost centre, or purpose — fix the line before posting.",
    UNBALANCED_ENTRY: "This salary run doesn't balance — please contact support before posting.",
    PERIOD_CLOSED: "This period is closed — the salary run can't be posted.",
    PROJECT_CLOSED: "This project is closed — the salary run can't be posted.",
    ALREADY_REVERSED: "This salary run has already been reversed.",
    OPTIMISTIC_LOCK_CONFLICT: "This salary sheet was just changed by someone else. Reload and try again.",
    CROSS_COMPANY_REFERENCE: "That project belongs to a different company.",
    FORBIDDEN: "You don't have permission to do that.",
    HR_ACCOUNT_NOT_CONFIGURED:
      "Payroll isn't set up yet for this company. Ask an admin to configure the salary ledger accounts, then try again.",
  };
  return M[code] ?? serverMessage ?? fallback;
}

/** Display labels for the status badge (§5). */
export const SALARY_STATUS_LABEL: Record<"DRAFT" | "POSTED" | "REVERSED", string> = {
  DRAFT: "Draft",
  POSTED: "Posted",
  REVERSED: "Reversed",
};

// ── FR-HR-013a — Days group + attendance-gap warning microcopy (spec §8, exact strings) ──

import type { SalarySheetWarnings } from "../api/salary";

export const DAYS_GROUP_HELPER = "Paid = standard − unpaid. Weekly and government holidays are paid.";

/** The Late column's tooltip — `N` is the company's `latesPerDeductedDay`, never a literal 3. */
export function lateColumnHelper(latesPerDeductedDay: number): string {
  return `Every ${latesPerDeductedDay} late days cost one day's pay. The penalty reduces gross — it isn't a separate deduction.`;
}

/** `{lateCount} → {penaltyDays}d`, `—` at zero lates (spec §8). */
export function formatLateCell(lateCount: number, latePenaltyDays: string): string {
  if (!lateCount) return "—";
  const days = Number(latePenaltyDays);
  return `${lateCount} → ${Number.isFinite(days) ? Math.trunc(days) : 0}d`;
}

export const GAP_ALERT_COPY = {
  heading: "Check attendance before posting this run.",
  sub: "Under the current pay rule, a working day with no attendance record is treated as unpaid. Anything missing here becomes a deduction.",
  zeroRecordHeading: (n: number) => `No attendance was recorded for anyone on ${n} working day(s):`,
  zeroRecordTrailing:
    "That usually means a device outage or a branch entry log that was never submitted — not that the office was empty.",
  unpaidHeading: "Unpaid days by employee",
  unpaidRow: (name: string, unpaidDays: number) => `${name} — ${unpaidDays} unpaid day(s)`,
  unpaidTrailing: "An outlier here is worth a second look before you post.",
  skippedHeading: (n: number) => `${n} employee(s) aren't on this sheet:`,
  skippedTrailing: "They won't be paid on this run until they have a project.",
  acknowledgement: "I've checked these days and they're genuinely unpaid.",
  disabledPostTooltip: "Review the attendance gaps above before posting.",
  crossLink: "Open attendance for this period",
} as const;

export const NO_WEEKLY_HOLIDAYS_COPY = {
  title: "No weekly off-days are configured — every calendar day is being counted as a working day.",
  body: "Everyone is being docked for their weekly day off, so the unpaid-day figures and the gap list below are all inflated. Set the weekly off-days on the Holidays screen, then regenerate this sheet.",
} as const;

/** `NO_PROJECT` etc. rendered in plain language — the raw code never reaches the screen. */
export function skippedReasonLabel(reason: string): string {
  if (reason === "NO_PROJECT") return "no project set";
  return reason.toLowerCase().replace(/_/g, " ");
}

/**
 * True when the gap ALERT must render and gate Post. `employeeAbsences` includes zero rows
 * for every employee on a clean sheet, so emptiness is judged on `unpaidDays > 0` — the
 * clean case must stay clean or the warning becomes wallpaper (spec §6).
 */
export function hasAttendanceGaps(warnings: SalarySheetWarnings | null | undefined): boolean {
  if (!warnings) return false;
  return (
    warnings.daysWithNoRecords.length > 0 ||
    warnings.skippedEmployees.length > 0 ||
    warnings.employeeAbsences.some((a) => a.unpaidDays > 0)
  );
}

/** Anything to render at all — the gap block and/or the weekly-holidays banner. */
export function hasAnySalaryWarning(warnings: SalarySheetWarnings | null | undefined): boolean {
  return !!warnings && (hasAttendanceGaps(warnings) || warnings.noWeeklyHolidaysConfigured);
}
