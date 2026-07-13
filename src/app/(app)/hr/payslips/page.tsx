import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { PayslipsScreen } from "@/features/hr-payroll/components/PayslipsScreen";

/** Payslips list route (FR-HR-017) — payslips for a posted salary run. HR guard. */
export default async function HrPayslipsPage() {
  await requireModuleAccess("hr");
  return <PayslipsScreen />;
}
