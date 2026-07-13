import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { PayslipDocument } from "@/features/hr/components/PayslipDocument";

interface RouteParams {
  params: Promise<{ id: string; employeeId: string }>;
}

/**
 * `/hr/salary-sheets/{id}/payslips/{employeeId}` — the single-payslip print/document view
 * (FR-HR-017). Read-only; module-guarded. If the parent run is DRAFT the not-posted guard
 * view renders; if REVERSED the persistent banner ("figures reflect the original posting")
 * appears above the paper. The print stylesheet hides chrome and keeps the paper node.
 */
export default async function HrPayslipDetailPage({ params }: RouteParams) {
  await requireModuleAccess("hr");
  const { id, employeeId } = await params;
  return <PayslipDocument sheetId={id} employeeId={employeeId} />;
}
