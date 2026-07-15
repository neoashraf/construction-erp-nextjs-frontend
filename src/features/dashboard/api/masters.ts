import { apiClient } from "@/lib/api/client";

/**
 * FE-61 local master bindings for the dashboard scope selector — mirrors the
 * FE-54 masters slice by copy (import-boundary rule §2.4: features never
 * reach into another feature). The selector only needs id → label lookups.
 */

interface FinancialYearWire {
  id: string;
  label: string;
  isActive: boolean;
}
interface ProjectWire {
  id: string;
  projectCode: string;
  name: string;
}

export interface FinancialYearOption {
  id: string;
  label: string;
  isActive: boolean;
}
export interface ProjectOption {
  id: string;
  label: string;
}

export async function listFinancialYearOptions(): Promise<FinancialYearOption[]> {
  const res = await apiClient.get<{ data: FinancialYearWire[] }>("/masters/financial-years");
  return res.data.map((f) => ({ id: f.id, label: f.label, isActive: f.isActive }));
}

export async function listProjectOptions(): Promise<ProjectOption[]> {
  const res = await apiClient.get<{ data: ProjectWire[] }>("/masters/projects");
  return res.data.map((p) => ({ id: p.id, label: `${p.projectCode} · ${p.name}` }));
}
