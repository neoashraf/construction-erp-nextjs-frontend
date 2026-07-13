import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { SalarySheetsScreen } from "@/features/hr-payroll/components/SalarySheetsScreen";

/** Salary-sheet runs list route (FR-HR-013) — under the (app) shell + hr guard. */
export default async function HrSalarySheetsPage() {
  await requireModuleAccess("hr");
  return <SalarySheetsScreen />;
}
