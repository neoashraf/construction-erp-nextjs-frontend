import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { ProfitabilityScreen } from "@/features/cost-control/components/ProfitabilityScreen";

/**
 * Cost-centre profitability route (CC; FR-CC-009/010) — under the (app) shell + the
 * `cost-control` module guard. Read-only revenue/cost/profit grouped by cost centre and/or
 * project. Access is further narrowed IN the screen to Admin + Accounts Manager (the SRS
 * does not list PM as a profitability consumer — spec §11); the server re-checks every read.
 */
export default async function CostControlProfitabilityPage() {
  await requireModuleAccess("cost-control");
  return <ProfitabilityScreen />;
}
