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
interface EmployeeWire {
  id: string;
  employeeCode: string;
  name: string;
}
interface SalaryRunWire {
  id: string;
  periodLabel: string;
  status: string;
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
export interface EmployeeOption {
  id: string;
  label: string;
}
export interface SalaryRunOption {
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

/** Active office staff for the HR-report Employee filter (real UUIDs, not samples). */
export async function listEmployeeOptions(): Promise<EmployeeOption[]> {
  const res = await apiClient.get<{ data: EmployeeWire[] }>(
    "/hr/employees?status=ACTIVE&pageSize=200",
  );
  return res.data.map((e) => ({ id: e.id, label: `${e.employeeCode} · ${e.name}` }));
}

/** Posted salary runs for the Salary-register "Salary run" filter (real sheet UUIDs). */
export async function listSalaryRunOptions(financialYearId?: string): Promise<SalaryRunOption[]> {
  const qs = financialYearId
    ? `?financialYearId=${encodeURIComponent(financialYearId)}&pageSize=100`
    : "?pageSize=100";
  const res = await apiClient.get<{ data: SalaryRunWire[] }>(`/salary/sheets${qs}`);
  return res.data.map((s) => ({ id: s.id, label: `${s.periodLabel} · ${s.status.toLowerCase()}` }));
}
