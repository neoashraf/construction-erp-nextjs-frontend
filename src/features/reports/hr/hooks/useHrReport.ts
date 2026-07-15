"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { runReport } from "../../api/reports";
import { type ReportParams, type ReportResult } from "../../types";
import {
  REPORT_NAME,
  type AttendanceSummaryRow,
  type AttendanceTotals,
  type EmployeePaymentRow,
  type EmployeePaymentTotals,
  type HrReportTab,
  type SalaryRegisterRow,
  type SalaryRegisterTotals,
} from "../types";

export interface AttendanceResult extends ReportResult<AttendanceSummaryRow> {
  meta: ReportResult<AttendanceSummaryRow>["meta"] & { totals?: Partial<AttendanceTotals> };
}
export interface SalaryRegisterResult extends ReportResult<SalaryRegisterRow> {
  meta: ReportResult<SalaryRegisterRow>["meta"] & { totals?: Partial<SalaryRegisterTotals> };
}
export interface EmployeePaymentResult extends ReportResult<EmployeePaymentRow> {
  meta: ReportResult<EmployeePaymentRow>["meta"] & { totals?: Partial<EmployeePaymentTotals> };
}
export type AnyHrResult = AttendanceResult | SalaryRegisterResult | EmployeePaymentResult;
type AnyRow = AttendanceSummaryRow | SalaryRegisterRow | EmployeePaymentRow;

export function useHrReport(tab: HrReportTab, params: ReportParams | null, enabled: boolean) {
  const user = useAuthenticatedUser();
  return useQuery<AnyHrResult>({
    queryKey: queryKeys.detail(
      "reports",
      "hr",
      `${user.companyId}:${user.financialYearId}:${REPORT_NAME[tab]}:${JSON.stringify(params ?? {})}`,
    ),
    queryFn: () =>
      runReport<AnyRow>(REPORT_NAME[tab], params!).then(
        (r) => r as unknown as AnyHrResult,
      ),
    enabled: !!params && enabled,
    retry: false,
    staleTime: 0,
  });
}

export function errorTitleFor(tab: HrReportTab): string {
  switch (tab) {
    case "ATTENDANCE_SUMMARY": return "Couldn't load the attendance summary.";
    case "SALARY_REGISTER": return "Couldn't load the salary register.";
    case "PAYMENT_HISTORY": return "Couldn't load employee payment history.";
  }
}
export function emptyLabelFor(tab: HrReportTab): string {
  switch (tab) {
    case "ATTENDANCE_SUMMARY": return "No attendance recorded for this month.";
    case "SALARY_REGISTER": return "No salary data for this period.";
    case "PAYMENT_HISTORY": return "No results for these filters.";
  }
}
export function subtitleFor(tab: HrReportTab): string {
  switch (tab) {
    case "ATTENDANCE_SUMMARY": return "Monthly present / leave / absent per project.";
    case "SALARY_REGISTER": return "Per-employee earnings + deductions for a posted salary run.";
    case "PAYMENT_HISTORY": return "Per-employee salary settlements over a date range.";
  }
}
export function breadcrumbFor(tab: HrReportTab): string {
  switch (tab) {
    case "ATTENDANCE_SUMMARY": return "Attendance summary";
    case "SALARY_REGISTER": return "Salary register";
    case "PAYMENT_HISTORY": return "Employee payment history";
  }
}
