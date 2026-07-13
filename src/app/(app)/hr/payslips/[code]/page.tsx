import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { PayslipScreen } from "@/features/hr-payroll/components/PayslipScreen";

/** Single payslip route (FR-HR-017) — `[code]` is an employee code on the posted run. */
export default async function HrPayslipPage({ params }: { params: Promise<{ code: string }> }) {
  await requireModuleAccess("hr");
  const { code } = await params;
  return <PayslipScreen code={decodeURIComponent(code)} />;
}
