import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { EmployeesScreen } from "@/features/hr-payroll/components/EmployeesScreen";

/** Employees list route (FR-HR-001/003) — under the (app) shell + hr module guard. */
export default async function HrEmployeesPage() {
  await requireModuleAccess("hr");
  return <EmployeesScreen />;
}
