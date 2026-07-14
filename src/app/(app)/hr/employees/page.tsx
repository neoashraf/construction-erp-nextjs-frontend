import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { EmployeeList } from "@/features/hr/components/EmployeeList";

/**
 * `/hr/employees` — the Employee master list landing (FR-HR-001/-003; spec §3). The module
 * guard redirects Site Engineer / Store Keeper / PM (no HR module) to /403; HR Manager /
 * Admin / Accounts Manager reach the list. The list itself further HIDES the "New employee"
 * CTA for Accounts (read-only) via `canWriteEmployee` — server re-checks every write.
 */
export default async function HrEmployeesPage() {
  await requireModuleAccess("hr");
  return <EmployeeList />;
}
