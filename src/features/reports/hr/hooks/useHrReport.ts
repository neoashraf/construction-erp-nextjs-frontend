"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { runReport } from "../../api/reports";
import { type ReportParams, type ReportResult } from "../../types";
import {
  REPORT_NAME,
  type AttendanceMode,
  type AttendanceSummaryRow,
  type AttendanceTotals,
  type EmployeePaymentRow,
  type EmployeePaymentTotals,
  type HrReportTab,
  type SalaryRegisterRow,
  type SalaryRegisterTotals,
} from "../types";

/**
 * The real backend returns MINIMAL rows (ids + numbers, no joined names) and uses
 * different field names than the FE table was first built against (a richer mock):
 *   attendance: daysPresent/headCountTotal (no `mode`, no names)
 *   salary:     gross/other/net           (no *Pay suffix, no names)
 *   payment:    payableType/payableRef     (no paymentId/voucherId, no names)
 * These normalizers map either shape → the FE row type: they PREFER an existing
 * field (so the mock-shaped test fixtures still render) and fall back to the real
 * backend field otherwise. Missing names stay null → the table shows "name
 * unavailable" (same graceful path as trial-balance).
 */
type Raw = Record<string, unknown>;
const asStr = (v: unknown): string | null => (typeof v === "string" ? v : null);
const asNum = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0)) || 0;
const asMoney = (v: unknown): string => (v == null ? "0.0000" : String(v));

function toAttendanceRow(raw: Raw): AttendanceSummaryRow {
  const employeeId = asStr(raw.employeeId);
  const partyId = asStr(raw.partyId);
  return {
    projectId: asStr(raw.projectId),
    projectName: asStr(raw.projectName),
    employeeId,
    employeeName: asStr(raw.employeeName),
    partyId,
    partyName: asStr(raw.partyName),
    costCentreId: asStr(raw.costCentreId),
    costCentreCode: asStr(raw.costCentreCode),
    costCentreName: asStr(raw.costCentreName),
    present: asNum(raw.present ?? raw.daysPresent),
    paidLeave: asNum(raw.paidLeave),
    unpaidLeave: asNum(raw.unpaidLeave),
    absent: asNum(raw.absent),
    headCount: asNum(raw.headCount ?? raw.headCountTotal),
    mode:
      (raw.mode as AttendanceMode | undefined) ??
      (partyId ? "SUBCONTRACTOR" : employeeId ? "OFFICE" : "DAILY_LABOUR"),
    employeeInactive: raw.employeeInactive as boolean | undefined,
    costCentreInactive: raw.costCentreInactive as boolean | undefined,
  };
}

function toSalaryRow(raw: Raw): SalaryRegisterRow {
  return {
    salaryRunId: asStr(raw.salaryRunId) ?? "",
    journalEntryId: asStr(raw.journalEntryId),
    journalEntryNo: asStr(raw.journalEntryNo),
    employeeId: asStr(raw.employeeId) ?? "",
    employeeName: asStr(raw.employeeName),
    projectId: asStr(raw.projectId),
    projectName: asStr(raw.projectName),
    costCentreId: asStr(raw.costCentreId),
    costCentreCode: asStr(raw.costCentreCode),
    costCentreName: asStr(raw.costCentreName),
    grossPay: asMoney(raw.grossPay ?? raw.gross),
    allowances: asMoney(raw.allowances),
    tds: asMoney(raw.tds),
    pf: asMoney(raw.pf),
    advanceRecovery: asMoney(raw.advanceRecovery),
    otherDeductions: asMoney(raw.otherDeductions ?? raw.other),
    netPay: asMoney(raw.netPay ?? raw.net),
    employeeInactive: raw.employeeInactive as boolean | undefined,
  };
}

function toPaymentRow(raw: Raw): EmployeePaymentRow {
  return {
    paymentId: asStr(raw.paymentId) ?? asStr(raw.payableRef) ?? "",
    paymentVoucherId: asStr(raw.paymentVoucherId) ?? "",
    payableRef: asStr(raw.payableRef) ?? "",
    employeeId: asStr(raw.employeeId) ?? "",
    employeeName: asStr(raw.employeeName),
    paymentDate: asStr(raw.paymentDate) ?? "",
    paidAmount: asMoney(raw.paidAmount),
  };
}

function normalizeHrResult(tab: HrReportTab, r: ReportResult<AnyRow>): AnyHrResult {
  const rawRows = (r.rows ?? []) as unknown as Raw[];
  const meta = r.meta as AnyHrResult["meta"];
  if (tab === "ATTENDANCE_SUMMARY") {
    const rows = rawRows.map(toAttendanceRow);
    const totals =
      (meta.totals as Partial<AttendanceTotals> | undefined) ??
      rows.reduce<AttendanceTotals>(
        (a, x) => ({
          present: a.present + x.present,
          paidLeave: a.paidLeave + x.paidLeave,
          unpaidLeave: a.unpaidLeave + x.unpaidLeave,
          absent: a.absent + x.absent,
          headCount: a.headCount + x.headCount,
        }),
        { present: 0, paidLeave: 0, unpaidLeave: 0, absent: 0, headCount: 0 },
      );
    return { ...r, rows, meta: { ...meta, totals } } as AttendanceResult;
  }
  if (tab === "SALARY_REGISTER") {
    return { ...r, rows: rawRows.map(toSalaryRow) } as SalaryRegisterResult;
  }
  const rows = rawRows.map(toPaymentRow);
  const totals =
    (meta.totals as Partial<EmployeePaymentTotals> | undefined) ??
    {
      paidCount: rows.length,
      totalPaid: rows.reduce((a, x) => a + Number(x.paidAmount), 0).toFixed(4),
    };
  return { ...r, rows, meta: { ...meta, totals } } as EmployeePaymentResult;
}

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
      runReport<AnyRow>(REPORT_NAME[tab], params!).then((r) => normalizeHrResult(tab, r)),
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
