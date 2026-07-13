import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { EmployeeDetail } from "@/features/hr/components/EmployeeDetail";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * `/hr/employees/{id}` — the Employee detail page (Profile + Assignment-history tabs). The
 * `"new"` route is served by the list's create drawer, not by this route (spec §3). Nav
 * guard: SITE_ENGINEER / STORE_KEEPER / PROJECT_MANAGER redirect to /403; the server also
 * re-checks every write and reveal so hidden affordances are UX only.
 */
export default async function HrEmployeeDetailPage({ params }: RouteParams) {
  await requireModuleAccess("hr");
  const { id } = await params;
  return <EmployeeDetail employeeId={id} />;
}
