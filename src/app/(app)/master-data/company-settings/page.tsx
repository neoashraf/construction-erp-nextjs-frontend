import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { CompanySettingsScreen } from "@/features/master-data/components/CompanySettingsScreen";

/**
 * Company settings route (FR-MAS-001/004) — under the (app) shell + master-data
 * guard. The single company opens directly (Phase-1, no list). The server component
 * guards; the client screen fetches + hosts the two editable cards.
 */
export default async function CompanySettingsPage() {
  await requireModuleAccess("master-data");
  return <CompanySettingsScreen />;
}
