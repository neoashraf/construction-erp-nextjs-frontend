import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { EmployeeDetailScreen } from "@/features/hr-payroll/components/EmployeeDetailScreen";

/**
 * Employee detail route (FR-HR-001/002/003) — `[id]` is an employee id. Guarded by
 * the hr module guard; the client screen resolves the record + hosts the tabs/form.
 */
export default async function HrEmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModuleAccess("hr");
  const { id } = await params;
  return <EmployeeDetailScreen id={id} />;
}
