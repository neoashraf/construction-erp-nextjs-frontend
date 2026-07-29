/**
 * FE-60 fe-hr-reports — per-report row + totals shapes (FR-RPT-026/027/028,
 * contract 15 § "HR reports"). Reuses FE-54's `ReportResult<Row>` envelope.
 */

export type HrReportTab = "ATTENDANCE_SUMMARY" | "SALARY_REGISTER" | "PAYMENT_HISTORY";

export const REPORT_NAME: Record<HrReportTab, string> = {
  ATTENDANCE_SUMMARY: "attendance-summary",
  SALARY_REGISTER: "salary-register",
  PAYMENT_HISTORY: "employee-payment-history",
};

/* ------------------------------------------------------------------ *
 * FE-66 — the attendance report's three GRAINS (spec §3, §5).
 *
 * One registered report (FR-RPT-026), three detail levels — NOT three
 * catalog entries and NOT three sibling tabs. The Level-1 switcher stays a
 * `role="tablist"`; this is a subordinate `role="radiogroup"` named "Detail".
 * ------------------------------------------------------------------ */

export type AttendanceLevel = "DAILY" | "RANGE" | "SUMMARY";

export const ATTENDANCE_LEVELS: AttendanceLevel[] = ["DAILY", "RANGE", "SUMMARY"];

export const ATTENDANCE_LEVEL_LABEL: Record<AttendanceLevel, string> = {
  DAILY: "Daily",
  RANGE: "Range",
  SUMMARY: "Summary",
};

/**
 * Which endpoint backs each level (brief "Ambiguities" — resolved as the
 * screen-spec §5 components table says, and flagged for confirmation):
 *   • SUMMARY → RPT's registered `attendance-summary` (project-grouped roll-up,
 *     what the dashboard tile drills into) — goes through FE-54's `runReport`.
 *   • DAILY / RANGE → HR's own `/api/reports/{daily,range}`, which carry the
 *     **whole-body envelope exception** (`{ totals, data, pagination }`, no
 *     `{ data, meta }` wrapper) and page on `limit`, not `pageSize`.
 */
export const ATTENDANCE_LEVEL_ENDPOINT: Record<AttendanceLevel, string> = {
  DAILY: "daily",
  RANGE: "range",
  SUMMARY: "attendance-summary",
};

/** Server-derived day status — six exact title-case strings (contract 12 §Attendance reports). */
export type AttendanceDayStatus =
  | "Present"
  | "Late"
  | "Absent"
  | "Holiday"
  | "Paid leave"
  | "Unpaid leave"
  | (string & {});

/** How a day's punches reached us — badge mapping designed on Attendance capture §5. */
export type AttendanceSourceLabel = "Machine" | "Import" | "Manual";

/**
 * DAILY level — one row per **employee-day** (`GET /api/reports/daily`).
 * A day carrying a status but no times is an EXPECTED shape (spec §6): the time
 * cells render blank and the status stands. Never an error, never a dropped row.
 */
export interface AttendanceDailyRow {
  id: string;
  /** The employee CODE (`userId` on the wire), not the UUID. */
  userId: string;
  name: string | null;
  designation: string | null;
  /** `YYYY-MM-DD`. */
  attendanceDate: string;
  status: AttendanceDayStatus;
  /** Resolved work location for the day (Location, never "Project" — FR-HR-008b). */
  locationName: string | null;
  /** `HH:mm`, or null on a timeless day. Never fabricated. */
  checkIn: string | null;
  checkOut: string | null;
  punchCount: number;
  /** Absent on a holiday row — the design renders an em dash. */
  sourceLabel: AttendanceSourceLabel | null;
  holidayName: string | null;
}

/**
 * RANGE level — per-employee day counts over an arbitrary window
 * (`GET /api/reports/range`), with the server's own `attendancePercentage`.
 */
export interface AttendanceRangeRow {
  id: string;
  userId: string;
  name: string | null;
  designation: string | null;
  projectName: string | null;
  costCentreName: string | null;
  present: number;
  paidLeave: number;
  unpaidLeave: number;
  absent: number;
  /**
   * Attended ÷ working days, holidays EXCLUDED from the denominator, served to
   * one decimal. `null` where the endpoint doesn't serve it — the column is then
   * absent rather than fabricated. **The FE never divides anything.**
   */
  attendancePercentage: number | null;
  employeeInactive?: boolean;
}

/**
 * Report-wide totals for an attendance level. ALWAYS the server's own figure,
 * computed over the whole filtered set — never a sum of the visible page
 * (contract 12 § "Totals vs pagination"). Absent → render no band at all.
 */
export interface AttendanceReportTotals {
  present: number;
  paidLeave: number;
  unpaidLeave: number;
  absent: number;
  /** Server-computed; `null` where the endpoint doesn't serve it. */
  attendancePercentage: number | null;
  /** Summary level only — the head-count roll-up. */
  headCount?: number;
  /** Free-text scope hint under the band ("13 rows · 94 people counted"). */
  scopeNote?: string;
}

/**
 * The skipped-day guard (FR-HR-008a) — present on all three HR report bodies.
 * A report built on incomplete data must never read as a complete report.
 */
export interface AttendanceUnreconciled {
  days: number;
  reasons: Record<string, number>;
  sample: { userId: string; attendanceDate: string; reason: string }[];
}

export type AttendanceMode = "OFFICE" | "SUBCONTRACTOR" | "DAILY_LABOUR";

export interface AttendanceSummaryRow {
  projectId: string | null;
  projectName: string | null;
  employeeId: string | null;
  employeeName: string | null;
  partyId: string | null;
  partyName: string | null;
  costCentreId: string | null;
  costCentreCode: string | null;
  costCentreName: string | null;
  present: number;
  paidLeave: number;
  unpaidLeave: number;
  absent: number;
  headCount: number;
  mode: AttendanceMode;
  /**
   * FE-66 — served with the row where the endpoint provides it, `null` otherwise.
   * NOT on RPT's documented `attendance-summary` row shape today (brief
   * "Ambiguities"): where it's absent the column does not render, and the FE
   * never computes it.
   */
  attendancePercentage: number | null;
  employeeInactive?: boolean;
  costCentreInactive?: boolean;
}

export interface AttendanceTotals {
  present: number;
  paidLeave: number;
  unpaidLeave: number;
  absent: number;
  headCount: number;
}

export interface SalaryRegisterRow {
  salaryRunId: string;
  journalEntryId: string | null;
  journalEntryNo: string | null;
  employeeId: string;
  employeeName: string | null;
  projectId: string | null;
  projectName: string | null;
  costCentreId: string | null;
  costCentreCode: string | null;
  costCentreName: string | null;
  grossPay: string;
  allowances: string;
  tds: string;
  pf: string;
  advanceRecovery: string;
  otherDeductions: string;
  netPay: string;
  employeeInactive?: boolean;
}

export interface SalaryRegisterTotals {
  gross: string;
  net: string;
}

export interface EmployeePaymentRow {
  paymentId: string;
  paymentVoucherId: string;
  payableRef: string;
  employeeId: string;
  employeeName: string | null;
  paymentDate: string;
  paidAmount: string;
}

export interface EmployeePaymentTotals {
  paidCount: number | string;
  totalPaid: string;
}
