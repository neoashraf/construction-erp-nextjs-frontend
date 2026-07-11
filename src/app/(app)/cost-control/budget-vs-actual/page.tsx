import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { BudgetVsActualScreen } from "@/features/cost-control/components/BudgetVsActualScreen";

/**
 * Budget-vs-actual monitor route (CC; FR-CC-006/007/008/011/012/015/016) — under the
 * (app) shell + the `cost-control` module guard. Read-only: budget, actual, variance
 * and utilisation per (project, cost centre). The server scopes a PM to assigned
 * projects and re-checks every read (`403 FORBIDDEN`), which the screen renders as the
 * project-scope denied view.
 */
export default async function BudgetVsActualPage() {
  await requireModuleAccess("cost-control");
  return <BudgetVsActualScreen />;
}
