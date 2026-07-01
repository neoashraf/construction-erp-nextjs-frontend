import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { FinancialYearsScreen } from "@/features/master-data/components/FinancialYearsScreen";

/**
 * Financial-years route (FR-MAS-002/003) — under the (app) shell + master-data
 * route guard. The server component guards; the client screen holds the list,
 * create/edit slide-over, and set-active dialog.
 */
export default async function FinancialYearsPage() {
  await requireModuleAccess("master-data");
  return <FinancialYearsScreen />;
}
