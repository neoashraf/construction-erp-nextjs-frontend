import { apiClient } from "@/lib/api";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import { type ProjectBudget } from "../types";

/** Project-budget bindings (API contract 01 § Project Budgets). PUT upsert on (project, cost_centre). */

const base = (projectId: string) => `/masters/projects/${projectId}/budgets`;

interface Envelope<T> {
  data: T;
}
function csrf() {
  return { csrfToken: readCsrfToken() };
}

export async function listBudgets(projectId: string): Promise<ProjectBudget[]> {
  const res = await apiClient.get<{ data: ProjectBudget[] }>(`${base(projectId)}?pageSize=200`);
  return res.data;
}

export async function upsertBudget(
  projectId: string,
  input: { costCentreId: string; budgetedAmount: string; version?: number },
): Promise<ProjectBudget> {
  const res = await apiClient.put<Envelope<ProjectBudget>>(base(projectId), input, csrf());
  return res.data;
}

export async function removeBudget(projectId: string, id: string): Promise<void> {
  await apiClient.delete<void>(`${base(projectId)}/${id}`, csrf());
}
