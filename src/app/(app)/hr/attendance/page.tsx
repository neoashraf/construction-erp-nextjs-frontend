import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { AttendanceShell } from "@/features/hr/components/AttendanceShell";

/**
 * `/hr/attendance` — three-mode attendance shell (FR-HR-004..-012; spec §3). The module
 * guard redirects Site Engineer / Store Keeper / PM (no HR module) to /403; HR Manager /
 * Admin / Accounts reach the shell. The shell further hides Confirm/Reverse via
 * `canConfirmAttendance` — server re-checks every write/post regardless.
 */
export default async function HrAttendancePage() {
  await requireModuleAccess("hr");
  return <AttendanceShell />;
}
