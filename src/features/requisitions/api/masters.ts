import { apiClient } from "@/lib/api";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import {
  type CostCentreOption,
  type GodownOption,
  type ItemOption,
  type ProjectOption,
  type PurposeOption,
  type UserOption,
} from "../types";

/**
 * Read-only picker options for the Requisition entry form + filter bar. Thin local bindings
 * to the MAS/AUD list endpoints (skill §2.4 import boundary — REQ owns these rather than
 * importing `features/master-data`). Company implicit from the JWT; the server scopes
 * project-scoped readers to assigned projects. Cost centres carry NO project filter
 * (FR-REQ-002); purposes/godowns are project-scoped lookups.
 */

export async function listProjectOptions(): Promise<ProjectOption[]> {
  const res = await apiClient.get<{ data: ProjectOption[] }>("/masters/projects?page=1&pageSize=500");
  return res.data;
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

export async function listUserOptions(): Promise<UserOption[]> {
  const res = await apiClient.get<{ data: UserOption[] }>("/users?page=1&pageSize=500");
  return res.data.map((u) => ({ id: u.id, name: u.name }));
}
