import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { PartiesScreen } from "@/features/master-data/components/PartiesScreen";

/** Parties list route (FR-MAS-022/024) — under the (app) shell + master-data guard. */
export default async function PartiesPage() {
  await requireModuleAccess("master-data");
  return <PartiesScreen />;
}
