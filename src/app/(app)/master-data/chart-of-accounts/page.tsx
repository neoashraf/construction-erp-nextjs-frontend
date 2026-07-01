import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { ChartOfAccountsScreen } from "@/features/master-data/components/ChartOfAccountsScreen";

/** Chart of accounts route (FR-MAS-017/018) — under the (app) shell + master-data guard. */
export default async function ChartOfAccountsPage() {
  await requireModuleAccess("master-data");
  return <ChartOfAccountsScreen />;
}
