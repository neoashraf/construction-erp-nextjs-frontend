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
    projectId: z.string().nullable().optional(),
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
 * the raw ApiError code; unknown codes fall back to the generic message.
 */
export function mapSalaryError(code: string, fallback = "Something went wrong. Please try again."): string {
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
  };
  return M[code] ?? fallback;
}

/** Display labels for the status badge (§5). */
export const SALARY_STATUS_LABEL: Record<"DRAFT" | "POSTED" | "REVERSED", string> = {
  DRAFT: "Draft",
  POSTED: "Posted",
  REVERSED: "Reversed",
};
