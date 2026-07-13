import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { AttendanceScreen } from "@/features/hr-payroll/components/AttendanceScreen";

/** Attendance capture route (FR-HR-004/005/006) — three modes on one shell. HR guard. */
export default async function HrAttendancePage() {
  await requireModuleAccess("hr");
  return <AttendanceScreen />;
}
