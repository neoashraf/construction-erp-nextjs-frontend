import { z } from "zod";
import { type DayStatus } from "../api/attendance";

/**
 * Attendance zod schemas + error-code → spec §8 microcopy map (FR-HR-004..-012, -018).
 * One schema per mode row (office / daily-labour / subcontractor) plus the Confirm and
 * Reverse dialog inputs. Every code from API contract 12 § "Attendance" maps here so the
 * grid + dialogs use the same message table (see `mapAttendanceError`).
 */

export const DAY_STATUS_OPTIONS: readonly DayStatus[] = [
  "PRESENT",
  "PAID_LEAVE",
  "UNPAID_LEAVE",
  "ABSENT",
];

export const DAY_STATUS_LABEL: Record<DayStatus, string> = {
  PRESENT: "Present",
  PAID_LEAVE: "Paid leave",
  UNPAID_LEAVE: "Unpaid leave",
  ABSENT: "Absent",
};

// Time HH:mm (24-hour) — optional check-in/out.
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const officeRowSchema = z
  .object({
    employeeId: z.string().min(1, "Choose an employee."),
    projectId: z.string().min(1, "Choose a project."),
    dayStatus: z.enum(["PRESENT", "PAID_LEAVE", "UNPAID_LEAVE", "ABSENT"]),
    checkIn: z.string().regex(TIME_RE, "Enter a time as HH:mm.").optional().or(z.literal("")),
    checkOut: z.string().regex(TIME_RE, "Enter a time as HH:mm.").optional().or(z.literal("")),
    overtimeHours: z
      .string()
      .refine((v) => v === "" || /^\d*\.?\d*$/.test(v), "Enter a positive number.")
      .optional()
      .or(z.literal("")),
  })
  .refine((v) => !(v.checkIn && v.checkOut) || v.checkIn <= v.checkOut, {
    path: ["checkOut"],
    message: "Check-out must be after check-in.",
  });

export type OfficeRowValues = z.infer<typeof officeRowSchema>;

export const dailyLabourRowSchema = z.object({
  projectId: z.string().min(1, "Choose a project."),
  costCentreId: z.string().min(1, "Choose a cost centre."),
  purposeId: z.string().nullable().optional(),
  labourCategory: z.string().nullable().optional(),
  headCount: z
    .number({ invalid_type_error: "Enter a head count of 1 or more." })
    .int("Head count must be a whole number.")
    .min(1, "Enter a head count of 1 or more."),
  dailyRate: z
    .string()
    .refine((v) => /^\d*\.?\d*$/.test(v) && v !== "" && Number(v) >= 0, "Enter a daily rate of ৳0 or more."),
});
export type DailyLabourRowValues = z.infer<typeof dailyLabourRowSchema>;

export const subcontractorRowSchema = z.object({
  partyId: z.string().min(1, "Choose a subcontractor."),
  projectId: z.string().min(1, "Choose a project."),
  costCentreId: z.string().min(1, "Choose a cost centre."),
  purposeId: z.string().nullable().optional(),
  headCount: z
    .number({ invalid_type_error: "Enter a head count of 1 or more." })
    .int("Head count must be a whole number.")
    .min(1, "Enter a head count of 1 or more."),
});
export type SubcontractorRowValues = z.infer<typeof subcontractorRowSchema>;

export const confirmAccrualSchema = z.object({
  purposeId: z.string().min(1, "A purpose is required to post the accrual."),
});
export type ConfirmAccrualValues = z.infer<typeof confirmAccrualSchema>;

export const reverseAccrualSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Enter a reason for reversing this accrual."),
});
export type ReverseAccrualValues = z.infer<typeof reverseAccrualSchema>;

/**
 * Map every API contract 12 § "Attendance" code → the exact spec §8 microcopy. Callers
 * pass the raw ApiError code; unknown codes fall back to the server's message.
 */
export function mapAttendanceError(code: string, fallback = "Something went wrong. Please try again."): string {
  const M: Record<string, string> = {
    VALIDATION_ERROR: "Some fields need attention. Please check and try again.",
    CROSS_COMPANY_REFERENCE: "That reference belongs to a different company.",
    DUPLICATE_ATTENDANCE: "There's already an attendance row for this employee on this day.",
    ATTENDANCE_CONFIRMED_IMMUTABLE: "This row has been confirmed and can no longer be edited — use Reverse to correct it.",
    ALREADY_CONFIRMED: "This row has already been confirmed.",
    MISSING_REQUIRED_DIMENSION: "A purpose is required to post the accrual.",
    UNBALANCED_ENTRY: "The accrual didn't balance. Please try again or contact support.",
    PERIOD_CLOSED: "This accounting period is closed — posting isn't allowed.",
    PROJECT_CLOSED: "This project is closed — posting isn't allowed.",
    NOT_CONFIRMED: "There's nothing to reverse — this row isn't confirmed.",
    ALREADY_REVERSED: "This accrual has already been reversed.",
    OPTIMISTIC_LOCK_CONFLICT: "This row was just changed by someone else. Reload and try again.",
    FORBIDDEN: "You don't have permission to do that.",
  };
  return M[code] ?? fallback;
}
