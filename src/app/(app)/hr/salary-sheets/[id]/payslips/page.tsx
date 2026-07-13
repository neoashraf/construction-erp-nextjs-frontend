import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { PayslipList } from "@/features/hr/components/PayslipList";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * `/hr/salary-sheets/{id}/payslips` — the list of payslips for a POSTED salary run
 * (FR-HR-017). Read-only screen; the module guard admits HR / Accounts / Admin. Site
 * Engineer / Store Keeper / PM are redirected to /403; the server also re-checks the
 * `hr.salary_sheets:READ` scope on every request (defence-in-depth). Payslips only exist
 * after the parent run is POSTED — a DRAFT run renders the not-posted guard view.
 */
export default async function HrPayslipListPage({ params }: RouteParams) {
  await requireModuleAccess("hr");
  const { id } = await params;
  return <PayslipList sheetId={id} />;
}
