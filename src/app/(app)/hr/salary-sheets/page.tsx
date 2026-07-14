import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { SalaryRunsList } from "@/features/hr/components/SalaryRunsList";

/**
 * `/hr/salary-sheets` — the runs list (FR-HR-013). Module guard redirects Site Engineer /
 * Store Keeper / PM (no HR module) to /403; HR Manager / Admin / Accounts reach the list.
 * Generate / edit / post / reverse are further gated inside the client tree (access.ts),
 * with the server re-checking every action.
 */
export default async function HrSalarySheetsPage() {
  await requireModuleAccess("hr");
  return <SalaryRunsList />;
}
