import { z } from "zod";

/**
 * Create/edit financial-year form (spec §7; FR-MAS-002). Dates are typed as
 * `DD/MM/YYYY` in the UI; the form validates format + calendar validity + the
 * date-order rule (`end > start`). Overlap with other years is allowed (no rule
 * here — an informational note in the modal, never an error).
 */

const DMY = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** Parse a `DD/MM/YYYY` string to a UTC timestamp, or null if malformed/invalid. */
function parseDmy(value: string): number | null {
  const m = DMY.exec(value.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCDate() !== day || d.getUTCMonth() !== month - 1 || d.getUTCFullYear() !== year) {
    return null;
  }
  return d.getTime();
}

export const financialYearSchema = z
  .object({
    label: z.string().trim().min(1, "Label is required."),
    startDate: z
      .string()
      .trim()
      .min(1, "Start date is required.")
      .refine((v) => parseDmy(v) !== null, "Enter a valid date (DD/MM/YYYY)."),
    endDate: z
      .string()
      .trim()
      .min(1, "End date is required.")
      .refine((v) => parseDmy(v) !== null, "Enter a valid date (DD/MM/YYYY)."),
  })
  .superRefine((val, ctx) => {
    const start = parseDmy(val.startDate);
    const end = parseDmy(val.endDate);
    if (start !== null && end !== null && end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date must be after the start date.",
      });
    }
  });

export type FinancialYearFormValues = z.infer<typeof financialYearSchema>;

/** Convert a validated `DD/MM/YYYY` form value to the API's `YYYY-MM-DD` payload. */
export function toApiDate(dmy: string): string {
  const m = DMY.exec(dmy.trim());
  if (!m) throw new Error(`Expected DD/MM/YYYY, got "${dmy}"`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}
