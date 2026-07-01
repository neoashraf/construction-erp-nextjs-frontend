import { apiClient } from "@/lib/api";
import { type Paginated } from "@/lib/api/pagination";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import { type Purpose } from "../types";

/**
 * Purpose API bindings (API contract 01 § Purposes). Project-scoped. `createPurpose`
 * is idempotent — the server returns 201 on insert or 200 with the existing purpose
 * (edge §12.5); either way the binding returns the `Purpose`. CSRF on writes.
 */

const base = (projectId: string) => `/masters/projects/${projectId}/purposes`;

interface Envelope<T> {
  data: T;
}

export interface PurposeFilter {
  isActive?: boolean;
  q?: string;
  page?: number;
  pageSize?: number;
}

function csrf() {
  return { csrfToken: readCsrfToken() };
}

export async function listPurposes(
  projectId: string,
  filter: PurposeFilter = {},
): Promise<Paginated<Purpose>> {
  const p = new URLSearchParams();
  if (filter.isActive !== undefined) p.set("isActive", String(filter.isActive));
  if (filter.q) p.set("q", filter.q);
  p.set("page", String(filter.page ?? 1));
  p.set("pageSize", String(filter.pageSize ?? 100));
  const res = await apiClient.get<{
    data: Purpose[];
    meta?: { page?: number; pageSize?: number; total?: number };
  }>(`${base(projectId)}?${p.toString()}`);
  const meta = res.meta ?? {};
  return {
    data: res.data,
    page: meta.page ?? filter.page ?? 1,
    pageSize: meta.pageSize ?? filter.pageSize ?? 100,
    total: meta.total ?? res.data.length,
  };
}

/** POST a purpose (idempotent inline-create). Returns the inserted OR existing purpose. */
export async function createPurpose(projectId: string, name: string): Promise<Purpose> {
  const res = await apiClient.post<Envelope<Purpose>>(base(projectId), { name }, csrf());
  return res.data;
}

export async function renamePurpose(
  projectId: string,
  id: string,
  input: { name: string; version: number },
): Promise<Purpose> {
  const res = await apiClient.patch<Envelope<Purpose>>(`${base(projectId)}/${id}`, input, csrf());
  return res.data;
}

export async function deactivatePurpose(
  projectId: string,
  id: string,
  version: number,
): Promise<Purpose> {
  const res = await apiClient.post<Envelope<Purpose>>(
    `${base(projectId)}/${id}/deactivate`,
    { version },
    csrf(),
  );
  return res.data;
}

export async function reactivatePurpose(
  projectId: string,
  id: string,
  version: number,
): Promise<Purpose> {
  const res = await apiClient.post<Envelope<Purpose>>(
    `${base(projectId)}/${id}/reactivate`,
    { version },
    csrf(),
  );
  return res.data;
}
