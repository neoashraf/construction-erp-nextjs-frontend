import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { SalarySheetEditorScreen } from "@/features/hr-payroll/components/SalarySheetEditorScreen";

/**
 * Salary-sheet editor / viewer route (FR-HR-014/015) — `[id]` is a run id / period.
 * DRAFT is editable + postable; POSTED/REVERSED are read-only. Guarded by the hr module.
 */
export default async function HrSalarySheetEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModuleAccess("hr");
  const { id } = await params;
  return <SalarySheetEditorScreen id={id} />;
}
