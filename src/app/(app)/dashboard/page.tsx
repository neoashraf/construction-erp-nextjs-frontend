import { DashboardScreen } from "@/features/dashboard/components/DashboardScreen";

/**
 * FE-61 fe-dashboard — the role-scoped KPI-tile landing (post-login home).
 * Guarded on `dashboard:READ` by the module registry.
 */
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return <DashboardScreen />;
}
