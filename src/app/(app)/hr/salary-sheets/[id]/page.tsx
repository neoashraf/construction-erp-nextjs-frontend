import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { SalarySheetEditor } from "@/features/hr/components/SalarySheetEditor";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * `/hr/salary-sheets/{id}` — the sheet editor / viewer (FR-HR-013..-018). DRAFT is fully
 * editable for HR Manager / Admin; POSTED/REVERSED are strictly read-only for everyone.
 * The module guard redirects Site Engineer / Store Keeper / PM to /403; the server also
 * re-checks every action so hidden affordances are UX only.
 */
export default async function HrSalarySheetDetailPage({ params }: RouteParams) {
  await requireModuleAccess("hr");
  const { id } = await params;
  return <SalarySheetEditor id={id} />;
}
