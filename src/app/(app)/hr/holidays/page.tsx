import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { HolidayManagementShell } from "@/features/hr/components/HolidayManagementShell";

/**
 * `/hr/holidays` — weekly off-days and the holiday calendar that drive the working-day
 * counts behind the attendance logs. Same HR module guard as the attendance screen.
 */
export default async function HrHolidaysPage() {
  await requireModuleAccess("hr");
  return <HolidayManagementShell />;
}
