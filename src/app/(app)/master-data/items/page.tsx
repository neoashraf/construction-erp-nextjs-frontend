import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { ItemsScreen } from "@/features/master-data/components/ItemsScreen";

/** Items list route (FR-MAS-025) — under the (app) shell + master-data guard. */
export default async function ItemsPage() {
  await requireModuleAccess("master-data");
  return <ItemsScreen />;
}
