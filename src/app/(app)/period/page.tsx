import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { PeriodManagerScreen } from "@/features/period/components/PeriodManagerScreen";

/**
 * Accounting periods route (PER; FR-PER-001/002/008/009/010). Guarded on the
 * `period` module capability (Admin, Accounts Team); any other authenticated
 * role that reaches the URL is redirected by the guard. The screen itself
 * further gates per-row/toolbar actions by role (spec §11).
 */
export default async function PeriodPage() {
  await requireModuleAccess("period");
  return <PeriodManagerScreen />;
}
