import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { AttendanceLogsShell } from "@/features/hr/components/AttendanceLogsShell";

/**
 * `/hr/attendance` — biometric attendance logs.
 *
 * Reporting over the device feed: filterable per-day and aggregate views, a per-employee
 * detail drawer, device sync, and Excel export. Nothing on this screen posts to the ledger.
 *
 * The ledger-posting capture screen (three-mode office / daily-labour / subcontractor, with
 * the daily-labour accrual Confirm/Reverse) still lives in `AttendanceShell` and its
 * sibling components — it is retained, not deleted, pending its own route.
 *
 * The module guard redirects roles without HR access to /403; the backend re-checks every
 * call regardless.
 */
export default async function HrAttendancePage() {
  await requireModuleAccess("hr");
  return (
    <div className="mx-auto max-w-6xl">
      <AttendanceLogsShell />
    </div>
  );
}
