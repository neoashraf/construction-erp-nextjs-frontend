import { apiClient } from "@/lib/api";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import {
  type CostCentreOption,
  type CustomerOption,
  type ProjectOption,
  type PurposeOption,
} from "../types";

/**
 * Read-only picker options for the IPC editor + filter bar. Thin local bindings to the MAS
 * list endpoints (skill §2.4 import boundary — SAL owns these rather than importing
 * `features/master-data`). Company implicit from the JWT; PM readers are scoped server-side.
 * A project carries its resolved customer + remaining mobilization advance so the editor can
 * preview the read-only customer and advance-recovery cap the instant a project is chosen
 * (FR-SAL-001, FR-SAL-008) — the server re-resolves + re-caps at save/post regardless.
 */

export async function listProjectOptions(): Promise<ProjectOption[]> {
  const res = await apiClient.get<{ data: ProjectOption[] }>("/masters/projects?page=1&pageSize=500");
  return res.data;
}

export async function listCustomerOptions(): Promise<CustomerOption[]> {
  const res = await apiClient.get<{ data: Array<{ id: string; name: string; isCustomer?: boolean }> }>(
    "/masters/parties?isCustomer=true&page=1&pageSize=500",
  );
  return res.data.filter((p) => p.isCustomer !== false).map((p) => ({ id: p.id, name: p.name }));
}

export async function listCostCentreOptions(): Promise<CostCentreOption[]> {
  const res = await apiClient.get<{ data: CostCentreOption[] }>("/masters/cost-centres?page=1&pageSize=500");
  return res.data;
}

export async function listPurposeOptions(projectId: string): Promise<PurposeOption[]> {
  const res = await apiClient.get<{ data: PurposeOption[] }>(
    `/masters/projects/${projectId}/purposes?page=1&pageSize=500`,
  );
  return res.data;
}

/**
 * Financial-year options for the register's optional FY filter (fe-ipc-register-retention).
 * Thin local binding to `/masters/financial-years` rather than importing another feature
 * (skill §2.4). Company implicit from the JWT.
 */
export interface FinancialYearOption {
  id: string;
  label: string;
}
export async function listFinancialYearOptions(): Promise<FinancialYearOption[]> {
  const res = await apiClient.get<{ data: FinancialYearOption[] }>("/masters/financial-years");
  return res.data.map((fy) => ({ id: fy.id, label: fy.label }));
}

/** Inline-create a purpose under a project (reuses the MAS Purpose endpoint; FR-SAL-002). */
export async function createPurpose(projectId: string, name: string): Promise<PurposeOption> {
  const res = await apiClient.post<{ data: PurposeOption }>(
    `/masters/projects/${projectId}/purposes`,
    { name },
    { csrfToken: readCsrfToken() },
  );
  return res.data;
}
