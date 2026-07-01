import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { PurposesScreen } from "@/features/master-data/components/PurposesScreen";

/** Purposes route (FR-MAS-011/012/013) — under the (app) shell + master-data guard. */
export default async function PurposesPage() {
  await requireModuleAccess("master-data");
  return <PurposesScreen />;
}
