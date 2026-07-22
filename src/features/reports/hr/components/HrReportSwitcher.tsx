"use client";

import { ReportTypeSwitcher, type ReportChip } from "../../components/ReportTypeSwitcher";
import { type HrReportTab } from "../types";

/**
 * FE-60 HR chip row. Attendance (by month) + salary register (by run) are
 * balance reports (violet dot); payment history is a date-range flow report
 * (blue dot). Rendered as the shared design chip row.
 */
const CHIPS: ReadonlyArray<ReportChip<HrReportTab>> = [
  { id: "ATTENDANCE_SUMMARY", label: "Attendance summary", tone: "violet" },
  { id: "SALARY_REGISTER", label: "Salary register", tone: "violet" },
  { id: "PAYMENT_HISTORY", label: "Employee payment history", tone: "blue" },
];

export function HrReportSwitcher({
  value,
  onChange,
}: {
  value: HrReportTab;
  onChange: (next: HrReportTab) => void;
}) {
  return (
    <ReportTypeSwitcher
      ariaLabel="HR report"
      chips={CHIPS}
      value={value}
      onChange={onChange}
      testId="hr-switcher"
      chipTestId={(id) => `hr-tab-${id}`}
    />
  );
}
