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
