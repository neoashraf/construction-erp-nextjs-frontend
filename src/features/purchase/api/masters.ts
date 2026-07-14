import { apiClient } from "@/lib/api";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import {
  type AccountOption,
  type CostCentreOption,
  type GodownOption,
  type ItemOption,
  type ProjectOption,
  type PurposeOption,
  type SupplierOption,
} from "../types";

/**
 * Read-only picker options for Purchase Order entry (list filter + editor line grid).
 * Thin local bindings to the MAS list endpoints (nextjs-author skill §2.4 import boundary —
 * PUR owns these rather than importing `features/master-data`). Company implicit from the
 * JWT; the server scopes project-scoped readers (PM) to assigned projects. Cost centres
 * carry NO project filter; purposes/godowns are project-scoped (`?projectId=`). Suppliers
 * come from the shared Parties list filtered by `isSupplier=true` + `isActive=true` (FR-PUR-004,
 * edge case 14: deactivated suppliers excluded from a new pick — the editor preserves an
 * already-selected deactivated supplier for read-only rendering).
 */

export async function listProjectOptions(): Promise<ProjectOption[]> {
  const res = await apiClient.get<{ data: ProjectOption[] }>("/masters/projects?page=1&pageSize=500");
  return res.data;
}

export async function listSupplierOptions(): Promise<SupplierOption[]> {
  const res = await apiClient.get<{ data: Array<{ id: string; name: string; isActive?: boolean }> }>(
    "/masters/parties?isSupplier=true&isActive=true&page=1&pageSize=500",
  );
  return res.data.map((p) => ({ id: p.id, name: p.name, isActive: p.isActive ?? true }));
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
 * Inline-create a purpose under a project (FR-CC-003). Reuses the shared MAS component
 * on the entry form; refreshes the project-scoped purpose options on success.
 */
export async function createPurpose(projectId: string, name: string): Promise<PurposeOption> {
  const res = await apiClient.post<{ data: PurposeOption }>(
    `/masters/projects/${projectId}/purposes`,
    { name },
    { csrfToken: readCsrfToken() },
  );
  return res.data;
}

export async function listGodownOptions(projectId?: string): Promise<GodownOption[]> {
  const q = projectId ? `?projectId=${projectId}&page=1&pageSize=500` : "?page=1&pageSize=500";
  const res = await apiClient.get<{ data: GodownOption[] }>(`/masters/godowns${q}`);
  return res.data;
}

export async function listItemOptions(): Promise<ItemOption[]> {
  const res = await apiClient.get<{ data: ItemOption[] }>("/masters/items?page=1&pageSize=500");
  return res.data;
}

/**
 * Expense-account picker options for a non-stock bill line (contract 01 § Accounts).
 * Only EXPENSE-type active accounts are relevant on a Purchase Bill non-stock line — the
 * server enforces the same. A previously selected deactivated account stays visible on
 * an existing bill for read-only rendering.
 */
export async function listExpenseAccountOptions(): Promise<AccountOption[]> {
  const res = await apiClient.get<{ data: AccountOption[] }>("/masters/accounts");
  return res.data.filter((a) => a.type === "EXPENSE");
}
