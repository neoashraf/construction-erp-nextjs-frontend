import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { CostCentresScreen } from "@/features/master-data/components/CostCentresScreen";

/** Cost centres route (FR-MAS-009/010) — under the (app) shell + master-data guard. */
export default async function CostCentresPage() {
  await requireModuleAccess("master-data");
  return <CostCentresScreen />;
}
