/**
 * HR & Payroll domain types (API contract 12 · HR/Attendance/Payroll). These mirror
 * the `Employee` / `EmployeeAssignment` / `AttendanceRecord` / `SalarySheet` /
 * `Payslip` resource shapes exactly so the screens can switch from the local seed
 * (see `seed.ts`) to the real `/api/hr/*` endpoints without touching the components.
 *
 * Money is `Decimal(18,4)` transported as a JSON string ("68000.0000"); dates are
 * `YYYY-MM-DD`; Bangla text is UTF-8 and never truncated.
 */

export type WorkBase = "HEAD_OFFICE" | "SITE";
export type WageType = "MONTHLY" | "DAILY";
export type EmployeeStatus = "ACTIVE" | "INACTIVE";

/** Office-staff employee (FR-HR-001). Bank account no/name are masked on read (NFR-002). */
export interface Employee {
  id: string;
  employeeCode: string;
  /** Bangla or English — shown on salary sheets, never truncated. */
  name: string;
  designation: string;
  department: string | null;
  /**
   * Default-tagging convenience (never posts to the ledger). Resolved to a project
   * name via the seed / master lookups; `null` = Unassigned. A sentinel of
   * `FAIL:*` in seed data models a project whose name couldn't be resolved.
   */
  defaultProjectId: string | null;
  workBase: WorkBase;
  wageType: WageType;
  /** `Decimal(18,4)` BDT string — monthly salary or daily rate per `wageType`. */
  wageAmount: string;
  bankName: string | null;
  /** Masked on read (e.g. "•••• •••• 4821") — full value is write-only. */
  bankAccountNameMasked: string | null;
  bankAccountNoMasked: string | null;
  pfApplicable: boolean;
  gratuityApplicable: boolean;
  wppfApplicable: boolean;
  tin: string | null;
  /** `YYYY-MM-DD`. */
  joiningDate: string;
  status: EmployeeStatus;
  version: number;
}

/** One append-only reassignment history row (FR-HR-002). Newest first. */
export interface EmployeeAssignment {
  id: string;
  employeeId: string;
  /** Display name of the project reassigned to ("Tower-A — Gulshan" / "Head Office"). */
  projectName: string;
  /** `YYYY-MM-DD`. */
  effectiveDate: string;
  note: string | null;
  /** The employee's current assignment (top of the list). */
  isCurrent: boolean;
  /** The original assignment recorded on joining. */
  isJoining: boolean;
}

// ── Attendance (three modes) ──────────────────────────────────────────────────

export type AttendanceMode = "OFFICE" | "SUBCONTRACTOR" | "DAILY_LABOUR";
export type DayStatus = "PRESENT" | "PAID_LEAVE" | "UNPAID_LEAVE" | "ABSENT";

/** An attendance row — populated fields depend on `mode` (FR-HR-004/005/006). */
export interface AttendanceRecord {
  id: string;
  mode: AttendanceMode;
  /** `YYYY-MM-DD`. */
  attendanceDate: string;
  projectName: string;
  costCentreName: string | null;
  purposeName: string | null;
  // OFFICE
  employeeCode: string | null;
  employeeName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  dayStatus: DayStatus | null;
  overtimeHours: string | null;
  // SUBCONTRACTOR / DAILY_LABOUR
  partyName: string | null;
  headCount: number | null;
  labourCategory: string | null;
  /** `Decimal(18,4)` BDT string. */
  dailyRate: string | null;
  source: "MANUAL" | "BIOMETRIC_IMPORT";
  /** DAILY_LABOUR only: confirmed → the accrual has posted (immutable). */
  isConfirmed: boolean;
  /** DAILY_LABOUR accrual entry number once confirmed ("DLA-2026-00042"). */
  accrualEntryNo: string | null;
}

// ── Salary (office-staff payroll) ─────────────────────────────────────────────

export type SalarySheetStatus = "DRAFT" | "POSTED" | "REVERSED";

/** A salary sheet header (FR-HR-013). */
export interface SalarySheet {
  id: string;
  periodLabel: string; // "2026-06"
  /** `YYYY-MM-DD`. */
  periodStart: string;
  periodEnd: string;
  status: SalarySheetStatus;
  /** Gapless salary journal number once posted ("SAL-2026-00007"). */
  salaryEntryNo: string | null;
  employeeCount: number;
  /** `Decimal(18,4)` BDT strings. */
  totalGross: string;
  totalDeductions: string;
  totalNet: string;
  version: number;
}

/** A per-employee salary line on a sheet (FR-HR-014). Amounts are `Decimal(18,4)`. */
export interface SalarySheetLine {
  id: string;
  employeeCode: string;
  employeeName: string;
  designation: string;
  projectName: string | null;
  paidDays: number;
  grossAmount: string;
  allowances: string;
  tds: string;
  pf: string;
  advanceRecovery: string;
  otherDeductions: string;
  netAmount: string;
}

/** Printable payslip for a posted run (FR-HR-017). */
export interface Payslip {
  employeeCode: string;
  name: string;
  designation: string;
  department: string | null;
  bankName: string | null;
  bankAccountNoMasked: string | null;
  periodLabel: string;
  paidDays: number;
  workingDays: number;
  wageType: WageType;
  /** `Decimal(18,4)` BDT strings. */
  basicSalary: string;
  allowances: string;
  overtime: string;
  grossAmount: string;
  tds: string;
  pf: string;
  advanceRecovery: string;
  otherDeductions: string;
  totalDeductions: string;
  netAmount: string;
  /** Net amount in words (Bangla-ready English words for the mockup). */
  netInWords: string;
}
