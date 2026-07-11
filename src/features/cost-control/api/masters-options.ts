import { apiClient } from "@/lib/api";
import { type CostCentreOption, type FinancialYearOption, type ProjectOption } from "../types";

/**
 * Read-only selector options for the budget-vs-actual filter bar. Thin local bindings
 * to the MAS list endpoints rather than importing `features/master-data` (skill §2.4
 * import boundary — mirrors `features/audit/api/project-options.ts` and the period
 * feature's FY-options precedent). Company is implicit from the JWT; the backend
 * scopes `/masters/projects` to a PM's assigned projects (FR-CC-016).
 */

export async function listProjectOptions(): Promise<ProjectOption[]> {
  const res = await apiClient.get<{ data: { id: string; name: string; projectCode: string }[] }>(
    "/masters/projects?page=1&pageSize=500",
  );
  return res.data.map((p) => ({ id: p.id, name: p.name, projectCode: p.projectCode }));
}

export async function listCostCentreOptions(): Promise<CostCentreOption[]> {
  const res = await apiClient.get<{ data: { id: string; code: string; name: string; isActive: boolean }[] }>(
    "/masters/cost-centres?page=1&pageSize=500",
  );
  return res.data.map((c) => ({ id: c.id, code: c.code, name: c.name, isActive: c.isActive }));
}

export async function listFinancialYearOptions(): Promise<FinancialYearOption[]> {
  const res = await apiClient.get<{ data: { id: string; label: string; isActive: boolean }[] }>(
    "/masters/financial-years",
  );
  return res.data.map((fy) => ({ id: fy.id, label: fy.label, isActive: fy.isActive }));
}
