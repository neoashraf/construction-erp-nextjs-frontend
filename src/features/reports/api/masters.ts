import { apiClient } from "@/lib/api/client";

/**
 * FE-54 local master bindings for the shared parameter panel (import-boundary
 * rule §2.4 — features never reach into another feature). The parameter panel
 * only needs id → label lookups; the master-data screens still own the entities.
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
interface CostCentreWire {
  id: string;
  name: string;
  code: string;
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
export interface CostCentreOption {
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

export async function listCostCentreOptions(): Promise<CostCentreOption[]> {
  const res = await apiClient.get<{ data: CostCentreWire[] }>("/masters/cost-centres");
  return res.data.map((c) => ({ id: c.id, label: `${c.code} · ${c.name}` }));
}
