import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { OverBudgetAlertsScreen } from "@/features/cost-control/components/OverBudgetAlertsScreen";

/**
 * Over-budget alerts route (CC; FR-CC-011/012/015/016) — under the (app) shell + the
 * `cost-control` module guard. Read-only, live: the current OVER/APPROACHING
 * (project, cost centre) pairs. The server always scopes a PM to assigned projects and
 * re-checks every read (`403 FORBIDDEN`), which the screen renders as the project-scope
 * denied view. This screen backs the app-shell's alerts bell (same `GET …/alerts`).
 */
export default async function CostControlAlertsPage() {
  await requireModuleAccess("cost-control");
  return <OverBudgetAlertsScreen />;
}
