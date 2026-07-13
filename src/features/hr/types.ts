/**
 * HR module view-model types (API contract 12 § "Employees"). Employee is the office-staff
 * master (FR-HR-001) — subcontractor workers / daily labourers never appear here. Bank
 * account name/number are write-only, read-masked (NFR-002): the read shape carries the
 * last-4 digits with a `bankMasked` flag; the "Show" affordance re-reads with `?reveal=true`
 * on the `hr:employee:write` scope. Money is `Decimal(18,4)` JSON strings; dates YYYY-MM-DD.
 * Shared with `fe-attendance` + `fe-salary-sheet` (they consume `Employee` + the option shape).
 */

export type EmployeeStatus = "ACTIVE" | "INACTIVE";
export type WorkBase = "HEAD_OFFICE" | "SITE";
export type WageType = "MONTHLY" | "DAILY";

/**
 * The full Employee resource returned by reads. Bank fields are masked as `•••• {last4}`
 * on the standard read; a `?reveal=true` GET returns the raw values for `hr:employee:write`
 * holders (HR Manager / Admin) and is audited server-side.
 */
export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  designation: string | null;
  defaultProjectId: string | null;
  department: string | null;
  workBase: WorkBase;
  wageType: WageType;
  wageAmount: string; // Decimal(18,4)
  bankName: string | null;
  /** Masked ("•••• 7890") on standard read; raw on `?reveal=true` for hr:employee:write. */
  bankAccountName: string | null;
  bankAccountNo: string | null;
  /** True while bank fields are masked (standard read); false on a revealed read. */
  bankMasked: boolean;
  pfApplicable: boolean;
  gratuityApplicable: boolean;
  wppfApplicable: boolean;
  tin: string | null;
  joiningDate: string; // YYYY-MM-DD
  status: EmployeeStatus;
  /** True when the employee has any attendance / salary line — locks `employeeCode` for edit. */
  hasReferences: boolean;
  version: number;
}

/** A row of the employee list — the summary projection used by the paginated GET. */
export interface EmployeeSummary {
  id: string;
  employeeCode: string;
  name: string;
  designation: string | null;
  defaultProjectId: string | null;
  workBase: WorkBase;
  wageType: WageType;
  wageAmount: string;
  status: EmployeeStatus;
  hasReferences: boolean;
}

export interface EmployeePage {
  data: EmployeeSummary[];
  page: number;
  pageSize: number;
  total: number;
}

/** A picker option for the project select (create drawer + Reassign dialog). */
export interface ProjectOption {
  id: string;
  name: string;
}

/** One append-only assignment history row (FR-HR-002). Newest-first. */
export interface EmployeeAssignment {
  id: string;
  employeeId: string;
  projectId: string;
  effectiveDate: string; // YYYY-MM-DD
  note: string | null;
}
