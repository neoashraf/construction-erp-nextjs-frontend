import { apiClient } from "@/lib/api";
import { type Paginated } from "@/lib/api/pagination";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import { type CostCentre } from "../types";

/**
 * Cost-centre API bindings (API contract 01 § Cost Centres). Company-global master;
 * list is filterable + paginated. Central `{ data, meta }` envelope; CSRF on writes.
 */

const BASE = "/masters/cost-centres";

interface Envelope<T> {
  data: T;
}

export interface CostCentreFilter {
  isActive?: boolean;
  q?: string;
  page?: number;
  pageSize?: number;
}

function csrf() {
  return { csrfToken: readCsrfToken() };
}

export async function listCostCentres(
  filter: CostCentreFilter = {},
): Promise<Paginated<CostCentre>> {
  const p = new URLSearchParams();
  if (filter.isActive !== undefined) p.set("isActive", String(filter.isActive));
  if (filter.q) p.set("q", filter.q);
  p.set("page", String(filter.page ?? 1));
  p.set("pageSize", String(filter.pageSize ?? 100));
  const res = await apiClient.get<{
    data: CostCentre[];
    meta?: { page?: number; pageSize?: number; total?: number };
  }>(`${BASE}?${p.toString()}`);
  const meta = res.meta ?? {};
  return {
    data: res.data,
    page: meta.page ?? filter.page ?? 1,
    pageSize: meta.pageSize ?? filter.pageSize ?? 100,
    total: meta.total ?? res.data.length,
  };
}

export async function createCostCentre(input: {
  code: string;
  name: string;
}): Promise<{ id: string }> {
  const res = await apiClient.post<Envelope<{ id: string }>>(BASE, input, csrf());
  return res.data;
}

export async function renameCostCentre(
  id: string,
  input: { name: string; version: number },
): Promise<CostCentre> {
  const res = await apiClient.patch<Envelope<CostCentre>>(`${BASE}/${id}`, input, csrf());
  return res.data;
}

export async function deactivateCostCentre(id: string, version: number): Promise<CostCentre> {
  const res = await apiClient.post<Envelope<CostCentre>>(
    `${BASE}/${id}/deactivate`,
    { version },
    csrf(),
  );
  return res.data;
}

export async function reactivateCostCentre(id: string, version: number): Promise<CostCentre> {
  const res = await apiClient.post<Envelope<CostCentre>>(
    `${BASE}/${id}/reactivate`,
    { version },
    csrf(),
  );
  return res.data;
}
