import { apiClient } from "@/lib/api";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import { type Godown } from "../types";

/** Godown bindings (API contract 01 § Godowns). Project-scoped; deactivate/reactivate. */

const BASE = "/masters/godowns";

interface Envelope<T> {
  data: T;
}
function csrf() {
  return { csrfToken: readCsrfToken() };
}

export async function listGodowns(projectId: string): Promise<Godown[]> {
  const res = await apiClient.get<{ data: Godown[] }>(
    `${BASE}?projectId=${encodeURIComponent(projectId)}&pageSize=200`,
  );
  return res.data;
}

export async function createGodown(input: {
  projectId: string;
  name: string;
  location?: string | null;
}): Promise<{ id: string }> {
  const res = await apiClient.post<Envelope<{ id: string }>>(BASE, input, csrf());
  return res.data;
}

export async function updateGodown(
  id: string,
  input: { name?: string; location?: string | null; version: number },
): Promise<Godown> {
  const res = await apiClient.patch<Envelope<Godown>>(`${BASE}/${id}`, input, csrf());
  return res.data;
}

export async function deactivateGodown(id: string, version: number): Promise<Godown> {
  const res = await apiClient.post<Envelope<Godown>>(
    `${BASE}/${id}/deactivate`,
    { version },
    csrf(),
  );
  return res.data;
}

export async function reactivateGodown(id: string, version: number): Promise<Godown> {
  const res = await apiClient.post<Envelope<Godown>>(
    `${BASE}/${id}/reactivate`,
    { version },
    csrf(),
  );
  return res.data;
}
